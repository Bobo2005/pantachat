"use client";

import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import Navbar from "@/components/Navbar";
import WalletButton from "@/components/WalletButton";

export interface PositionItem {
  id: string;
  marketId: string;
  marketTitle: string;
  category: string;
  outcome: "yes" | "no";
  shares: number;
  costUsdc: number;
  currentValueUsdc: number;
  pnlUsdc: number;
  pnlPercent: number;
  status: "open" | "won" | "lost";
  isClaimed: boolean;
  claimableUsdc?: number;
}

const DEMO_POSITIONS: PositionItem[] = [
  {
    id: "pos_1",
    marketId: "mkt_sol_eth",
    marketTitle: "Will Solana (SOL) flip Ethereum in market cap before 2027?",
    category: "Crypto",
    outcome: "yes",
    shares: 31.25,
    costUsdc: 20.0,
    currentValueUsdc: 22.4,
    pnlUsdc: 2.4,
    pnlPercent: 12.0,
    status: "open",
    isClaimed: false,
  },
  {
    id: "pos_2",
    marketId: "mkt_bbn_female",
    marketTitle: "Will a female housemate win Big Brother Naija Season 11?",
    category: "Pop Culture",
    outcome: "yes",
    shares: 40.0,
    costUsdc: 20.0,
    currentValueUsdc: 40.0,
    pnlUsdc: 20.0,
    pnlPercent: 100.0,
    status: "won",
    isClaimed: false,
    claimableUsdc: 40.0,
  },
  {
    id: "pos_3",
    marketId: "mkt_fed_cuts",
    marketTitle: "Will the US Federal Reserve cut rates by 50bps at the next FOMC?",
    category: "Stocks",
    outcome: "no",
    shares: 16.12,
    costUsdc: 10.0,
    currentValueUsdc: 11.2,
    pnlUsdc: 1.2,
    pnlPercent: 12.0,
    status: "open",
    isClaimed: false,
  },
];

export default function PositionsPage() {
  const { connected, publicKey } = useWallet();
  const [positions, setPositions] = useState<PositionItem[]>(DEMO_POSITIONS);

  const claimableList = positions.filter((p) => p.status === "won" && !p.isClaimed);
  const totalClaimableUsdc = claimableList.reduce((acc, p) => acc + (p.claimableUsdc || 0), 0);
  const totalPortfolioValue = positions.reduce((acc, p) => acc + p.currentValueUsdc, 0);

  const handleClaim = (marketId: string) => {
    const sessionId = `sess_claim_${Date.now()}`;
    window.location.href = `/sign?session=${sessionId}&type=claim&market=${marketId}`;
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-[#f8fafc] flex flex-col justify-between font-sans selection:bg-[#38bdf8]/20 selection:text-white pb-12">
      <Navbar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-5 py-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e2638] pb-5">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading font-bold text-2xl text-white">Your Portfolio & Claims</h1>
            <p className="text-xs text-slate-400 font-mono">
              Non-custodial positions and claimable payouts across Telegram & Discord
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="panta-card-subtle px-3 py-1.5 flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400">Portfolio Value:</span>
              <span className="font-bold text-white">${totalPortfolioValue.toFixed(2)} USDC</span>
            </div>
            {!connected && <WalletButton />}
          </div>
        </div>

        {/* ================================================================== */}
        {/* Highlight Section: Claimable Winnings */}
        {/* ================================================================== */}
        {claimableList.length > 0 && (
          <div className="panta-card p-5 border-emerald-500/30 bg-emerald-950/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl shrink-0">
                💰
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-heading font-semibold text-emerald-300 text-sm">
                  You Have Claimable Prediction Winnings!
                </span>
                <p className="text-xs text-slate-400">
                  {claimableList.length} resolved market payout ready to claim on Solana Devnet.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
              <span className="font-mono text-base font-bold text-emerald-400">
                +${totalClaimableUsdc.toFixed(2)} USDC
              </span>
              <button
                onClick={() => handleClaim(claimableList[0].marketId)}
                className="px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold font-mono transition shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer"
              >
                Claim Payout USDC ↗
              </button>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* Table of Active Holdings */}
        {/* ================================================================== */}
        <div className="panta-card overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1e2638] flex items-center justify-between text-xs">
            <span className="font-semibold text-white uppercase tracking-wider font-mono">
              Active Holdings ({positions.length})
            </span>
            <span className="text-slate-500 font-mono text-[11px]">Auto-Synced with Solana RPC</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0b0e14] text-slate-400 text-[11px] border-b border-[#1e2638]">
                <tr>
                  <th className="py-3 px-4">Market</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4">Shares</th>
                  <th className="py-3 px-4">Cost (USDC)</th>
                  <th className="py-3 px-4">Value (USDC)</th>
                  <th className="py-3 px-4">PnL</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2638]">
                {positions.map((pos) => {
                  const isPositive = pos.pnlUsdc >= 0;
                  return (
                    <tr key={pos.id} className="hover:bg-[#181f2c]/50 transition">
                      <td className="py-3.5 px-4 font-sans font-medium text-white max-w-xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-mono text-slate-500 uppercase">{pos.category}</span>
                          <span className="truncate">{pos.marketTitle}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            pos.outcome === "yes"
                              ? "bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/30"
                              : "bg-[#c084fc]/10 text-[#c084fc] border border-[#c084fc]/30"
                          }`}
                        >
                          {pos.outcome.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">{pos.shares.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-slate-300">${pos.costUsdc.toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-white font-medium">${pos.currentValueUsdc.toFixed(2)}</td>
                      <td className="py-3.5 px-4">
                        <span className={isPositive ? "text-emerald-400 font-medium" : "text-rose-400"}>
                          {isPositive ? "+" : ""}${pos.pnlUsdc.toFixed(2)} ({isPositive ? "+" : ""}
                          {pos.pnlPercent.toFixed(1)}%)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {pos.status === "won" && !pos.isClaimed ? (
                          <button
                            onClick={() => handleClaim(pos.marketId)}
                            className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium transition cursor-pointer"
                          >
                            Claim
                          </button>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Open</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
