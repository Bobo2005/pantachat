"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import Navbar from "@/components/Navbar";
import WalletButton from "@/components/WalletButton";
import { useTelegram } from "@/components/TelegramProvider";
import { sharePosition } from "@/utils/share";

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
  status: "open" | "won" | "lost" | "voided";
  resolvedOutcome?: "yes" | "no" | "void";
  resolutionStatus?: string;
  isClaimed: boolean;
  claimableUsdc?: number;
  txSignature?: string;
  oddsPercent?: number;
}

export default function PositionsPage() {
  const { connected, publicKey } = useWallet();
  const { isTelegram, user, switchInlineQuery } = useTelegram();
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchPositions = async () => {
    if (!publicKey) {
      setPositions([]);
      return;
    }

    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      let serverPositions: PositionItem[] = [];
      try {
        const res = await fetch(`${apiUrl}/api/positions?wallet=${publicKey.toBase58()}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          serverPositions = Array.isArray(data?.positions) ? data.positions : [];
        }
      } catch (serverErr) {
        console.warn("[Positions Page] Server fetch warning:", serverErr);
      }

      // Read local wallet positions saved upon trade execution
      let localPositions: PositionItem[] = [];
      try {
        const key = `panta_positions_${publicKey.toBase58()}`;
        const stored = localStorage.getItem(key);
        if (stored) {
          localPositions = JSON.parse(stored);
        }
      } catch (storageErr) {
        console.warn("[Positions Page] Local storage read error:", storageErr);
      }

      // Merge unique positions (prefer local with fresh signature if available)
      const merged: PositionItem[] = [...localPositions];
      for (const sp of serverPositions) {
        if (!merged.some((mp) => mp.id === sp.id || (mp.txSignature && mp.txSignature === sp.txSignature))) {
          merged.push(sp);
        }
      }

      // Cross-reference with live market catalog to evaluate settled resolutions
      try {
        const mRes = await fetch("/api/markets");
        if (mRes.ok) {
          const mData = await mRes.json();
          const marketList: any[] = Array.isArray(mData?.markets)
            ? mData.markets
            : Array.isArray(mData)
            ? mData
            : [];

          for (const pos of merged) {
            const matched = marketList.find(
              (m) =>
                m.id === pos.marketId ||
                (pos.marketTitle && pos.marketTitle !== "Prediction Market" && m.title === pos.marketTitle)
            );

            if (matched) {
              if (matched.title && (!pos.marketTitle || pos.marketTitle === "Prediction Market")) {
                pos.marketTitle = matched.title;
              }
              if (matched.category && (!pos.category || pos.category === "Crypto")) {
                pos.category = matched.category;
              }
              pos.resolvedOutcome = matched.resolvedOutcome;
              pos.resolutionStatus = matched.resolutionStatus;

              const yesPct =
                typeof matched.yesPercent === "number"
                  ? matched.yesPercent
                  : Math.round((Number(matched.yesPrice) || 0.5) * 100);
              const noPct = 100 - yesPct;
              pos.oddsPercent = pos.outcome === "yes" ? yesPct : noPct;
            }

            if (
              matched &&
              (matched.phase === "resolved" ||
                matched.resolvedOutcome ||
                matched.resolved_outcome ||
                matched.resolutionStatus === "resolved" ||
                matched.resolutionStatus === "void")
            ) {
              let rawWin = (
                matched.resolvedOutcome ||
                matched.resolved_outcome ||
                (matched.resolutionStatus === "void" ? "void" : "")
              )?.toLowerCase();

              // Safe fallback for resolved markets
              if (!rawWin && matched.phase === "resolved") {
                rawWin = "void";
              }

              const userOutcome = (pos.outcome || "").toLowerCase();

              if (rawWin === "void" || matched.resolutionStatus === "void") {
                pos.status = "voided";
                pos.claimableUsdc = pos.costUsdc; // 100% refund safety net
                pos.currentValueUsdc = pos.costUsdc;
                pos.pnlUsdc = 0;
                pos.pnlPercent = 0;
              } else if (rawWin && userOutcome === rawWin) {
                pos.status = "won";
                pos.claimableUsdc = pos.shares * 1.0; // 1 winning share pays out $1.00 USDC
                pos.currentValueUsdc = pos.shares * 1.0;
                pos.pnlUsdc = pos.shares - pos.costUsdc;
                pos.pnlPercent =
                  pos.costUsdc > 0
                    ? ((pos.shares - pos.costUsdc) / pos.costUsdc) * 100
                    : 0;
              } else if (rawWin && userOutcome !== rawWin) {
                pos.status = "lost";
                pos.claimableUsdc = 0;
                pos.currentValueUsdc = 0;
                pos.pnlUsdc = -pos.costUsdc;
                pos.pnlPercent = -100;
              }
            }
          }
        }
      } catch (crossErr) {
        console.warn("[Positions Page] Resolution cross-reference error:", crossErr);
      }

      setPositions(merged);
    } catch (err) {
      console.warn("Could not fetch wallet positions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, [publicKey, connected]);

  const claimableList = positions.filter(
    (p) => (p.status === "won" || p.status === "voided") && !p.isClaimed
  );
  const totalClaimableUsdc = claimableList.reduce((acc, p) => acc + (p.claimableUsdc || 0), 0);
  const totalPortfolioValue = positions.reduce((acc, p) => acc + p.currentValueUsdc, 0);

  const handleClaim = (marketId: string) => {
    const sessionId = `sess_claim_${Date.now()}`;
    window.location.href = `/sign?session=${sessionId}&type=claim&market=${marketId}`;
  };

  const handleSharePos = async (pos: PositionItem) => {
    const odds = pos.oddsPercent || 50;
    const userHandle =
      user?.username ||
      (publicKey
        ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
        : "trader");

    const res = await sharePosition({
      marketId: pos.marketId,
      marketTitle: pos.marketTitle,
      outcome: pos.outcome,
      spendUsdc: pos.costUsdc || 20,
      oddsPercent: odds,
      userHandle,
      isTelegram,
      switchInlineQuery,
    });

    if (res.message) {
      showToast(res.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-[#f8fafc] flex flex-col justify-between font-sans selection:bg-[#38bdf8]/20 selection:text-white pb-20 md:pb-12">
      <Navbar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-5 py-5 sm:py-8 flex flex-col gap-4 sm:gap-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 border-b border-[#1e2638] pb-4 sm:pb-5">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading font-bold text-xl sm:text-2xl text-white">Your Portfolio & Claims</h1>
            <p className="text-[11px] sm:text-xs text-slate-400 font-mono">
              Non-custodial positions and claimable payouts across Telegram & Discord
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="panta-card-subtle px-3 py-1.5 flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400">Portfolio Value:</span>
              <span className="font-bold text-white">${totalPortfolioValue.toFixed(2)} USDC</span>
            </div>
            {connected && (
              <button
                onClick={fetchPositions}
                className="px-2.5 py-1.5 rounded bg-[#181f2c] hover:bg-[#20293a] border border-[#1e2638] text-xs font-mono text-slate-300 transition cursor-pointer"
                title="Refresh Positions"
              >
                🔄
              </button>
            )}
          </div>
        </div>

        {/* Claimable Highlight Callout */}
        {totalClaimableUsdc > 0 && (
          <div className="border border-emerald-500/30 bg-[#121721] rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg font-bold shrink-0">
                💰
              </div>
              <div>
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>Payouts & Refunds Ready to Claim</span>
                  <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Non-Custodial Claim
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  You have <span className="text-white font-bold">${totalClaimableUsdc.toFixed(2)} USDC</span> in claimable winnings/refunds waiting on Solana.
                </div>
              </div>
            </div>

            <button
              onClick={() => handleClaim(claimableList[0].marketId)}
              className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer font-mono"
            >
              <span>[ Claim USDC ]</span>
            </button>
          </div>
        )}

        {/* Content States */}
        {!connected ? (
          <div className="panta-card p-12 text-center flex flex-col items-center justify-center gap-4 bg-[#121721] rounded-lg border border-[#1e2638]">
            <div className="w-12 h-12 rounded-full bg-[#181f2c] border border-[#1e2638] flex items-center justify-center text-xl">
              👛
            </div>
            <div className="flex flex-col gap-1 max-w-sm">
              <h3 className="text-white font-heading font-semibold text-base">Connect Your Solana Wallet</h3>
              <p className="text-xs text-slate-400 font-mono">
                Connect your Phantom or Solflare wallet to view your active predictions and claim your payouts.
              </p>
            </div>
            <div className="pt-2">
              <WalletButton />
            </div>
          </div>
        ) : isLoading ? (
          <div className="panta-card p-12 flex flex-col items-center justify-center gap-3 bg-[#121721] rounded-lg border border-[#1e2638]">
            <div className="w-6 h-6 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-mono text-slate-400">Loading wallet positions from Solana...</span>
          </div>
        ) : positions.length === 0 ? (
          <div className="panta-card p-12 text-center flex flex-col items-center justify-center gap-4 bg-[#121721] rounded-lg border border-[#1e2638]">
            <div className="w-12 h-12 rounded-full bg-[#181f2c] border border-[#1e2638] flex items-center justify-center text-xl">
              📊
            </div>
            <div className="flex flex-col gap-1 max-w-sm">
              <h3 className="text-white font-heading font-semibold text-base">No Active Positions Found</h3>
              <p className="text-xs text-slate-400 font-mono">
                You haven&apos;t placed any prediction bets yet. Type <span className="text-[#38bdf8]">/market</span> in Telegram or browse the Explorer to trade.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="/"
                className="px-4 py-2 bg-[#38bdf8] text-black font-semibold text-xs rounded font-mono hover:bg-[#0ea5e9] transition"
              >
                Browse Markets
              </a>
              <a
                href="https://t.me/pantachat_bot"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-[#181f2c] text-white border border-[#1e2638] text-xs rounded font-mono hover:bg-[#20293a] transition"
              >
                ✈️ Trade via Telegram
              </a>
            </div>
          </div>
        ) : (
          /* Responsive Positions: Mobile Card Feed + Desktop Data Table */
          <>
            {/* Mobile Card Feed (md:hidden) */}
            <div className="md:hidden flex flex-col gap-3">
              {positions.map((pos) => {
                const isClaimable = (pos.status === "won" || pos.status === "voided") && !pos.isClaimed;

                return (
                  <div
                    key={pos.id}
                    className="panta-card p-4 rounded-xl border border-[#1e2638] bg-[#121721] flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 bg-[#0b0e14] px-2 py-0.5 rounded border border-[#1e2638]">
                        {pos.category}
                      </span>
                      {pos.status === "voided" || pos.resolvedOutcome === "void" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                          ⚪ Settled: VOID (Canceled)
                        </span>
                      ) : pos.resolvedOutcome === "yes" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                          🟢 Settled: YES WON
                        </span>
                      ) : pos.resolvedOutcome === "no" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30 whitespace-nowrap">
                          🟣 Settled: NO WON
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 whitespace-nowrap">
                          ⏳ In Progress
                        </span>
                      )}
                    </div>

                    <h3 className="font-heading font-semibold text-sm text-white leading-snug">
                      {pos.marketTitle}
                    </h3>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-[#0b0e14] border border-[#1e2638] text-xs font-mono">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase">My Stance</span>
                        <span
                          className={`font-bold mt-0.5 ${
                            pos.outcome === "yes" ? "text-[#38bdf8]" : "text-[#c084fc]"
                          }`}
                        >
                          {pos.outcome.toUpperCase()} ({pos.shares.toFixed(1)} shares)
                        </span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase">Payout Status</span>
                        <div className="mt-0.5">
                          {pos.status === "voided" && !pos.isClaimed ? (
                            <span className="text-[11px] font-bold text-amber-300">
                              ⚪ 100% Refund Ready
                            </span>
                          ) : pos.status === "voided" && pos.isClaimed ? (
                            <span className="text-[11px] font-bold text-slate-400">
                              ⚪ Refund Claimed ✓
                            </span>
                          ) : isClaimable ? (
                            <span className="text-[11px] font-bold text-emerald-400">
                              🏆 Won ($1.00/share)
                            </span>
                          ) : pos.status === "won" && pos.isClaimed ? (
                            <span className="text-[11px] font-bold text-emerald-400">
                              🟢 Won • Claimed ✓
                            </span>
                          ) : pos.status === "lost" ? (
                            <span className="text-[11px] font-bold text-rose-400/80">
                              🔴 Lost
                            </span>
                          ) : (
                            <span className="text-[11px] text-sky-400">
                              🔵 Active
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col pt-1.5 border-t border-[#1e2638]">
                        <span className="text-[10px] text-slate-500 uppercase">Cost / Value</span>
                        <span className="text-white font-medium mt-0.5">
                          ${pos.costUsdc.toFixed(2)} → ${pos.currentValueUsdc.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex flex-col pt-1.5 border-t border-[#1e2638]">
                        <span className="text-[10px] text-slate-500 uppercase">Return (PnL)</span>
                        <span className={`mt-0.5 font-bold ${pos.pnlUsdc >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {pos.pnlUsdc >= 0 ? "+" : ""}${pos.pnlUsdc.toFixed(2)} ({pos.pnlPercent.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      {isClaimable ? (
                        <button
                          onClick={() => handleClaim(pos.marketId)}
                          className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs font-mono transition shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <span>
                            {pos.status === "voided"
                              ? `💰 Claim 100% Refund ($${(pos.claimableUsdc || pos.costUsdc).toFixed(2)})`
                              : `💰 Claim Winnings ($${(pos.claimableUsdc || pos.shares).toFixed(2)})`}
                          </span>
                        </button>
                      ) : null}
                      <button
                        onClick={() => handleSharePos(pos)}
                        className={`${
                          isClaimable ? "px-3.5" : "w-full"
                        } py-2 rounded-lg bg-[#181f2c] hover:bg-[#20293a] border border-[#1e2638] hover:border-[#38bdf8]/40 text-slate-200 text-xs font-mono font-medium transition cursor-pointer flex items-center justify-center gap-1.5`}
                      >
                        <span>📤</span>
                        <span>Share Position</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Data Table (hidden md:block) */}
            <div className="hidden md:block panta-card overflow-hidden border border-[#1e2638] rounded-lg bg-[#121721]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#0b0e14] text-slate-400 uppercase text-[10px] tracking-wider border-b border-[#1e2638]">
                    <tr>
                      <th className="py-3 px-4">Market</th>
                      <th className="py-3 px-4">My Bet</th>
                      <th className="py-3 px-4">Settled Result</th>
                      <th className="py-3 px-4">Shares</th>
                      <th className="py-3 px-4">Cost</th>
                      <th className="py-3 px-4">Value</th>
                      <th className="py-3 px-4">PnL</th>
                      <th className="py-3 px-4 text-right">Status / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#181f2c]">
                    {positions.map((pos) => {
                      const isClaimable = (pos.status === "won" || pos.status === "voided") && !pos.isClaimed;

                      return (
                        <tr key={pos.id} className="hover:bg-[#151c27] transition">
                          <td className="py-3.5 px-4 font-sans text-white max-w-xs">
                            <div className="text-[11px] text-slate-500 font-mono mb-0.5">{pos.category}</div>
                            <div className="font-medium line-clamp-1">{pos.marketTitle}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                pos.outcome === "yes"
                                   ? "bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/20"
                                   : "bg-[#c084fc]/10 text-[#c084fc] border border-[#c084fc]/20"
                              }`}
                            >
                              {pos.outcome.toUpperCase()}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            {pos.status === "voided" || pos.resolvedOutcome === "void" ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                                ⚪ VOID (Canceled)
                              </span>
                            ) : pos.resolvedOutcome === "yes" ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                                🟢 YES WON
                              </span>
                            ) : pos.resolvedOutcome === "no" ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30 whitespace-nowrap">
                                🟣 NO WON
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 whitespace-nowrap">
                                ⏳ In Progress
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-slate-300 font-medium">
                            {pos.shares.toFixed(2)}
                          </td>

                          <td className="py-3.5 px-4 text-slate-400">
                            ${pos.costUsdc.toFixed(2)}
                          </td>

                          <td className="py-3.5 px-4 text-white font-semibold">
                            ${pos.currentValueUsdc.toFixed(2)}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={pos.pnlUsdc >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                              {pos.pnlUsdc >= 0 ? "+" : ""}${pos.pnlUsdc.toFixed(2)} ({pos.pnlPercent.toFixed(1)}%)
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isClaimable ? (
                                <button
                                  onClick={() => handleClaim(pos.marketId)}
                                  className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-[11px] rounded transition shadow-md shadow-emerald-500/20 cursor-pointer"
                                >
                                  {pos.status === "voided"
                                    ? `💰 Claim 100% Refund ($${(pos.claimableUsdc || pos.costUsdc).toFixed(2)})`
                                    : `💰 Claim Winnings ($${(pos.claimableUsdc || pos.shares).toFixed(2)})`}
                                </button>
                              ) : pos.status === "voided" && pos.isClaimed ? (
                                <span className="text-slate-400 text-[11px] font-medium">⚪ Refund Claimed ✓</span>
                              ) : pos.status === "won" && pos.isClaimed ? (
                                <span className="text-emerald-400 text-[11px] font-bold">🟢 Won • Claimed ✓</span>
                              ) : pos.status === "lost" ? (
                                <span className="text-rose-400/80 text-[11px] font-medium">🔴 Lost</span>
                              ) : (
                                <span className="text-sky-400 text-[11px]">🔵 Active</span>
                              )}

                              <button
                                onClick={() => handleSharePos(pos)}
                                title="Share Position to Telegram or Discord"
                                className="px-2.5 py-1 bg-[#181f2c] hover:bg-[#20293a] border border-[#1e2638] hover:border-[#38bdf8]/50 text-slate-300 hover:text-white text-[11px] rounded transition cursor-pointer flex items-center gap-1"
                              >
                                <span>📤</span>
                                <span>Share</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#121721] text-white border border-[#38bdf8]/50 shadow-xl shadow-[#38bdf8]/10 px-4 py-2.5 rounded-lg text-xs font-mono flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span>{toastMessage}</span>
        </div>
      )}

      <footer className="w-full border-t border-[#1e2638] py-4 text-center text-xs font-mono text-slate-500">
        PantaChat • Built with Panta Protocol on Solana Devnet • Colosseum Renaissance Hackathon
      </footer>
    </div>
  );
}
