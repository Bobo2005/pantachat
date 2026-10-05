"use client";

import React, { useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { isMobileDevice, isPhantomInjected, openInPhantomApp, openInSolflareApp } from "@/utils/mobileWallet";

export function WalletButton({ className = "" }: { className?: string }) {
  const { connected, connecting, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [showMobileModal, setShowMobileModal] = useState(false);

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

  const handleConnectClick = () => {
    if (isMobileDevice() && !isPhantomInjected()) {
      setShowMobileModal(true);
    } else {
      setVisible(true);
    }
  };

  // If wallet is not connected
  if (!connected || !publicKey) {
    return (
      <>
        <button
          onClick={handleConnectClick}
          disabled={connecting}
          className={`px-2.5 sm:px-3.5 py-1.5 rounded-md bg-white hover:bg-slate-200 text-black text-xs font-semibold font-mono transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 ${className}`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="hidden sm:inline">{connecting ? "Connecting..." : "Connect Wallet"}</span>
          <span className="sm:hidden">{connecting ? "..." : "Connect"}</span>
        </button>

        {/* Mobile Wallet Helper Modal for Android/iOS */}
        {showMobileModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-xs p-5 rounded-lg bg-[#121721] border border-[#1e2638] shadow-2xl flex flex-col gap-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-[#1e2638] pb-2">
                <span className="text-white font-semibold">Connect Solana Wallet</span>
                <button
                  onClick={() => setShowMobileModal(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-[11px] text-slate-400 font-sans">
                Open directly in your mobile wallet app for instant connection and 1-tap signing:
              </p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setShowMobileModal(false);
                    openInPhantomApp();
                  }}
                  className="w-full py-2.5 px-3 rounded bg-[#ab9ff2] hover:bg-[#9785ec] text-black font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-md transition"
                >
                  <span>🟣</span>
                  <span>Open in Phantom App</span>
                </button>

                <button
                  onClick={() => {
                    setShowMobileModal(false);
                    openInSolflareApp();
                  }}
                  className="w-full py-2 px-3 rounded bg-[#fc814a] hover:bg-[#e06d38] text-white font-semibold flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  <span>🟠</span>
                  <span>Open in Solflare App</span>
                </button>

                <button
                  onClick={() => {
                    setShowMobileModal(false);
                    setVisible(true);
                  }}
                  className="w-full py-2 px-3 rounded bg-[#181f2c] hover:bg-[#20293a] text-slate-300 border border-[#1e2638] flex items-center justify-center gap-2 cursor-pointer transition text-[11px]"
                >
                  <span>📱</span>
                  <span>Mobile Wallet Adapter (MWA)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Connected state: truncated address + balance
  const pubkeyStr = publicKey.toBase58();
  const truncated = `${pubkeyStr.slice(0, 4)}...${pubkeyStr.slice(-4)}`;

  return (
    <div className={`flex items-center gap-1.5 sm:gap-2 shrink-0 ${className}`}>
      {balance !== null && (
        <span className="hidden sm:inline-block text-[11px] font-mono px-2 py-1 rounded bg-[#0b0e14] text-slate-300 border border-[#1e2638]">
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
