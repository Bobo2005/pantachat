"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import Navbar from "@/components/Navbar";
import WalletButton from "@/components/WalletButton";

export interface SpawnedMarket {
  id: string;
  title: string;
  category: "Crypto" | "Sports" | "Macroeconomics" | "Pop Culture" | "Stocks" | "Tech";
  source: string;
  createdAt: string;
  volumeUsdc: number;
  graduationThresholdUsdc: number;
  status: "bonding" | "graduated" | "resolved";
  creatorRoyaltyUsdc: number;
  claimableRoyaltyUsdc: number;
  isClaimed: boolean;
}

export default function CreatorEarningsPage() {
  const { connected, publicKey } = useWallet();
  const [markets, setMarkets] = useState<SpawnedMarket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "graduated" | "bonding">("all");

  const fetchEarnings = async () => {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const walletQuery = publicKey ? `?wallet=${publicKey.toBase58()}` : "";
      const res = await fetch(`${apiUrl}/api/earnings${walletQuery}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setMarkets(Array.isArray(data?.markets) ? data.markets : []);
      }
    } catch (err) {
      console.warn("Could not fetch creator earnings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, [publicKey, connected]);

  const totalSpawned = markets.length;
  const totalVolume = markets.reduce((acc, m) => acc + m.volumeUsdc, 0);
  const totalRoyalties = markets.reduce((acc, m) => acc + m.creatorRoyaltyUsdc, 0);
  const claimableRoyalties = markets.reduce((acc, m) => acc + (m.isClaimed ? 0 : m.claimableRoyaltyUsdc), 0);
  const graduatedCount = markets.filter((m) => m.status === "graduated").length;

  const filteredMarkets = markets.filter((m) => {
    if (filter === "graduated") return m.status === "graduated";
    if (filter === "bonding") return m.status === "bonding";
    return true;
  });

  const handleClaim = (marketId: string) => {
    const sessionId = `sess_claim_creator_${Date.now()}`;
    window.location.href = `/sign?session=${sessionId}&type=claim_creator&market=${marketId}`;
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-[#f8fafc] flex flex-col justify-between font-sans selection:bg-[#38bdf8]/20 selection:text-white pb-12">
      <Navbar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-5 py-8 flex flex-col gap-6">
        {/* Header & Colosseum Badge */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e2638] pb-5">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500/20 to-cyan-500/20 text-[#38bdf8] border border-[#38bdf8]/30">
                ⚡ Powered by Panta • Built for Colosseum
              </span>
            </div>
            <h1 className="font-heading font-bold text-2xl text-white">Creator Royalties Hub</h1>
            <p className="text-xs text-slate-400 font-mono">
              Track prediction markets spawned from Telegram & Discord, monitor graduation volume, and claim creator royalties.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="panta-card-subtle px-3 py-1.5 flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400">Claimable Royalties:</span>
              <span className="font-bold text-emerald-400">${claimableRoyalties.toFixed(2)} USDC</span>
            </div>
            <button
              onClick={fetchEarnings}
              className="px-2.5 py-1.5 rounded bg-[#181f2c] hover:bg-[#20293a] border border-[#1e2638] text-xs font-mono text-slate-300 transition cursor-pointer"
              title="Refresh Royalties"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Claimable Highlight Banner */}
        {claimableRoyalties > 0 && (
          <div className="border border-emerald-500/30 bg-[#121721] rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg font-bold shrink-0">
                ⚡
              </div>
              <div>
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>Graduated Market Royalties Ready</span>
                  <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Graduated Secondary
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  You have <span className="text-white font-bold">${claimableRoyalties.toFixed(2)} USDC</span> accumulated in creator trading fees across graduated markets.
                </div>
              </div>
            </div>

            <button
              onClick={() => handleClaim(markets.find((m) => m.claimableRoyaltyUsdc > 0)?.id || "all")}
              className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer font-mono"
            >
              <span>[ ⚡ Claim Creator Royalty ]</span>
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="panta-card-subtle p-4 flex flex-col gap-1">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Markets Spawned</span>
            <span className="font-heading font-bold text-xl text-white">{totalSpawned}</span>
            <span className="text-[10px] font-mono text-slate-500">Via Telegram & Discord</span>
          </div>

          <div className="panta-card-subtle p-4 flex flex-col gap-1">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Total Volume Driven</span>
            <span className="font-heading font-bold text-xl text-white">${totalVolume.toLocaleString()}</span>
            <span className="text-[10px] font-mono text-cyan-400">Devnet USDC</span>
          </div>

          <div className="panta-card-subtle p-4 flex flex-col gap-1">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Accumulated Royalties</span>
            <span className="font-heading font-bold text-xl text-emerald-400">${totalRoyalties.toFixed(2)}</span>
            <span className="text-[10px] font-mono text-slate-500">0.50% bonding fee cut</span>
          </div>

          <div className="panta-card-subtle p-4 flex flex-col gap-1">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Graduated Markets</span>
            <span className="font-heading font-bold text-xl text-purple-400">{graduatedCount} / {totalSpawned || 1}</span>
            <span className="text-[10px] font-mono text-purple-300/70">Secondary CP-Swap Pools</span>
          </div>
        </div>

        {isLoading ? (
          <div className="panta-card p-12 flex flex-col items-center justify-center gap-3 bg-[#121721] rounded-lg border border-[#1e2638]">
            <div className="w-6 h-6 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-mono text-slate-400">Loading creator markets and volume...</span>
          </div>
        ) : markets.length === 0 ? (
          /* Clean Empty State */
          <div className="panta-card p-12 text-center flex flex-col items-center justify-center gap-4 bg-[#121721] rounded-lg border border-[#1e2638]">
            <div className="w-12 h-12 rounded-full bg-[#181f2c] border border-[#1e2638] flex items-center justify-center text-xl">
              ⚡
            </div>
            <div className="flex flex-col gap-1 max-w-md">
              <h3 className="text-white font-heading font-semibold text-base">No Markets Spawned Yet</h3>
              <p className="text-xs text-slate-400 font-mono">
                You haven&apos;t created any prediction markets yet. Start a discussion in Telegram and type <span className="text-[#38bdf8]">/market</span> or right-click any message in Discord to spawn a market and earn 0.50% royalties.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://t.me/pantachat_bot"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-[#38bdf8] text-black font-semibold text-xs rounded font-mono hover:bg-[#0ea5e9] transition"
              >
                ✈️ Spawn Market in Telegram
              </a>
              <button
                onClick={fetchEarnings}
                className="px-4 py-2 bg-[#181f2c] text-white border border-[#1e2638] text-xs rounded font-mono hover:bg-[#20293a] transition cursor-pointer"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Filter Pills */}
            <div className="flex items-center justify-between gap-4 border-b border-[#1e2638] pb-3">
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <button
                  onClick={() => setFilter("all")}
                  className={`px-3 py-1 rounded transition cursor-pointer ${
                    filter === "all" ? "bg-[#181f2c] text-white border border-[#1e2638]" : "text-slate-400 hover:text-white"
                  }`}
                >
                  All Spawned ({markets.length})
                </button>
                <button
                  onClick={() => setFilter("graduated")}
                  className={`px-3 py-1 rounded transition cursor-pointer ${
                    filter === "graduated" ? "bg-[#181f2c] text-purple-300 border border-purple-500/30" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Graduated ({graduatedCount})
                </button>
                <button
                  onClick={() => setFilter("bonding")}
                  className={`px-3 py-1 rounded transition cursor-pointer ${
                    filter === "bonding" ? "bg-[#181f2c] text-emerald-300 border border-emerald-500/30" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Bonding Curve ({markets.length - graduatedCount})
                </button>
              </div>

              <div className="text-[11px] font-mono text-slate-500 hidden sm:block">
                Graduation target: $10,000 Volume
              </div>
            </div>

            {/* Markets List */}
            <div className="flex flex-col gap-3">
              {filteredMarkets.map((market) => {
                const progress = Math.min(100, (market.volumeUsdc / market.graduationThresholdUsdc) * 100);
                const isGraduated = market.status === "graduated" || market.volumeUsdc >= market.graduationThresholdUsdc;

                return (
                  <div
                    key={market.id}
                    className="panta-card p-5 flex flex-col gap-4 border border-[#1e2638] hover:border-[#2a344d] transition bg-[#121721] rounded-lg"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-400 px-2 py-0.5 bg-[#181f2c] rounded border border-[#1e2638]">
                          {market.category}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          from {market.source}
                        </span>
                        <span className="text-[11px] font-mono text-slate-600">• {market.createdAt}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isGraduated ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                            Graduated Secondary
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            Primary Bonding Curve
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-heading font-semibold text-base text-white">
                        {market.title}
                      </h3>
                    </div>

                    {/* Graduation Progress Bar */}
                    <div className="flex flex-col gap-1.5 bg-[#0b0e14] p-3 rounded border border-[#181f2c]">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <span>Graduation Status:</span>
                          <span className={isGraduated ? "text-purple-400 font-bold" : "text-white font-medium"}>
                            ${market.volumeUsdc.toLocaleString()} / ${market.graduationThresholdUsdc.toLocaleString()} Volume
                          </span>
                        </span>
                        <span className={isGraduated ? "text-purple-400 font-bold" : "text-slate-300"}>
                          {progress.toFixed(1)}%
                        </span>
                      </div>

                      <div className="w-full h-2 rounded-full bg-[#181f2c] overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isGraduated
                              ? "bg-gradient-to-r from-purple-500 to-indigo-500"
                              : "bg-gradient-to-r from-emerald-500 to-cyan-500"
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="text-[10px] font-mono text-slate-500 flex justify-between items-center pt-0.5">
                        <span>
                          {isGraduated
                            ? "Migrated to Raydium CP-Swap / OpenBook CLOB"
                            : `$${(market.graduationThresholdUsdc - market.volumeUsdc).toLocaleString()} volume remaining until secondary migration`}
                        </span>
                        <span>Fee Rate: 0.50%</span>
                      </div>
                    </div>

                    {/* Bottom Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-[#181f2c]">
                      <div className="flex items-center gap-5 text-xs font-mono">
                        <div>
                          <span className="text-slate-500">Total Royalties Earned: </span>
                          <span className="text-white font-bold">${market.creatorRoyaltyUsdc.toFixed(2)} USDC</span>
                        </div>

                        <div>
                          <span className="text-slate-500">Unclaimed: </span>
                          <span className={market.claimableRoyaltyUsdc > 0 && !market.isClaimed ? "text-emerald-400 font-bold" : "text-slate-400"}>
                            ${(market.isClaimed ? 0 : market.claimableRoyaltyUsdc).toFixed(2)} USDC
                          </span>
                        </div>
                      </div>

                      <div>
                        {isGraduated && market.claimableRoyaltyUsdc > 0 && !market.isClaimed ? (
                          <button
                            onClick={() => handleClaim(market.id)}
                            className="w-full sm:w-auto px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition font-mono flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/10"
                          >
                            <span>[ ⚡ Claim Creator Royalty ]</span>
                          </button>
                        ) : market.isClaimed ? (
                          <span className="text-xs font-mono text-slate-500 flex items-center gap-1 px-3 py-1 bg-[#181f2c] rounded border border-[#1e2638]">
                            <span>✓</span> Claimed
                          </span>
                        ) : (
                          <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                            <span>⏳</span> Accruing on curve
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Creator Economics Box */}
        <div className="panta-card-subtle p-5 rounded-lg border border-[#1e2638] flex flex-col gap-2 font-mono text-xs text-slate-400">
          <div className="text-white font-semibold text-sm flex items-center gap-2">
            <span>ℹ️</span>
            <span>How Panta Creator Royalties Work</span>
          </div>
          <p className="leading-relaxed">
            Every prediction market created via PantaChat Telegram inline queries or Discord context menu earns you an attribution cut:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px] pt-1">
            <li>
              <strong className="text-slate-200">0.50% Primary Curve Royalty:</strong> Accrued continuously on all bonding curve buy and sell volume.
            </li>
            <li>
              <strong className="text-slate-200">$10,000 Graduation:</strong> Once a market reaches $10,000 in volume, liquidity automatically migrates to Raydium CP-Swap.
            </li>
            <li>
              <strong className="text-slate-200">Non-Custodial Claiming:</strong> Royalties are sent directly to your connected Solana Devnet wallet in a 1-click transaction.
            </li>
          </ul>
        </div>
      </main>

      <footer className="w-full border-t border-[#1e2638] py-4 text-center text-xs font-mono text-slate-500">
        PantaChat • Built with Panta Protocol on Solana Devnet • Colosseum Renaissance Hackathon
      </footer>
    </div>
  );
}
