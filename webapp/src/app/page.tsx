"use client";

import React, { useState, useEffect, useMemo } from "react";
import Navbar from "@/components/Navbar";
import { getAllLiveMarkets } from "@/lib/markets";

// =============================================================================
// Market Data Interfaces
// =============================================================================

export interface MarketItem {
  id: string;
  category: "Crypto" | "Sports" | "Stocks" | "Macroeconomics" | "Politics" | "Pop Culture";
  timestamp: string;
  title: string;
  yesPercent: number;
  noPercent: number;
  yesPrice: number;
  noPrice: number;
  volume: string;
  volumeRaw: number;
  creator: string;
  phase: "primary" | "secondary" | "resolved";
  description?: string;
}

const CATEGORIES = ["All", "Crypto", "Sports", "Stocks", "Macroeconomics", "Pop Culture"];

function formatMarketEntry(m: any): MarketItem {
  const yesP = typeof m.yesPrice === "number" ? m.yesPrice : 0.5;
  const noP = typeof m.noPrice === "number" ? m.noPrice : 0.5;
  const yesPct = typeof m.yesPercent === "number" ? m.yesPercent : Math.round(yesP * 100);
  const noPct = typeof m.noPercent === "number" ? m.noPercent : Math.round(noP * 100);
  const volRaw = typeof m.volumeUsdc === "number" ? m.volumeUsdc : (m.volumeRaw || 0);

  return {
    id: String(m.id),
    category: (m.category as any) || "Crypto",
    timestamp: m.createdAt || "Recent",
    title: m.title || "Prediction Market",
    yesPercent: yesPct,
    noPercent: noPct,
    yesPrice: yesP,
    noPrice: noP,
    volume: `$${volRaw.toLocaleString()} VOL`,
    volumeRaw: volRaw,
    creator: m.creator || "PantaChat",
    phase: (m.phase as any) || "primary",
    description: m.description,
  };
}

export default function MarketExplorer() {
  // Pre-seed with live markets so page renders markets instantly on first load
  const [markets, setMarkets] = useState<MarketItem[]>(() =>
    getAllLiveMarkets().map(formatMarketEntry)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [chartMode, setChartMode] = useState<"price" | "volume">("price");
  const [timeframe, setTimeframe] = useState("7D");

  // Quick Buy Modal State
  const [activeModalMarket, setActiveModalMarket] = useState<MarketItem | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<"yes" | "no">("yes");
  const [spendAmount, setSpendAmount] = useState<number>(20);

  // Fetch Real Dynamic Markets from Backend / Panta Protocol
  const fetchMarkets = async () => {
    try {
      const res = await fetch("/api/markets", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data?.markets)
          ? data.markets
          : (Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []));
        if (list.length > 0) {
          setMarkets(list.map(formatMarketEntry));
        }
      }
    } catch (err) {
      console.warn("Could not load dynamic markets from backend:", err);
    }
  };

  useEffect(() => {
    fetchMarkets();
  }, []);

  // Filtered Markets
  const filteredMarkets = useMemo(() => {
    return markets.filter((m) => {
      const matchesCategory =
        selectedCategory === "All" || m.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.creator.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [markets, selectedCategory, searchQuery]);

  const heroMarket = filteredMarkets[0] || markets[0] || null;

  // Open Quick Buy Modal Helper
  const openBuyModal = (market: MarketItem, outcome: "yes" | "no" = "yes") => {
    setActiveModalMarket(market);
    setSelectedOutcome(outcome);
    setSpendAmount(20);
  };

  const handleProceedToSign = () => {
    if (!activeModalMarket) return;
    const sessionId = `sess_buy_${Date.now()}`;
    window.location.href = `/sign?session=${sessionId}&market=${activeModalMarket.id}&outcome=${selectedOutcome}&amount=${spendAmount}`;
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-[#f8fafc] flex flex-col justify-between font-sans selection:bg-[#38bdf8]/20 selection:text-white pb-12">
      {/* Universal Header */}
      <Navbar />

      {/* 3-Column Main Stage */}
      <div className="flex-1 w-full max-w-[1600px] mx-auto grid grid-cols-12 gap-5 px-5 py-5">
        {/* ================================================================== */}
        {/* Left Column (Category Filtering) */}
        {/* ================================================================== */}
        <aside className="col-span-12 lg:col-span-2 flex flex-col gap-6 text-sm">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span className="uppercase tracking-wider font-mono">Market Topics</span>
            <button
              onClick={() => {
                setSelectedCategory("All");
                setSearchQuery("");
              }}
              className="text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              Reset
            </button>
          </div>

          {/* Category Filter Pills */}
          <nav className="flex flex-col gap-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition text-left cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-[#181f2c] text-white border-l-2 border-[#38bdf8]"
                    : "text-slate-400 hover:text-white hover:bg-[#121721]"
                }`}
              >
                <span>{cat}</span>
                <span className="text-[10px] font-mono text-slate-500">
                  {cat === "All"
                    ? markets.length
                    : markets.filter((m) => m.category.toLowerCase() === cat.toLowerCase()).length}
                </span>
              </button>
            ))}
          </nav>

          {/* Group Bot Trigger Info */}
          <div className="panta-card-subtle p-3 flex flex-col gap-2 text-xs border-[#1e2638]">
            <span className="font-heading font-semibold text-white">⚡ In-Chat Trading</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Reply to any message with <code className="text-[#38bdf8] font-mono">/market</code> in Telegram or right-click in Discord to spawn a market instantly.
            </p>
          </div>
        </aside>

        {/* ================================================================== */}
        {/* Center Column (Hero Market + Explore Grid) */}
        {/* ================================================================== */}
        <main className="col-span-12 lg:col-span-7 flex flex-col gap-6">
          {isLoading ? (
            <div className="panta-card p-12 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-mono text-slate-400">Loading dynamic markets from Solana...</span>
            </div>
          ) : heroMarket ? (
            /* Hero Featured Market */
            <div className="panta-card p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <span>⚡</span> {heroMarket.category} • FEATURED
                </span>
                <span className="font-mono text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {heroMarket.phase === "secondary" ? "Graduated Secondary" : "Primary Curve"}
                </span>
              </div>

              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <h1 className="font-heading font-bold text-lg md:text-xl text-white tracking-tight leading-snug">
                  {heroMarket.title}
                </h1>
                <div className="flex items-center gap-3 text-xs font-mono shrink-0">
                  <span className="flex items-center gap-1 text-[#38bdf8] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#38bdf8]"></span> YES {heroMarket.yesPercent}%
                  </span>
                  <span className="flex items-center gap-1 text-[#c084fc] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#c084fc]"></span> NO {heroMarket.noPercent}%
                  </span>
                </div>
              </div>

              {/* Timeframe & Chart Controls */}
              <div className="flex items-center justify-between pt-2 border-t border-[#1e2638] text-xs">
                <div className="flex items-center gap-2 bg-[#0b0e14] p-1 rounded-md border border-[#1e2638]">
                  <button
                    onClick={() => setChartMode("price")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                      chartMode === "price" ? "bg-[#1e2638] text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Price
                  </button>
                  <button
                    onClick={() => setChartMode("volume")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                      chartMode === "volume" ? "bg-[#1e2638] text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Volume
                  </button>
                </div>

                <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                  {["1H", "6H", "1D", "7D", "All"].map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-2 py-0.5 rounded transition cursor-pointer ${
                        timeframe === tf ? "bg-[#1e2638] text-white font-medium" : "hover:text-white"
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Probability Line Chart */}
              <div className="w-full h-40 bg-[#0b0e14]/60 rounded-md border border-[#1e2638] p-3 flex flex-col justify-between relative overflow-hidden">
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>Avg: {timeframe}</span>
                  <span>panta-amm</span>
                </div>

                <div className="w-full h-24 relative">
                  <svg viewBox="0 0 500 100" className="w-full h-full" preserveAspectRatio="none">
                    <line x1="0" y1="25" x2="500" y2="25" stroke="#1e2638" strokeWidth="0.5" strokeDasharray="3 3" />
                    <line x1="0" y1="50" x2="500" y2="50" stroke="#1e2638" strokeWidth="0.5" strokeDasharray="3 3" />
                    <line x1="0" y1="75" x2="500" y2="75" stroke="#1e2638" strokeWidth="0.5" strokeDasharray="3 3" />

                    <polyline
                      fill="none"
                      stroke="#c084fc"
                      strokeWidth="2"
                      points="0,55 90,65 180,45 270,40 360,38 450,36 500,36"
                    />

                    <polyline
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      points="0,45 90,35 180,55 270,60 360,62 450,64 500,64"
                    />
                  </svg>

                  <div className="absolute right-1 top-2 text-[10px] font-mono text-[#38bdf8]">{heroMarket.yesPercent}%</div>
                  <div className="absolute right-1 bottom-4 text-[10px] font-mono text-[#c084fc]">{heroMarket.noPercent}%</div>
                </div>

                <div className="flex justify-between text-[10px] font-mono text-slate-500 px-2">
                  <span>Start</span>
                  <span>Mid</span>
                  <span>Now</span>
                </div>
              </div>

              {/* Direct Quick Bet Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => openBuyModal(heroMarket, "yes")}
                  className="flex items-center justify-between p-3 rounded-md bg-[#0f1520] hover:bg-[#141c2b] border border-[#1e2638] hover:border-[#38bdf8]/40 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#38bdf8]/20 text-[#38bdf8] flex items-center justify-center text-[10px] group-hover:scale-110 transition">
                      ✓
                    </div>
                    <span className="text-xs font-semibold text-white">Buy YES</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#38bdf8]">
                    {heroMarket.yesPercent}% • ${(heroMarket.yesPrice).toFixed(2)}
                  </span>
                </button>

                <button
                  onClick={() => openBuyModal(heroMarket, "no")}
                  className="flex items-center justify-between p-3 rounded-md bg-[#0f1520] hover:bg-[#141c2b] border border-[#1e2638] hover:border-[#c084fc]/40 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#c084fc]/20 text-[#c084fc] flex items-center justify-center text-[10px] group-hover:scale-110 transition">
                      ✕
                    </div>
                    <span className="text-xs font-semibold text-white">Buy NO</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#c084fc]">
                    {heroMarket.noPercent}% • ${(heroMarket.noPrice).toFixed(2)}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* Clean Empty State */
            <div className="panta-card p-10 flex flex-col items-center justify-center text-center gap-4 border border-[#1e2638] bg-[#121721] rounded-lg">
              <div className="w-12 h-12 rounded-full bg-[#181f2c] border border-[#1e2638] flex items-center justify-center text-xl">
                ⚡
              </div>
              <div className="flex flex-col gap-1 max-w-md">
                <h3 className="font-heading font-semibold text-lg text-white">No Active Markets Yet</h3>
                <p className="text-xs text-slate-400 font-mono">
                  Markets are dynamically spawned in real-time when users discuss topics and type <span className="text-[#38bdf8]">/market</span> in Telegram or Discord.
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
                  onClick={fetchMarkets}
                  className="px-4 py-2 bg-[#181f2c] text-white border border-[#1e2638] text-xs rounded font-mono hover:bg-[#20293a] transition cursor-pointer"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
          )}

          {/* Search & Explore Controls */}
          {markets.length > 0 && (
            <>
              <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                  <span className="text-white font-semibold">{filteredMarkets.length}</span>
                  <span>Active Prediction Markets</span>
                </div>

                {/* Live Title Search */}
                <div className="relative w-full md:w-64 shrink-0">
                  <span className="absolute left-2.5 top-2 text-slate-500 text-xs">🔍</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search markets by title..."
                    className="w-full bg-[#121721] border border-[#1e2638] rounded-md pl-7 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#38bdf8]/50"
                  />
                </div>
              </div>

              {/* Explore Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredMarkets.map((market) => (
                  <div
                    key={market.id}
                    onClick={() => openBuyModal(market, "yes")}
                    className="panta-card p-4 flex flex-col justify-between gap-3 hover:border-[#2a344d] transition cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span className="bg-[#181f2c] px-2 py-0.5 rounded text-slate-300">{market.category}</span>
                      <span>{market.timestamp}</span>
                    </div>

                    <h3 className="font-heading font-semibold text-sm text-white leading-snug line-clamp-2 group-hover:text-[#38bdf8] transition">
                      {market.title}
                    </h3>

                    {/* Outcome Percentages */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono font-medium">
                      <div className="bg-[#0f1520] border border-[#1e2638] rounded px-2.5 py-1.5 flex justify-between items-center text-[#38bdf8]">
                        <span>Yes</span>
                        <span>{market.yesPercent.toFixed(1)}%</span>
                      </div>
                      <div className="bg-[#0f1520] border border-[#1e2638] rounded px-2.5 py-1.5 flex justify-between items-center text-[#c084fc]">
                        <span>No</span>
                        <span>{market.noPercent.toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1 border-t border-[#1e2638]">
                      <span>{market.volume}</span>
                      <span className="text-slate-400">By {market.creator}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>

        {/* ================================================================== */}
        {/* Right Column (Trending, Royalties Preview) */}
        {/* ================================================================== */}
        <aside className="col-span-12 lg:col-span-3 flex flex-col gap-5 text-xs">
          {/* Quick Creator Vault Banner */}
          <div className="panta-card p-4 flex flex-col gap-2">
            <span className="font-semibold text-white">⚡ Creator Royalties Vault</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Every market spawned from chat earns you 0.50% trading fees automatically on every bonding curve trade.
            </p>
            <a
              href="/earnings"
              className="mt-1 text-center py-1.5 rounded bg-[#181f2c] hover:bg-[#20293a] border border-[#1e2638] text-xs font-mono text-[#38bdf8] transition"
            >
              Open Royalties Hub →
            </a>
          </div>

          {/* Trending Markets */}
          <div className="panta-card p-4 flex flex-col gap-3">
            <span className="font-semibold text-white">🔥 Trending Predictions</span>
            <div className="flex flex-col gap-3">
              {markets.length === 0 ? (
                <div className="text-slate-500 font-mono text-[11px] py-4 text-center">
                  No active markets yet
                </div>
              ) : (
                markets.slice(0, 3).map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => openBuyModal(item, "yes")}
                    className="flex items-start gap-2.5 border-b border-[#1e2638] pb-2.5 last:border-0 last:pb-0 cursor-pointer group"
                  >
                    <span className="font-mono text-slate-500 text-xs mt-0.5">{idx + 1}</span>
                    <div className="flex flex-col gap-1 flex-1">
                      <p className="text-[11px] text-slate-200 line-clamp-2 leading-snug group-hover:text-[#38bdf8] transition">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 font-mono text-[10px]">
                        <span className="text-[#38bdf8]">{item.yesPercent}% YES</span>
                        <span className="text-[#c084fc]">{item.noPercent}% NO</span>
                        <span className="text-slate-500 ml-auto">{item.volume}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ==================================================================== */}
      {/* Quick Buy Modal Sheet */}
      {/* ==================================================================== */}
      {activeModalMarket && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="panta-card w-full max-w-md p-6 flex flex-col gap-5 border border-[#1e2638] shadow-2xl relative bg-[#0b0e14]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#1e2638] pb-3">
              <span className="text-[11px] font-mono text-slate-400">
                ⚡ Quick Buy • {activeModalMarket.category}
              </span>
              <button
                onClick={() => setActiveModalMarket(null)}
                className="text-slate-500 hover:text-white transition text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Market Title */}
            <div>
              <h2 className="font-heading font-semibold text-base text-white leading-snug">
                {activeModalMarket.title}
              </h2>
            </div>

            {/* Outcome Toggle (YES / NO) */}
            <div className="grid grid-cols-2 gap-2 bg-[#121721] p-1.5 rounded-lg border border-[#1e2638]">
              <button
                onClick={() => setSelectedOutcome("yes")}
                className={`py-2 rounded font-mono text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  selectedOutcome === "yes"
                    ? "bg-[#38bdf8] text-black shadow-md shadow-[#38bdf8]/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>YES</span>
                <span>{activeModalMarket.yesPercent}%</span>
              </button>

              <button
                onClick={() => setSelectedOutcome("no")}
                className={`py-2 rounded font-mono text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  selectedOutcome === "no"
                    ? "bg-[#c084fc] text-black shadow-md shadow-[#c084fc]/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>NO</span>
                <span>{activeModalMarket.noPercent}%</span>
              </button>
            </div>

            {/* Spend Amount Presets */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-mono text-slate-400">Amount (USDC)</label>
              <div className="grid grid-cols-4 gap-2">
                {[5, 20, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setSpendAmount(amt)}
                    className={`py-1.5 rounded text-xs font-mono font-medium transition cursor-pointer ${
                      spendAmount === amt
                        ? "bg-[#181f2c] text-white border border-[#38bdf8]"
                        : "bg-[#121721] text-slate-400 border border-[#1e2638] hover:text-white"
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary Payout Estimation */}
            <div className="bg-[#121721] p-3 rounded-lg border border-[#1e2638] flex flex-col gap-1.5 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Est. Shares:</span>
                <span className="text-white">
                  {(spendAmount / (selectedOutcome === "yes" ? activeModalMarket.yesPrice : activeModalMarket.noPrice)).toFixed(2)} shares
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Est. Payout if Won:</span>
                <span className="text-emerald-400 font-bold">
                  ${(spendAmount / (selectedOutcome === "yes" ? activeModalMarket.yesPrice : activeModalMarket.noPrice)).toFixed(2)} USDC
                </span>
              </div>
              <div className="flex justify-between text-slate-500 text-[10px] pt-1 border-t border-[#1e2638]">
                <span>Bonding Royalty Fee:</span>
                <span>0.50%</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setActiveModalMarket(null)}
                className="flex-1 py-2 rounded border border-[#1e2638] text-xs font-mono text-slate-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleProceedToSign}
                className="flex-1 py-2 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs font-mono transition shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                Confirm & Sign →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full border-t border-[#1e2638] py-4 text-center text-xs font-mono text-slate-500">
        PantaChat • Built with Panta Protocol on Solana Devnet • Colosseum Renaissance Hackathon
      </footer>
    </div>
  );
}
