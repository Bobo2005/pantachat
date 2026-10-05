import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { parseSolanaSecretKey } from "@/lib/base58";
import { supabase } from "@/lib/supabase";

import fs from "fs";
import path from "path";

// -----------------------------------------------------------------------------
// Configuration & Constants
// -----------------------------------------------------------------------------
const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

const connection = new Connection(RPC_ENDPOINT, "confirmed");

// Default dispense amount: 0.25 SOL per day
const DISPENSE_SOL = parseFloat(process.env.FAUCET_DISPENSE_AMOUNT || "0.25");
const DISPENSE_LAMPORTS = Math.round(DISPENSE_SOL * LAMPORTS_PER_SOL);

// Rate Limit: Exactly 24 Hours (1 Full Day) in Milliseconds
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

// Local Persistent File on Disk (survives dev server and process restarts)
const CLAIMS_FILE = path.join(process.cwd(), ".faucet_claims.json");

function readDiskClaims(): Record<string, number> {
  try {
    if (fs.existsSync(CLAIMS_FILE)) {
      const content = fs.readFileSync(CLAIMS_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch {}
  return {};
}

function writeDiskClaim(wallet: string, timestamp: number) {
  try {
    const claims = readDiskClaims();
    claims[wallet] = timestamp;
    fs.writeFileSync(CLAIMS_FILE, JSON.stringify(claims, null, 2), "utf-8");
  } catch {}
}

// In-Memory Rate Limiting Cache for zero-latency lookups
const inMemoryClaims = new Map<string, number>();

// -----------------------------------------------------------------------------
// Rate Limit Check (Multi-Layer: Memory -> Disk -> Supabase Cloud)
// -----------------------------------------------------------------------------
async function checkAndRecordRateLimit(
  walletAddress: string
): Promise<{
  allowed: boolean;
  remainingHours?: number;
  remainingMinutes?: number;
  formattedWait?: string;
}> {
  const now = Date.now();
  let lastClaim = inMemoryClaims.get(walletAddress);

  // 1. Check local persistent disk storage
  if (!lastClaim) {
    const diskClaims = readDiskClaims();
    if (diskClaims[walletAddress]) {
      lastClaim = diskClaims[walletAddress];
      inMemoryClaims.set(walletAddress, lastClaim);
    }
  }

  // 2. Check Supabase cloud database (if configured)
  if (supabase) {
    try {
      const sinceIso = new Date(now - RATE_LIMIT_WINDOW_MS).toISOString();
      const { data } = await supabase
        .from("faucet_claims")
        .select("created_at")
        .eq("wallet_address", walletAddress)
        .gte("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const cloudClaimTime = new Date(data[0].created_at).getTime();
        if (!lastClaim || cloudClaimTime > lastClaim) {
          lastClaim = cloudClaimTime;
          inMemoryClaims.set(walletAddress, lastClaim);
        }
      }
    } catch {
      // Table may not exist yet; disk + memory guarantees protection
    }
  }

  // 3. Strict 24-hour (1 day) enforcement
  if (lastClaim && now - lastClaim < RATE_LIMIT_WINDOW_MS) {
    const remainingMs = RATE_LIMIT_WINDOW_MS - (now - lastClaim);
    const totalRemainingMinutes = Math.ceil(remainingMs / (1000 * 60));
    const remainingHours = Math.floor(totalRemainingMinutes / 60);
    const remainingMinutes = totalRemainingMinutes % 60;
    const formattedWait =
      remainingHours > 0
        ? remainingMinutes > 0
          ? `${remainingHours} hr ${remainingMinutes} min`
          : `${remainingHours} hr`
        : `${remainingMinutes} minutes`;

    return {
      allowed: false,
      remainingHours,
      remainingMinutes,
      formattedWait,
    };
  }

  return { allowed: true };
}

async function markClaimed(walletAddress: string, signature: string, method: string) {
  const now = Date.now();
  inMemoryClaims.set(walletAddress, now);
  writeDiskClaim(walletAddress, now);

  if (supabase) {
    try {
      await supabase.from("faucet_claims").insert([
        {
          wallet_address: walletAddress,
          amount_sol: DISPENSE_SOL,
          signature,
          method,
          created_at: new Date(now).toISOString(),
        },
      ]);
    } catch {
      // Non-blocking if table is being created
    }
  }
}

// -----------------------------------------------------------------------------
// POST /api/faucet - Dispense Demo SOL
// -----------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawWallet = body.wallet || body.address;

    if (!rawWallet || typeof rawWallet !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid wallet address." },
        { status: 400 }
      );
    }

    let recipientPubkey: PublicKey;
    try {
      recipientPubkey = new PublicKey(rawWallet.trim());
    } catch {
      return NextResponse.json(
        { error: "Invalid Solana wallet address format." },
        { status: 400 }
      );
    }

    const walletAddress = recipientPubkey.toBase58();

    // 1. Check Rate Limit (Strictly 1 claim per 24 hours per wallet)
    const rateCheck = await checkAndRecordRateLimit(walletAddress);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Daily limit reached for this wallet address. You cannot request SOL until after a day (wait ${rateCheck.formattedWait}).`,
          canClaim: false,
          remainingHours: rateCheck.remainingHours,
          remainingMinutes: rateCheck.remainingMinutes,
          formattedWait: rateCheck.formattedWait,
        },
        { status: 429 }
      );
    }

    // 2. Determine Transfer Method: Treasury Wallet vs Public Devnet RPC Airdrop
    const rawFaucetKey = process.env.FAUCET_PRIVATE_KEY;
    let treasuryKeypair: Keypair | null = null;

    if (rawFaucetKey) {
      try {
        const secretKeyBytes = parseSolanaSecretKey(rawFaucetKey);
        treasuryKeypair = Keypair.fromSecretKey(secretKeyBytes);
      } catch (err) {
        console.warn("[Faucet] Failed to parse FAUCET_PRIVATE_KEY, falling back to airdrop:", err);
      }
    }

    // Method A: Direct Transfer from Treasury Wallet (100% reliable, no RPC limits)
    if (treasuryKeypair) {
      const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
      if (treasuryBalance >= DISPENSE_LAMPORTS + 10000) {
        const transferTx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: treasuryKeypair.publicKey,
            toPubkey: recipientPubkey,
            lamports: DISPENSE_LAMPORTS,
          })
        );

        const signature = await sendAndConfirmTransaction(
          connection,
          transferTx,
          [treasuryKeypair],
          { commitment: "confirmed" }
        );

        await markClaimed(walletAddress, signature, "treasury_transfer");

        return NextResponse.json({
          success: true,
          method: "treasury_transfer",
          amount: DISPENSE_SOL,
          recipient: walletAddress,
          signature,
          explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
        });
      } else {
        console.warn(
          `[Faucet] Treasury balance (${treasuryBalance / LAMPORTS_PER_SOL} SOL) low, falling back to airdrop.`
        );
      }
    }

    // Method B: Solana Devnet RPC requestAirdrop Fallback
    try {
      const airdropSig = await connection.requestAirdrop(
        recipientPubkey,
        DISPENSE_LAMPORTS
      );

      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        {
          signature: airdropSig,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        "confirmed"
      );

      await markClaimed(walletAddress, airdropSig, "rpc_airdrop");

      return NextResponse.json({
        success: true,
        method: "rpc_airdrop",
        amount: DISPENSE_SOL,
        recipient: walletAddress,
        signature: airdropSig,
        explorerUrl: `https://explorer.solana.com/tx/${airdropSig}?cluster=devnet`,
      });
    } catch (airdropErr: any) {
      console.error("[Faucet] RPC airdrop failed:", airdropErr);
      return NextResponse.json(
        {
          error:
            "Solana Devnet faucet is currently congested or rate-limited. Please try again shortly or use solfaucet.com.",
          fallbackUrl: "https://solfaucet.com",
        },
        { status: 503 }
      );
    }
  } catch (err: any) {
    console.error("[Faucet API Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process faucet request." },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------------
// GET /api/faucet - Status Check or Quick Request
// -----------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");
  const checkWallet = searchParams.get("check");

  // Check rate limit eligibility without triggering a claim
  if (checkWallet) {
    try {
      const pubkey = new PublicKey(checkWallet.trim());
      const rateCheck = await checkAndRecordRateLimit(pubkey.toBase58());
      return NextResponse.json({
        wallet: pubkey.toBase58(),
        canClaim: rateCheck.allowed,
        remainingHours: rateCheck.remainingHours || 0,
        remainingMinutes: rateCheck.remainingMinutes || 0,
        formattedWait: rateCheck.formattedWait || null,
        message: rateCheck.allowed
          ? "This wallet is eligible to claim demo SOL."
          : `Daily limit reached. This wallet cannot request SOL until after a day (wait ${rateCheck.formattedWait}).`,
      });
    } catch {
      return NextResponse.json(
        { error: "Invalid Solana address format." },
        { status: 400 }
      );
    }
  }

  if (!wallet) {
    return NextResponse.json({
      status: "online",
      network: "devnet",
      dispenseAmount: `${DISPENSE_SOL} SOL`,
      rateLimit: "Strictly 1 claim per 24 hours per wallet address",
      hasTreasuryWallet: !!process.env.FAUCET_PRIVATE_KEY,
    });
  }

  // If wallet is supplied in query string, handle as claim
  const dummyReq = new NextRequest(req.url, {
    method: "POST",
    body: JSON.stringify({ wallet }),
  });
  return POST(dummyReq);
}
