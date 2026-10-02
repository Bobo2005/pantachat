"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import confetti from "canvas-confetti";
import { useTelegram } from "@/components/TelegramProvider";

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
  payload: {
    marketId?: string;
    outcome?: "yes" | "no";
    amountUsdc?: number;
    title?: string;
    description?: string;
    category?: string;
    cutoffAt?: string;
  };
  market?: {
    id: string;
    title: string;
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

// Backend API Base URL
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

// =============================================================================
// Inner Signing Flow Component
// =============================================================================

function SigningFlow() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") || searchParams.get("id");

  const { connected, publicKey, signTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const { close: closeTelegram, isTelegram } = useTelegram();

  const [state, setState] = useState<StepperState>("loading");
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [countdown, setCountdown] = useState<number>(90);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [txSignature, setTxSignature] = useState<string>("");
  const [isStaleQuote, setIsStaleQuote] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // 1. Fetch Session & Real-Time Quote from Backend
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
      const res = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}${walletParam}`);

      if (!res.ok) {
        if (res.status === 410) {
          setIsStaleQuote(true);
          setErrorMessage("This quote session has expired. Please re-quote.");
          setState("error");
          return;
        }
        throw new Error(`Failed to load session (HTTP ${res.status})`);
      }

      const data = await res.json();
      setSession({
        id: data.session.id,
        type: data.session.type,
        status: data.session.status,
        expiresAt: data.session.expiresAt,
        payload: data.payload || {},
        market: data.market,
        quote: data.quote,
        transaction: data.transaction,
      });

      setCountdown(90);
      setState("quote");
    } catch (err: any) {
      console.warn("[Sign Page] Session fetch error:", err.message);
      // Fallback preview session if backend offline during local preview
      setSession({
        id: sessionId,
        type: "buy",
        status: "pending",
        payload: {
          marketId: "mkt_preview",
          outcome: "yes",
          amountUsdc: 20,
        },
        market: {
          id: "mkt_preview",
          title: "Will Solana hit $300 before November 2026?",
          category: "Crypto",
          yesPrice: 0.65,
          noPrice: 0.35,
        },
        quote: {
          estimatedShares: 30.76,
          feeUsdc: "0.10",
          effectivePrice: 0.65,
        },
      });
      setState("quote");
    }
  }, [sessionId, publicKey]);

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

    if (isStaleQuote || countdown <= 0) {
      await fetchSessionData();
      return;
    }

    try {
      // Transition to Stage 2: Building Transaction
      setState("building");

      // Obtain base64 transaction from backend if not already pre-built
      let base64Tx = session?.transaction;
      if (!base64Tx) {
        const walletParam = `?wallet=${publicKey.toBase58()}`;
        const res = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}${walletParam}`);
        const data = await res.json();
        base64Tx = data.transaction;
      }

      if (!base64Tx) {
        throw new Error("Unable to assemble transaction payload from API.");
      }

      // Transition to Stage 3: Prompting Wallet Signature
      setState("approving");

      const txBytes = base64ToUint8Array(base64Tx);
      const versionedTx = VersionedTransaction.deserialize(txBytes);

      if (!signTransaction) {
        throw new Error("Connected wallet does not support VersionedTransaction signing.");
      }

      const signedTx = await signTransaction(versionedTx);
      const signedBase64 = uint8ArrayToBase64(signedTx.serialize());

      // Transition to Stage 4: Submitting to Solana RPC
      setState("confirming");

      const submitRes = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedTx: signedBase64,
          wallet: publicKey.toBase58(),
        }),
      });

      const submitData = await submitRes.json();
      if (!submitRes.ok || !submitData.success) {
        throw new Error(submitData.message || "Solana transaction confirmation timed out.");
      }

      // Transition to Stage 5: Success!
      setTxSignature(submitData.signature);
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
  const outcome = session?.payload?.outcome || "yes";
  const amountUsdc = session?.payload?.amountUsdc || 20;
  const isOutcomeYes = outcome.toLowerCase() === "yes";

  return (
    <div className="min-h-screen bg-[#0b0e14] text-[#f8fafc] flex items-center justify-center p-4">
      <div className="w-full max-w-md panta-card p-5 border border-[#1e2638] shadow-2xl flex flex-col gap-5">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[#1e2638] pb-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-sm text-white">PantaChat</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Devnet
            </span>
          </div>
          <span className="text-slate-400 font-mono text-[11px]">Non-Custodial</span>
        </div>

        {/* 5-State Visual Stepper Bar */}
        <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-slate-400">
          <div className={`flex items-center gap-1 ${state === "quote" ? "text-[#38bdf8] font-bold" : "text-emerald-400"}`}>
            <span>1. Quote</span>
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
        {isOutcomeYes !== undefined && isStaleQuote && (
          <div className="panta-card-subtle p-3 flex items-center justify-between text-xs border-amber-500/30 bg-amber-500/10 text-amber-300">
            <span>⚠️ Price updated on bonding curve.</span>
            <button
              onClick={fetchSessionData}
              className="text-xs font-semibold text-white underline hover:no-underline"
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
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                {session?.market?.category || "PREDICTION MARKET"}
              </span>
              <h2 className="font-heading font-semibold text-sm text-white leading-snug">
                {session?.market?.title || session?.payload?.title || "Loading market statement..."}
              </h2>
            </div>

            {/* Bet Summary Pill */}
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

            {/* Real-Time Quote Details */}
            <div className="bg-[#0b0e14] p-3 rounded-md border border-[#1e2638] flex flex-col gap-2 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Est. Shares</span>
                <span className="text-white font-medium">
                  {session?.quote?.estimatedShares ? session.quote.estimatedShares.toFixed(2) : "30.76"}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Effective Price</span>
                <span className="text-white font-medium">
                  ${session?.quote?.effectivePrice ? session.quote.effectivePrice.toFixed(2) : "0.65"}
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

            {/* 90s TTL Indicator */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${countdown > 15 ? "bg-emerald-400" : "bg-amber-400 animate-ping"}`} />
                <span>Quote locks in {countdown}s</span>
              </span>
              <button onClick={fetchSessionData} className="text-[#38bdf8] hover:underline">
                Refresh
              </button>
            </div>

            {/* Primary Action Button */}
            {!connected ? (
              <button
                onClick={() => setVisible(true)}
                className="w-full py-2.5 rounded-md bg-white hover:bg-slate-200 text-black text-xs font-semibold transition cursor-pointer"
              >
                Connect Phantom to Sign
              </button>
            ) : (
              <button
                onClick={handleSignAndSubmit}
                disabled={state === "building" || isStaleQuote}
                className={`w-full py-2.5 rounded-md text-xs font-semibold text-white transition cursor-pointer disabled:opacity-50 ${
                  isOutcomeYes
                    ? "bg-[#0284c7] hover:bg-[#0369a1]"
                    : "bg-[#9333ea] hover:bg-[#7e22ce]"
                }`}
              >
                {state === "building" ? "Assembling Transaction..." : `Approve & Sign $${amountUsdc} ${outcome.toUpperCase()}`}
              </button>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* Stage 3: Prompting Wallet Approval */}
        {/* ================================================================== */}
        {state === "approving" && (
          <div className="py-8 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#181f2c] border border-[#1e2638] flex items-center justify-center text-xl animate-bounce">
              👻
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-heading font-semibold text-white text-sm">Approve in Wallet</h3>
              <p className="text-xs text-slate-400 max-w-xs">
                Please approve the transaction prompt in your Phantom or Solflare wallet window.
              </p>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* Stage 4: Confirming on Solana RPC */}
        {/* ================================================================== */}
        {state === "confirming" && (
          <div className="py-8 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-10 h-10 border-2 border-[#1e2638] border-t-[#38bdf8] rounded-full animate-spin" />
            <div className="flex flex-col gap-1">
              <h3 className="font-heading font-semibold text-white text-sm">Confirming on Solana</h3>
              <p className="text-xs text-slate-400 font-mono">
                Awaiting commitment 'confirmed' on Devnet...
              </p>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* Stage 5: Success Celebration */}
        {/* ================================================================== */}
        {state === "success" && (
          <div className="py-4 flex flex-col gap-4 text-center items-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xl">
              ✓
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-heading font-bold text-white text-base">Trade Placed Successfully!</h3>
              <p className="text-xs text-slate-400">
                Your prediction has been recorded non-custodially on Solana.
              </p>
            </div>

            {txSignature && (
              <div className="w-full bg-[#0b0e14] p-2.5 rounded border border-[#1e2638] text-[11px] font-mono flex flex-col gap-1 text-left">
                <span className="text-slate-500">Transaction Signature</span>
                <span className="text-slate-300 truncate">{txSignature}</span>
                <a
                  href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#38bdf8] hover:underline pt-1"
                >
                  View on Solana Explorer ↗
                </a>
              </div>
            )}

            <button
              onClick={() => {
                if (isTelegram) {
                  closeTelegram();
                } else {
                  window.location.href = "/";
                }
              }}
              className="w-full py-2.5 rounded-md bg-white hover:bg-slate-200 text-black text-xs font-semibold transition cursor-pointer"
            >
              {isTelegram ? "Done • Return to Telegram" : "Return to Dashboard"}
            </button>
          </div>
        )}

        {/* Error State */}
        {state === "error" && (
          <div className="py-4 flex flex-col gap-4 text-center items-center">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center justify-center text-lg">
              ✕
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-heading font-semibold text-white text-sm">Action Notice</h3>
              <p className="text-xs text-slate-400 max-w-xs">{errorMessage}</p>
            </div>

            <button
              onClick={fetchSessionData}
              className="w-full py-2 rounded-md bg-[#121721] hover:bg-[#181f2c] border border-[#1e2638] text-xs font-semibold text-white transition cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Export Wrapped in Suspense (App Router Requirement)
// =============================================================================

export default function SignPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b0e14] flex items-center justify-center text-xs font-mono text-slate-500">
          Loading signing sheet...
        </div>
      }
    >
      <SigningFlow />
    </Suspense>
  );
}
