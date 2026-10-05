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

// -----------------------------------------------------------------------------
// Configuration & Constants
// -----------------------------------------------------------------------------
const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

const connection = new Connection(RPC_ENDPOINT, "confirmed");

// Default dispense amount: 0.25 SOL per day
const DISPENSE_SOL = parseFloat(process.env.FAUCET_DISPENSE_AMOUNT || "0.25");
const DISPENSE_LAMPORTS = Math.round(DISPENSE_SOL * LAMPORTS_PER_SOL);

// Rate Limit: 24 Hours in Milliseconds
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

// In-Memory Rate Limiting Cache: { walletAddress -> lastClaimTimestamp }
const inMemoryClaims = new Map<string, number>();

// -----------------------------------------------------------------------------
// Rate Limit Check
// -----------------------------------------------------------------------------
async function checkAndRecordRateLimit(
  walletAddress: string
): Promise<{ allowed: boolean; remainingHours?: number }> {
  const now = Date.now();
  const lastClaim = inMemoryClaims.get(walletAddress);

  if (lastClaim && now - lastClaim < RATE_LIMIT_WINDOW_MS) {
    const remainingMs = RATE_LIMIT_WINDOW_MS - (now - lastClaim);
    const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
    return { allowed: false, remainingHours };
  }

  // Also check Supabase faucet_claims table if Supabase is connected
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
        const claimTime = new Date(data[0].created_at).getTime();
        const remainingMs = RATE_LIMIT_WINDOW_MS - (now - claimTime);
        const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
        inMemoryClaims.set(walletAddress, claimTime);
        return { allowed: false, remainingHours };
      }
    } catch {
      // Ignore if table does not exist yet; in-memory cache handles it
    }
  }

  return { allowed: true };
}

async function markClaimed(walletAddress: string, signature: string, method: string) {
  const now = Date.now();
  inMemoryClaims.set(walletAddress, now);

  if (supabase) {
    try {
      await supabase.from("faucet_claims").insert([
        {
          wallet_address: walletAddress,
          amount_sol: DISPENSE_SOL,
          signature,
          method,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {
      // Non-blocking
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

    // 1. Check Rate Limit (1 claim per 24 hours)
    const rateCheck = await checkAndRecordRateLimit(walletAddress);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Daily limit reached. You can claim ${DISPENSE_SOL} SOL once every 24 hours.`,
          retryInHours: rateCheck.remainingHours,
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

  if (!wallet) {
    return NextResponse.json({
      status: "online",
      network: "devnet",
      dispenseAmount: `${DISPENSE_SOL} SOL`,
      rateLimit: "1 claim per 24 hours per wallet",
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
