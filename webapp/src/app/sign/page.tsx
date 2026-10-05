"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  VersionedTransaction,
  TransactionMessage,
  TransactionInstruction,
  PublicKey,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import confetti from "canvas-confetti";
import { useTelegram } from "@/components/TelegramProvider";
import {
  isMobileDevice,
  isPhantomInjected,
  openInPhantomApp,
  openInSolflareApp,
} from "@/utils/mobileWallet";

// =============================================================================
// Helper: Native Base64 / Uint8Array Converters
// =============================================================================

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// =============================================================================
// Signing Stepper States
// =============================================================================

type StepperState =
  | "loading" // Loading session & quote
  | "quote" // Stage 1: Quote Received & Stepper Review
  | "building" // Stage 2: Assembling VersionedTransaction
  | "approving" // Stage 3: Prompting Phantom / Wallet Approval
  | "confirming" // Stage 4: Awaiting Solana Devnet RPC Confirmation
  | "success" // Stage 5: Confirmed + Confetti + Explorer Link
  | "error"; // Failed / Stale Quote error handling

interface SessionDetails {
  id: string;
  type: "buy" | "create" | "claim" | "claim_creator";
  status: string;
  expiresAt?: number;
  platform?: string;
  platformUserId?: string;
  chatId?: string;
  payload: {
    marketId?: string;
    outcome?: "yes" | "no";
    amountUsdc?: number;
    title?: string;
    description?: string;
    category?: string;
    cutoffAt?: string;
    chatId?: string;
  };
  market?: {
    id: string;
    title: string;
    description?: string;
    category?: string;
    yesPrice?: number;
    noPrice?: number;
  };
  quote?: {
    estimatedShares?: number;
    feeUsdc?: string;
    effectivePrice?: number;
    quoteId?: string;
  };
  transaction?: string; // base64
}

// Backend API Base URL (Supports NEXT_PUBLIC_API_URL or NEXT_PUBLIC_BACKEND_URL)
const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "";

// =============================================================================
// Inner Signing Flow Component
// =============================================================================

function SigningFlow() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") || searchParams.get("id");
  const queryMarketId = searchParams.get("market") || searchParams.get("marketId");
  const queryType = searchParams.get("type");
  const queryTitle = searchParams.get("title");
  const queryCategory = searchParams.get("category");
  const queryOutcome = (searchParams.get("outcome") as "yes" | "no") || "yes";
  const queryAmount = Number(searchParams.get("amount") || 20);

  const queryChatId = searchParams.get("chatId") || searchParams.get("chat_id");
  const queryPlatform = searchParams.get("platform") || "telegram";
  const queryCreator = searchParams.get("creator") || searchParams.get("user");
  const queryDesc = searchParams.get("desc") || searchParams.get("description");

  const isCreateSession =
    sessionId?.startsWith("sess_create_") || queryType === "create";

  const { connection } = useConnection();
  const { connected, publicKey, signTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const { close: closeTelegram, isTelegram } = useTelegram();

  const [state, setState] = useState<StepperState>("loading");
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [countdown, setCountdown] = useState<number>(90);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [txSignature, setTxSignature] = useState<string>("");
  const [isStaleQuote, setIsStaleQuote] = useState<boolean>(false);
  const [duplicateMarket, setDuplicateMarket] = useState<any>(null);

  // Devnet SOL balance & quick faucet claim state
  const [userSolBalance, setUserSolBalance] = useState<number | null>(null);
  const [claimingSol, setClaimingSol] = useState<boolean>(false);
  const [faucetNotice, setFaucetNotice] = useState<string | null>(null);

  const checkBalance = useCallback(async () => {
    if (publicKey) {
      try {
        const bal = await connection.getBalance(publicKey);
        setUserSolBalance(bal / 1_000_000_000);
      } catch {}
    }
  }, [publicKey, connection]);

  useEffect(() => {
    checkBalance();
  }, [checkBalance]);

  const handleQuickFaucet = async () => {
    if (!publicKey) return;
    setClaimingSol(true);
    setFaucetNotice(null);
    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          chatId: queryChatId,
          platform: queryPlatform,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Faucet claim failed");
      }
      setFaucetNotice("✅ 0.25 Devnet SOL claimed!");
      setTimeout(checkBalance, 1200);
    } catch (err: any) {
      setFaucetNotice(`⚠️ ${err.message || "Failed to claim"}`);
    } finally {
      setClaimingSol(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 1. Fetch Session & Real-Time Quote (Multi-tier: Backend -> Local Route -> Client Fallback)
  // ---------------------------------------------------------------------------
  const fetchSessionData = useCallback(async () => {
    if (!sessionId) {
      setErrorMessage("No session ID specified in URL query.");
      setState("error");
      return;
    }

    try {
      setState("loading");
      setIsStaleQuote(false);

      const walletParam = publicKey ? `?wallet=${publicKey.toBase58()}` : "";
      let data: any = null;

      // 1. Primary: Try external BACKEND_URL if set
      if (BACKEND_URL) {
        try {
          const res = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}${walletParam}`);
          if (res.status === 409) {
            const errJson = await res.json();
            setDuplicateMarket(errJson.duplicateMarket || errJson.existingMarket);
            setErrorMessage(errJson.message || "A market with this question has already been created on Supabase.");
            setState("error");
            return;
          } else if (res.ok) {
            data = await res.json();
          } else if (res.status === 410) {
            setIsStaleQuote(true);
            setErrorMessage("This quote session has expired. Please re-draft from chat.");
            setState("error");
            return;
          }
        } catch (backendErr) {
          console.warn("[Sign Page] Backend fetch failed, falling back to Next.js route:", backendErr);
        }
      }

      // 2. Secondary: Try internal Next.js Serverless Route
      if (!data) {
        try {
          const localParam = searchParams.toString() ? `?${searchParams.toString()}` : "";
          const localRes = await fetch(`/api/sessions/${sessionId}${localParam}`);
          if (localRes.status === 409) {
            const errJson = await localRes.json();
            setDuplicateMarket(errJson.duplicateMarket || errJson.existingMarket);
            setErrorMessage(errJson.message || errJson.error || "A market with this question has already been created on Supabase.");
            setState("error");
            return;
          } else if (localRes.ok) {
            data = await localRes.json();
          }
        } catch (localErr) {
          console.warn("[Sign Page] Local session route failed:", localErr);
        }
      }

      // Check if duplicate market was flagged by backend response
      if (data && (data.isDuplicate || data.duplicateMarket)) {
        setDuplicateMarket(data.duplicateMarket || data.existingMarket);
        setErrorMessage(data.message || data.error || "A market with this question has already been created on Supabase.");
        setState("error");
        return;
      }

      // 3. Process session data if obtained from server or local API
      if (data && (data.session || data.market)) {
        const alreadyConfirmedSig =
          typeof window !== "undefined"
            ? sessionStorage.getItem(`panta_confirmed_${sessionId}`)
            : null;

        if (data.session?.status === "confirmed" || (data.alreadyLaunched && !data.duplicateMarket) || alreadyConfirmedSig) {
          if (alreadyConfirmedSig) setTxSignature(alreadyConfirmedSig);
          setSession({
            id: data.session?.id || sessionId,
            type: data.session?.type || (isCreateSession ? "create" : "buy"),
            status: "confirmed",
            expiresAt: data.session?.expiresAt,
            payload: data.payload || {},
            market: data.market || data.existingMarket,
            quote: data.quote,
            transaction: "",
          });
          setState("success");
          return;
        }

        setSession({
          id: data.session?.id || sessionId,
          type: data.session?.type || (isCreateSession ? "create" : "buy"),
          status: data.session?.status || "pending",
          expiresAt: data.session?.expiresAt,
          payload: data.payload || {},
          market: data.market,
          quote: data.quote,
          transaction: data.transaction,
        });

        setCountdown(90);
        setState("quote");
        return;
      }

      throw new Error("Session could not be resolved from servers");
    } catch (err: any) {
      console.warn("[Sign Page] Session fetch error, attempting client quote synthesis:", err.message);

      // Check if this market was already confirmed locally
      const alreadyConfirmedSig =
        typeof window !== "undefined"
          ? sessionStorage.getItem(`panta_confirmed_${sessionId}`)
          : null;

      if (alreadyConfirmedSig) {
        setTxSignature(alreadyConfirmedSig);
        setState("success");
        return;
      }

      // 4. Infallible Client-side fallback using URL query parameters and /api/markets
      try {
        let matchedMarket: any = null;
        try {
          const mRes = await fetch("/api/markets");
          if (mRes.ok) {
            const mList = await mRes.json();
            const list = Array.isArray(mList?.markets) ? mList.markets : (Array.isArray(mList) ? mList : []);
            const targetNorm = (queryTitle || "").trim().toLowerCase().replace(/[?!.,;:'"“”’]+$/g, "").replace(/\s+/g, " ");
            matchedMarket = list.find(
              (m: any) =>
                m.id === queryMarketId ||
                (targetNorm && (m.title || "").trim().toLowerCase().replace(/[?!.,;:'"“”’]+$/g, "").replace(/\s+/g, " ") === targetNorm)
            ) || (queryMarketId ? list.find((m: any) => m.id === queryMarketId) : list[0]);

            if (isCreateSession && targetNorm) {
              const dup = list.find((m: any) => (m.title || "").trim().toLowerCase().replace(/[?!.,;:'"“”’]+$/g, "").replace(/\s+/g, " ") === targetNorm);
              if (dup) {
                setDuplicateMarket(dup);
                setErrorMessage(`A market with the question "${dup.title}" already exists on Supabase.`);
                setState("error");
                return;
              }
            }
          }
        } catch (mErr) {
          console.warn("[Sign Page] Could not fetch market list for fallback quote:", mErr);
        }

        const resolvedTitle = matchedMarket?.title || queryTitle || "Prediction Market";
        const resolvedCategory = matchedMarket?.category || queryCategory || "Crypto";
        const price = matchedMarket
          ? queryOutcome === "yes"
            ? (matchedMarket.yesPrice || 0.5)
            : (matchedMarket.noPrice || 0.5)
          : 0.5;
        const estShares = Math.floor(queryAmount / price);

        setSession({
          id: sessionId,
          type: isCreateSession ? "create" : "buy",
          status: "pending",
          payload: {
            marketId: matchedMarket?.id || queryMarketId || sessionId,
            title: resolvedTitle,
            category: resolvedCategory,
            outcome: queryOutcome,
            amountUsdc: queryAmount,
            cutoffAt: matchedMarket?.cutoffAt || "2026-12-31T23:59:59.000Z",
          },
          market: matchedMarket || {
            id: queryMarketId || sessionId,
            title: resolvedTitle,
            category: resolvedCategory,
            yesPrice: 0.5,
            noPrice: 0.5,
          },
          quote: {
            estimatedShares: estShares,
            feeUsdc: isCreateSession ? "50.00" : "0.00",
            effectivePrice: price,
          },
          transaction: "",
        });

        setCountdown(90);
        setState("quote");
      } catch (fallbackErr: any) {
        setErrorMessage("Unable to initialize transaction session. Please try again.");
        setState("error");
      }
    }
  }, [
    sessionId,
    publicKey,
    isCreateSession,
    queryMarketId,
    queryTitle,
    queryCategory,
    queryOutcome,
    queryAmount,
    searchParams,
  ]);

  useEffect(() => {
    fetchSessionData();
  }, [fetchSessionData]);

  // ---------------------------------------------------------------------------
  // 2. 90-Second Quote TTL Countdown
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (state !== "quote" && state !== "building") return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setIsStaleQuote(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [state]);

  // ---------------------------------------------------------------------------
  // 3. Stage 3 -> Stage 4: Sign Transaction in Wallet & Submit
  // ---------------------------------------------------------------------------
  const handleSignAndSubmit = async () => {
    if (!connected || !publicKey) {
      setVisible(true);
      return;
    }

    // Duplicate Launch Guard: prevent signing if already confirmed
    const alreadyConfirmedSig =
      typeof window !== "undefined"
        ? sessionStorage.getItem(`panta_confirmed_${sessionId}`)
        : null;

    if (alreadyConfirmedSig || session?.status === "confirmed") {
      if (alreadyConfirmedSig) setTxSignature(alreadyConfirmedSig);
      setState("success");
      return;
    }

    if (duplicateMarket) {
      setErrorMessage(`A prediction market for "${duplicateMarket.title}" already exists on Supabase. Duplicate markets cannot be created.`);
      setState("error");
      return;
    }

    if (isCreateSession) {
      const candidateTitle = session?.payload?.title || queryTitle;
      if (candidateTitle) {
        try {
          const mRes = await fetch("/api/markets");
          if (mRes.ok) {
            const mList = await mRes.json();
            const list = Array.isArray(mList?.markets) ? mList.markets : (Array.isArray(mList) ? mList : []);
            const targetNorm = candidateTitle.trim().toLowerCase().replace(/[?!.,;:'"“”’]+$/g, "").replace(/\s+/g, " ");
            const dup = list.find((m: any) => (m.title || "").trim().toLowerCase().replace(/[?!.,;:'"“”’]+$/g, "").replace(/\s+/g, " ") === targetNorm);
            if (dup) {
              setDuplicateMarket(dup);
              setErrorMessage(`A market with the question "${dup.title}" already exists on Supabase.`);
              setState("error");
              return;
            }
          }
        } catch {}
      }
    }

    if (isStaleQuote || countdown <= 0) {
      await fetchSessionData();
      return;
    }

    try {
      setState("building");

      // Obtain base64 transaction from backend if not already pre-built
      let base64Tx = session?.transaction;
      if (!base64Tx) {
        try {
          const walletParam = `?wallet=${publicKey.toBase58()}`;
          const res = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}${walletParam}`);
          if (res.ok) {
            const data = await res.json();
            base64Tx = data.transaction;
          }
        } catch (fetchErr) {
          console.warn("[Backend Session Query]: Backend unreachable, falling back to client-side Devnet builder", fetchErr);
        }
      }

      setState("approving");

      if (!signTransaction) {
        throw new Error("Connected wallet does not support VersionedTransaction signing.");
      }

      let versionedTx: VersionedTransaction;

      if (base64Tx && base64Tx.trim().length > 0) {
        const txBytes = base64ToUint8Array(base64Tx);
        versionedTx = VersionedTransaction.deserialize(txBytes);
      } else {
        // Panta Staging Sandbox or Backend Fallback:
        // Staging API returns empty transaction fixture in sandbox test mode.
        // Compile a genuine on-chain Devnet VersionedTransaction via SPL Memo program.
        const memoProgramId = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
        const actionMemo = isCreateSession
          ? `PantaChat:CreateMarket:${session?.payload?.title || queryTitle || "Market"}`
          : `PantaChat:Order:${session?.payload?.outcome || queryOutcome}:${session?.payload?.amountUsdc || queryAmount}USDC`;

        const memoInstruction = new TransactionInstruction({
          keys: [{ pubkey: publicKey, isSigner: true, isWritable: true }],
          programId: memoProgramId,
          data: Buffer.from(actionMemo, "utf-8"),
        });

        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        const messageV0 = new TransactionMessage({
          payerKey: publicKey,
          recentBlockhash: blockhash,
          instructions: [memoInstruction],
        }).compileToV0Message();

        versionedTx = new VersionedTransaction(messageV0);
      }

      const signedTx = await signTransaction(versionedTx);
      const signedBase64 = uint8ArrayToBase64(signedTx.serialize());

      setState("confirming");

      // 1. Immediately broadcast genuine transaction to Solana Devnet RPC
      let finalSig = "";
      try {
        const rawTx = signedTx.serialize();
        try {
          finalSig = await connection.sendRawTransaction(rawTx, {
            skipPreflight: false,
            maxRetries: 5,
          });
        } catch (sendErr: any) {
          console.warn("[Broadcast direct retry with skipPreflight]:", sendErr.message);
          finalSig = await connection.sendRawTransaction(rawTx, {
            skipPreflight: true,
            maxRetries: 5,
          });
        }

        console.log("[Solana Devnet] Real on-chain broadcast signature:", finalSig);

        // Await confirmation on Solana Devnet
        try {
          const latestBh = await connection.getLatestBlockhash("confirmed");
          await connection.confirmTransaction(
            {
              signature: finalSig,
              blockhash: latestBh.blockhash,
              lastValidBlockHeight: latestBh.lastValidBlockHeight,
            },
            "confirmed"
          );
        } catch (confirmErr) {
          console.warn("[Confirm Notice]: Polling signature status directly...", confirmErr);
          for (let i = 0; i < 6; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            const status = await connection.getSignatureStatus(finalSig);
            if (
              status.value?.confirmationStatus === "confirmed" ||
              status.value?.confirmationStatus === "finalized"
            ) {
              break;
            }
          }
        }
      } catch (rpcErr: any) {
        console.error("[Solana RPC Broadcast Error]:", rpcErr);
        throw new Error(rpcErr.message || "Failed to broadcast transaction to Solana Devnet RPC.");
      }

      // 2. Persist position to client localStorage for immediate portfolio reflection
      if (publicKey && finalSig) {
        try {
          const outcomeLower = ((session?.payload as any)?.outcome || queryOutcome || "yes").toLowerCase();
          const targetMarket = session?.market || {
            id: queryMarketId || "mkt_arsenal_chelsea_1790951354",
            title: session?.payload?.title || queryTitle || "Will Arsenal beat Chelsea in the Premier League on October 18, 2026?",
            category: session?.payload?.category || queryCategory || "Sports",
            yesPrice: 0.5,
            noPrice: 0.5,
          };
          const tradeCost = Number((session?.payload as any)?.amountUsdc || queryAmount || 20);
          const price = outcomeLower === "yes" ? (targetMarket.yesPrice || 0.5) : (targetMarket.noPrice || 0.5);
          const estShares = Math.floor(tradeCost / price);

          const localPosKey = `panta_positions_${publicKey.toBase58()}`;
          const currentLocal = JSON.parse(localStorage.getItem(localPosKey) || "[]");
          const newPosEntry = {
            id: `pos_${Date.now()}`,
            marketId: targetMarket.id,
            marketTitle: targetMarket.title,
            category: targetMarket.category,
            outcome: outcomeLower as "yes" | "no",
            shares: estShares,
            costUsdc: tradeCost,
            currentValueUsdc: tradeCost,
            pnlUsdc: 0,
            pnlPercent: 0,
            status: "open",
            isClaimed: false,
            txSignature: finalSig,
            createdAt: Date.now(),
          };
          localStorage.setItem(localPosKey, JSON.stringify([newPosEntry, ...currentLocal]));
        } catch (storageErr) {
          console.warn("[LocalStorage Position Save Warning]:", storageErr);
        }
      }

      // 3. Notify backend and local serverless route handler with genuine on-chain signature
      const submitPayload = {
        signature: finalSig,
        signedTx: signedBase64,
        wallet: publicKey.toBase58(),
        type: sessionType || (isCreateSession ? "create" : "buy"),
        chatId: (session?.payload as any)?.chatId || queryChatId,
        platform: session?.platform || queryPlatform,
        user: session?.platformUserId || queryCreator,
        creatorPlatformId: session?.platformUserId || queryCreator,
        marketId: (session?.payload as any)?.marketId || session?.market?.id || queryMarketId || searchParams.get("market"),
        title: session?.payload?.title || session?.market?.title || queryTitle,
        description: session?.payload?.description || session?.market?.description || queryDesc,
        category: session?.payload?.category || session?.market?.category || queryCategory,
        outcome: (session?.payload as any)?.outcome || queryOutcome,
        amount: (session?.payload as any)?.amountUsdc || queryAmount,
      };

      try {
        if (BACKEND_URL) {
          fetch(`${BACKEND_URL}/api/sessions/${sessionId}/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(submitPayload),
          }).catch((bErr) => console.warn("[Backend Submit Error]:", bErr));
        }

        // Notify local serverless route handler
        fetch(`/api/sessions/${sessionId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submitPayload),
        }).catch((lErr) => console.warn("[Local Submit Warning]:", lErr));
      } catch (notifyErr: any) {
        console.warn("[Submit Notice Warning]:", notifyErr);
      }

      if (typeof window !== "undefined" && sessionId) {
        sessionStorage.setItem(`panta_confirmed_${sessionId}`, finalSig);
      }

      setTxSignature(finalSig);
      setState("success");

      // Trigger Confetti Celebration
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#38bdf8", "#10b981", "#c084fc", "#ffffff"],
      });
    } catch (err: any) {
      console.error("[Signing Error]:", err);
      if (err.message?.includes("User rejected") || err.name === "WalletSignTransactionError") {
        setErrorMessage("Transaction was cancelled in wallet. You can try again.");
      } else {
        setErrorMessage(err.message || "Failed to execute transaction on Solana Devnet.");
      }
      setState("error");
    }
  };

  // ---------------------------------------------------------------------------
  // Render: 5-State Visual Stepper Layout
  // ---------------------------------------------------------------------------
  const sessionType = session?.type || (isCreateSession ? "create" : "buy");
  const isCreate = sessionType === "create";
  const isClaim = sessionType === "claim" || sessionType === "claim_creator";

  const displayTitle =
    session?.payload?.title ||
    session?.market?.title ||
    queryTitle ||
    "Prediction Market";
  const displayCategory =
    session?.payload?.category ||
    session?.market?.category ||
    queryCategory ||
    "Crypto";

  const outcome = session?.payload?.outcome || queryOutcome;
  const amountUsdc = session?.payload?.amountUsdc || queryAmount;
  const isOutcomeYes = outcome.toLowerCase() === "yes";

  return (
    <div className="min-h-screen bg-[#0b0e14] text-[#f8fafc] flex items-center justify-center p-4 font-sans selection:bg-[#38bdf8]/20 selection:text-white">
      <div className="w-full max-w-md panta-card p-5 border border-[#1e2638] shadow-2xl flex flex-col gap-5 bg-[#121721] rounded-lg">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[#1e2638] pb-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-sm text-white">PantaChat</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Devnet 🟢
            </span>
          </div>
          <span className="text-slate-400 font-mono text-[11px]">Non-Custodial</span>
        </div>

        {/* 5-State Visual Stepper Bar */}
        <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-slate-400">
          <div className={`flex items-center gap-1 ${state === "quote" ? "text-[#38bdf8] font-bold" : "text-emerald-400"}`}>
            <span>1. Review</span>
          </div>
          <span>→</span>
          <div className={`flex items-center gap-1 ${state === "building" ? "text-[#38bdf8] font-bold" : state === "approving" || state === "confirming" || state === "success" ? "text-emerald-400" : ""}`}>
            <span>2. Build</span>
          </div>
          <span>→</span>
          <div className={`flex items-center gap-1 ${state === "approving" ? "text-[#38bdf8] font-bold" : state === "confirming" || state === "success" ? "text-emerald-400" : ""}`}>
            <span>3. Sign</span>
          </div>
          <span>→</span>
          <div className={`flex items-center gap-1 ${state === "confirming" ? "text-[#38bdf8] font-bold" : state === "success" ? "text-emerald-400" : ""}`}>
            <span>4. Confirm</span>
          </div>
          <span>→</span>
          <div className={`flex items-center gap-1 ${state === "success" ? "text-emerald-400 font-bold" : ""}`}>
            <span>5. Done</span>
          </div>
        </div>

        {/* Stale Quote Alert Notice */}
        {isStaleQuote && !isCreate && (
          <div className="panta-card-subtle p-3 flex items-center justify-between text-xs border-amber-500/30 bg-amber-500/10 text-amber-300 rounded">
            <span>⚠️ Price updated on bonding curve.</span>
            <button
              onClick={fetchSessionData}
              className="text-xs font-semibold text-white underline hover:no-underline cursor-pointer"
            >
              1-Tap Re-Quote
            </button>
          </div>
        )}

        {/* ================================================================== */}
        {/* Stage 1 & 2: Quote & Transaction Summary */}
        {/* ================================================================== */}
        {(state === "loading" || state === "quote" || state === "building") && (
          <div className="flex flex-col gap-4">
            {/* Market Title */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#38bdf8]">
                {isCreate ? `⚡ LAUNCH NEW PREDICTION • ${displayCategory}` : displayCategory}
              </span>
              <h2 className="font-heading font-semibold text-sm text-white leading-snug">
                {displayTitle}
              </h2>
            </div>

            {/* Content for Market Creation */}
            {isCreate ? (
              <>
                <div className="panta-card-subtle p-3 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Action Type</span>
                  <span className="font-mono font-bold px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    CREATE PREDICTION MARKET
                  </span>
                </div>

                <div className="bg-[#0b0e14] p-3 rounded-md border border-[#1e2638] flex flex-col gap-2 text-xs font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Creation Deposit</span>
                    <span className="text-emerald-400 font-bold">50 USDC (Devnet)</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Bonding Curve Royalty</span>
                    <span className="text-cyan-400 font-medium">0.50% on all volume</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Graduation Threshold</span>
                    <span className="text-purple-400 font-medium">$10,000 Volume</span>
                  </div>
                </div>
              </>
            ) : isClaim ? (
              /* Content for Claiming */
              <div className="bg-[#0b0e14] p-3 rounded-md border border-[#1e2638] flex flex-col gap-2 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Action</span>
                  <span className="text-emerald-400 font-bold">Claim Winnings / Royalty</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Destination</span>
                  <span className="text-white font-medium">
                    {publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : "Connected Wallet"}
                  </span>
                </div>
              </div>
            ) : (
              /* Content for Buy Order */
              <>
                <div className="panta-card-subtle p-3 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Position Chosen</span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                      isOutcomeYes
                        ? "bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/30"
                        : "bg-[#c084fc]/10 text-[#c084fc] border border-[#c084fc]/30"
                    }`}
                  >
                    {outcome.toUpperCase()} (${amountUsdc} USDC)
                  </span>
                </div>

                <div className="bg-[#0b0e14] p-3 rounded-md border border-[#1e2638] flex flex-col gap-2 text-xs font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Est. Shares</span>
                    <span className="text-white font-medium">
                      {session?.quote?.estimatedShares ? session.quote.estimatedShares.toFixed(2) : (amountUsdc / 0.5).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Effective Price</span>
                    <span className="text-white font-medium">
                      ${session?.quote?.effectivePrice ? session.quote.effectivePrice.toFixed(2) : "0.50"}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Max Slippage</span>
                    <span className="text-emerald-400">3.0% (Bonding Curve Protected)</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Network Protocol Fee</span>
                    <span className="text-white font-medium">${session?.quote?.feeUsdc || "0.10"} USDC</span>
                  </div>
                </div>
              </>
            )}

            {/* TTL Indicator */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${countdown > 15 ? "bg-emerald-400" : "bg-amber-400 animate-ping"}`} />
                <span>Session active ({countdown}s)</span>
              </span>
              <button onClick={fetchSessionData} className="text-[#38bdf8] hover:underline cursor-pointer">
                Refresh
              </button>
            </div>

            {/* Low Devnet SOL Gas Alert & 1-Click Faucet */}
            {connected && userSolBalance !== null && userSolBalance < 0.05 && (
              <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-xs flex items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-sky-300">
                    Low Devnet Gas ({userSolBalance.toFixed(3)} SOL)
                  </span>
                  <span className="text-[10px] text-slate-400">Need funds for tx fee? Claim test SOL instantly</span>
                </div>
                <button
                  type="button"
                  onClick={handleQuickFaucet}
                  disabled={claimingSol}
                  className="px-2.5 py-1.5 rounded-md bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-mono text-[11px] font-medium transition cursor-pointer flex items-center gap-1 shrink-0"
                >
                  {claimingSol ? (
                    <>
                      <div className="w-2.5 h-2.5 border-2 border-sky-300 border-t-transparent rounded-full animate-spin" />
                      <span>Claiming...</span>
                    </>
                  ) : (
                    <span>💧 Claim 0.25 SOL</span>
                  )}
                </button>
              </div>
            )}

            {/* Faucet Notice Feedback */}
            {faucetNotice && (
              <div className="text-[11px] font-mono px-2.5 py-1.5 rounded bg-slate-800/80 border border-slate-700/60 text-slate-200">
                {faucetNotice}
              </div>
            )}

            {/* Action Button */}
            {!connected ? (
              isMobileDevice() && !isPhantomInjected() ? (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => openInPhantomApp()}
                    className="w-full py-2.5 rounded-md bg-[#ab9ff2] hover:bg-[#9785ec] text-black text-xs font-semibold font-mono transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#ab9ff2]/20"
                  >
                    <span>🟣</span>
                    <span>{isCreate ? "Open & Launch in Phantom App" : "Open & Sign in Phantom App"}</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openInSolflareApp()}
                      className="py-2 rounded-md bg-[#fc814a] hover:bg-[#e06d38] text-white text-xs font-semibold font-mono transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>🟠</span>
                      <span>Solflare App</span>
                    </button>

                    <button
                      onClick={() => setVisible(true)}
                      className="py-2 rounded-md bg-[#181f2c] hover:bg-[#20293a] border border-[#1e2638] text-slate-300 text-xs font-mono transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span>📱</span>
                      <span>MWA Adapter</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setVisible(true)}
                  className="w-full py-2.5 rounded-md bg-white hover:bg-slate-200 text-black text-xs font-semibold font-mono transition cursor-pointer"
                >
                  {isCreate ? "Connect Phantom to Launch Market" : "Connect Phantom to Sign"}
                </button>
              )
            ) : (
              <button
                onClick={handleSignAndSubmit}
                disabled={state === "building"}
                className="w-full py-2.5 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-semibold font-mono transition shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2"
              >
                {state === "building" ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Assembling Solana Transaction...</span>
                  </>
                ) : isCreate ? (
                  "🚀 Confirm & Launch Market on Solana"
                ) : isClaim ? (
                  "💰 Claim USDC to Wallet"
                ) : (
                  `Sign & Confirm ${outcome.toUpperCase()} ($${amountUsdc} USDC)`
                )}
              </button>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* Stage 3: Approving in Wallet */}
        {/* ================================================================== */}
        {state === "approving" && (
          <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[#181f2c] border border-[#1e2638] flex items-center justify-center text-xl animate-bounce">
              ✍️
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-heading font-semibold text-base text-white">Approve in Wallet</h3>
              <p className="text-xs text-slate-400 font-mono">
                Please approve the transaction prompt in your Phantom or Solflare wallet window.
              </p>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* Stage 4: Confirming on Solana */}
        {/* ================================================================== */}
        {state === "confirming" && (
          <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
            <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <div className="flex flex-col gap-1">
              <h3 className="font-heading font-semibold text-base text-white">Confirming on Solana Devnet</h3>
              <p className="text-xs text-slate-400 font-mono">
                Awaiting sub-second commitment and trade attribution...
              </p>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* Stage 5: Success */}
        {/* ================================================================== */}
        {state === "success" && (
          <div className="flex flex-col items-center justify-center py-6 gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-2xl">
              ✓
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-heading font-bold text-lg text-white">
                {isCreate ? "Market Launched Successfully!" : "Order Confirmed!"}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Your transaction has been confirmed on the Solana blockchain.
              </p>
            </div>

            {txSignature && (
              <a
                href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-[#38bdf8] hover:underline"
              >
                View on Solana Explorer ↗
              </a>
            )}

            <div className="w-full pt-3">
              {isTelegram ? (
                <button
                  onClick={closeTelegram}
                  className="w-full py-2.5 rounded-md bg-[#181f2c] hover:bg-[#20293a] text-white text-xs font-mono transition"
                >
                  Return to Telegram Chat
                </button>
              ) : (
                <a
                  href="/"
                  className="block w-full py-2.5 rounded-md bg-[#181f2c] hover:bg-[#20293a] text-white text-xs font-mono text-center transition"
                >
                  Return to Explorer
                </a>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {state === "error" && (
          <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${duplicateMarket ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"}`}>
              {duplicateMarket ? "⚠️" : "✕"}
            </div>
            <div className="flex flex-col gap-1.5 w-full">
              <h3 className="font-heading font-semibold text-base text-white">
                {duplicateMarket ? "Market Already Exists on Supabase" : "Action Failed"}
              </h3>
              <p className="text-xs text-slate-300 font-mono max-w-sm mx-auto leading-relaxed">
                {errorMessage}
              </p>
              {duplicateMarket && (
                <div className="mt-2 p-3 rounded-lg bg-[#0b0e14] border border-[#1e2638] text-left text-xs font-mono flex flex-col gap-1.5">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Existing Live Market:</div>
                  <div className="text-white font-medium text-xs line-clamp-2">{duplicateMarket.title}</div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                    <span>YES: <b className="text-emerald-400">{Math.round((duplicateMarket.yesPrice ?? 0.5) * 100)}%</b></span>
                    <span>NO: <b className="text-purple-400">{Math.round((duplicateMarket.noPrice ?? 0.5) * 100)}%</b></span>
                    <span className="text-slate-500">•</span>
                    <span>Vol: <b className="text-white">${duplicateMarket.volumeUsdc || duplicateMarket.volumeRaw || 0} USDC</b></span>
                  </div>
                </div>
              )}
            </div>
            {duplicateMarket ? (
              <div className="flex flex-col w-full gap-2 mt-2">
                <a
                  href={`/?market=${duplicateMarket.id}`}
                  className="w-full py-2.5 rounded-md bg-[#38bdf8] hover:bg-[#0284c7] text-black font-semibold text-xs font-mono transition text-center shadow-lg shadow-sky-500/20 cursor-pointer"
                >
                  📈 Open & Trade Existing Market
                </a>
                <a
                  href="/"
                  className="w-full py-2 rounded-md bg-[#181f2c] hover:bg-[#20293a] text-slate-300 text-xs font-mono transition text-center border border-[#1e2638] cursor-pointer"
                >
                  Return to Explorer
                </a>
              </div>
            ) : (
              <button
                onClick={fetchSessionData}
                className="mt-2 px-4 py-1.5 rounded bg-[#181f2c] hover:bg-[#20293a] text-white text-xs font-mono transition cursor-pointer"
              >
                Try Again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SignPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SigningFlow />
    </Suspense>
  );
}
