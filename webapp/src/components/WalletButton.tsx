"use client";

import React, { useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export function WalletButton({ className = "" }: { className?: string }) {
  const { connected, connecting, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchBalance() {
      if (!connected || !publicKey) {
        setBalance(null);
        return;
      }

      try {
        const lamports = await connection.getBalance(publicKey, "confirmed");
        if (isMounted) {
          setBalance(lamports / LAMPORTS_PER_SOL);
        }
      } catch (err) {
        console.warn("[Wallet] Failed to fetch balance:", err);
      }
    }

    fetchBalance();
    const interval = setInterval(fetchBalance, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [connected, publicKey, connection]);

  // If wallet is not connected
  if (!connected || !publicKey) {
    return (
      <button
        onClick={() => setVisible(true)}
        disabled={connecting}
        className={`px-3.5 py-1.5 rounded-md bg-white hover:bg-slate-200 text-black text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${className}`}
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        <span>{connecting ? "Connecting..." : "Connect Wallet"}</span>
      </button>
    );
  }

  // Connected state: truncated address + balance
  const pubkeyStr = publicKey.toBase58();
  const truncated = `${pubkeyStr.slice(0, 4)}...${pubkeyStr.slice(-4)}`;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {balance !== null && (
        <span className="text-[11px] font-mono px-2 py-1 rounded bg-[#0b0e14] text-slate-300 border border-[#1e2638]">
          {balance.toFixed(2)} SOL
        </span>
      )}
      <button
        onClick={() => disconnect()}
        title="Click to disconnect"
        className="px-3 py-1 rounded-md bg-[#121721] hover:bg-[#181f2c] border border-[#1e2638] hover:border-rose-500/40 text-xs font-mono text-white transition flex items-center gap-1.5 cursor-pointer group"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 group-hover:bg-rose-400"></span>
        <span>{truncated}</span>
        <span className="text-[10px] text-slate-500 group-hover:text-rose-400 ml-1">✕</span>
      </button>
    </div>
  );
}

export default WalletButton;
