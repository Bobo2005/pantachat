"use client";

import React, { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import confetti from "canvas-confetti";

interface DemoFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DemoFundsModal({ isOpen, onClose, onSuccess }: DemoFundsModalProps) {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  const [addressInput, setAddressInput] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rateLimitStatus, setRateLimitStatus] = useState<{
    canClaim: boolean;
    formattedWait?: string;
  } | null>(null);

  // Sync connected wallet address into input
  useEffect(() => {
    if (publicKey) {
      setAddressInput(publicKey.toBase58());
      connection.getBalance(publicKey).then((lamports) => {
        setBalance(lamports / LAMPORTS_PER_SOL);
      }).catch(() => {});
    }
  }, [publicKey, connection, isOpen]);

  // Live 24-hour rate limit check when address changes
  useEffect(() => {
    const trimmed = addressInput.trim();
    if (!trimmed) {
      setRateLimitStatus(null);
      return;
    }

    try {
      new PublicKey(trimmed);
    } catch {
      setRateLimitStatus(null);
      return;
    }

    let isMounted = true;
    fetch(`/api/faucet?check=${trimmed}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.canClaim !== undefined) {
          setRateLimitStatus({
            canClaim: data.canClaim,
            formattedWait: data.formattedWait,
          });
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [addressInput, isOpen]);

  if (!isOpen) return null;

  const targetAddress = addressInput.trim();

  const handleClaim = async () => {
    setErrorMsg(null);
    setTxSignature(null);

    if (!targetAddress) {
      setErrorMsg("Please enter or connect a Solana wallet address.");
      return;
    }

    try {
      new PublicKey(targetAddress);
    } catch {
      setErrorMsg("Invalid Solana public key format.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: targetAddress }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to claim demo funds.");
      }

      setTxSignature(data.signature);
      setRateLimitStatus({ canClaim: false, formattedWait: "23 hr 59 min" });

      // Trigger Confetti!
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch {
        // Non-blocking
      }

      // Refresh balance
      if (publicKey && publicKey.toBase58() === targetAddress) {
        setTimeout(async () => {
          try {
            const newBal = await connection.getBalance(publicKey);
            setBalance(newBal / LAMPORTS_PER_SOL);
          } catch {}
        }, 1200);
      }

      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Airdrop failed. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-[#0f1420] border border-[#1e283d] p-4 sm:p-6 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-xl shadow-inner">
            💧
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg text-white">Get Demo Funds</h2>
            <p className="text-xs text-slate-400">Instant Devnet SOL for risk-free testing</p>
          </div>
        </div>

        {/* Info Card */}
        <div className="p-3 rounded-xl bg-[#141b2a] border border-[#1e293b] mb-4 text-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-300">
            <span>Dispense Amount:</span>
            <span className="font-mono font-semibold text-sky-400">0.25 Devnet SOL</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>Rate Limit:</span>
            <span className="font-mono text-emerald-400">1 claim / 24 hrs per wallet</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>Account Requirement:</span>
            <span className="text-slate-400">✨ No GitHub Login Required</span>
          </div>
          {balance !== null && connected && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-slate-300">
              <span>Your Current Balance:</span>
              <span className="font-mono font-medium text-white">{balance.toFixed(3)} SOL</span>
            </div>
          )}
        </div>

        {/* Target Address Input */}
        <div className="space-y-1.5 mb-4">
          <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span>Recipient Wallet Address</span>
            {!connected && (
              <button
                type="button"
                onClick={() => setWalletModalVisible(true)}
                className="text-[11px] text-sky-400 hover:underline"
              >
                Connect Wallet
              </button>
            )}
          </label>
          <input
            type="text"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            placeholder="Paste Solana Devnet public key..."
            className="w-full px-3 py-2 rounded-lg bg-[#0b0e14] border border-[#1e2638] text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
          />
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex flex-col gap-1">
            <span>⚠️ {errorMsg}</span>
            <a
              href="https://solfaucet.com"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] underline text-rose-300 hover:text-white"
            >
              Alternative: Claim from SolFaucet (No GitHub) ↗
            </a>
          </div>
        )}

        {/* Success message */}
        {txSignature && (
          <div className="p-3 mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs space-y-1.5">
            <div className="font-semibold flex items-center gap-1.5">
              <span>✅</span> 0.25 Devnet SOL sent to your wallet!
            </div>
            <a
              href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] text-sky-400 hover:underline block truncate"
            >
              Tx: {txSignature} ↗
            </a>
          </div>
        )}

        {/* Daily limit reached warning */}
        {rateLimitStatus && !rateLimitStatus.canClaim && !txSignature && (
          <div className="p-3 mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
            <span className="text-base shrink-0">⏳</span>
            <div className="space-y-0.5">
              <div className="font-semibold text-amber-200">Daily Limit Reached</div>
              <div className="text-[11px] text-amber-300/80 leading-relaxed">
                This wallet has already claimed demo funds. Each wallet is strictly limited to 1 claim every 24 hours. Next claim available in <strong>{rateLimitStatus.formattedWait}</strong>.
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleClaim}
          disabled={loading || !targetAddress || (rateLimitStatus !== null && !rateLimitStatus.canClaim)}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs text-white transition flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20"
        >
          {loading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Dispensing 0.25 SOL...</span>
            </>
          ) : rateLimitStatus && !rateLimitStatus.canClaim ? (
            <span>⏳ Next Claim in {rateLimitStatus.formattedWait}</span>
          ) : (
            <>
              <span>💧</span>
              <span>Claim 0.25 Devnet SOL</span>
            </>
          )}
        </button>

        {/* Footer info */}
        <p className="mt-3 text-center text-[10px] text-slate-500">
          Transferred directly on Solana Devnet. Use funds for testing prediction trades & transaction fees.
        </p>
      </div>
    </div>
  );
}

export default DemoFundsModal;
