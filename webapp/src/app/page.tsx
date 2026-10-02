"use client";

import React, { useState, useMemo } from "react";
import Navbar from "@/components/Navbar";

// =============================================================================
// Market Data Catalog
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

const INITIAL_MARKETS: MarketItem[] = [
  {
    id: "mkt_sol_eth",
    category: "Crypto",
    timestamp: "Oct 2, 11:15 AM",
    title: "Will Solana (SOL) flip Ethereum in market cap before 2027?",
    yesPercent: 64.0,
    noPercent: 36.0,
    yesPrice: 0.64,
    noPrice: 0.36,
    volume: "$14,250 VOL",
    volumeRaw: 14250,
    creator: "PantaChat",
    phase: "primary",
    description: "Resolves YES if SOL market capitalization on CoinGecko exceeds ETH before Jan 1, 2027.",
  },
  {
    id: "mkt_bbn_female",
    category: "Pop Culture",
    timestamp: "Sep 28, 1:34 PM",
    title: "Will a female housemate win Big Brother Naija Season 11?",
    yesPercent: 52.1,
    noPercent: 47.9,
    yesPrice: 0.52,
    noPrice: 0.48,
    volume: "$250.70 VOL",
    volumeRaw: 250.7,
    creator: "TessyRally",
    phase: "primary",
    description: "Resolves YES if the winner crowned at the grand finale of Season 11 is female.",
  },
  {
    id: "mkt_dangote",
    category: "Macroeconomics",
    timestamp: "Aug 8, 1:10 PM",
    title: "Will Dangote Refinery be valued at over $60 billion before March 31, 2027?",
    yesPercent: 44.0,
    noPercent: 56.0,
    yesPrice: 0.44,
    noPrice: 0.56,
    volume: "$1,890 VOL",
    volumeRaw: 1890,
    creator: "MacroAnalyst",
    phase: "primary",
    description: "Resolves YES if official secondary valuation or IPO achieves $60B valuation.",
  },
  {
    id: "mkt_manu_spurs",
    category: "Sports",
    timestamp: "Oct 1, 4:00 PM",
    title: "Manchester United will win against Spurs with 2 or more goals",
    yesPercent: 52.0,
    noPercent: 48.0,
    yesPrice: 0.52,
    noPrice: 0.48,
    volume: "$4,320 VOL",
    volumeRaw: 4320,
    creator: "RedDevil",
    phase: "primary",
    description: "Resolves YES if Manchester United wins the match by 2 or more goal margin.",
  },
  {
    id: "mkt_btc_ath",
    category: "Crypto",
    timestamp: "Oct 2, 9:30 AM",
    title: "Will Bitcoin breach $150,000 before end of Q4 2026?",
    yesPercent: 71.5,
    noPercent: 28.5,
    yesPrice: 0.71,
    noPrice: 0.29,
    volume: "$84,100 VOL",
    volumeRaw: 84100,
    creator: "SatoshiStacker",
    phase: "secondary",
    description: "Resolves YES if BTC/USD spot price touches or exceeds $150,000 on Binance.",
  },
  {
    id: "mkt_fed_cuts",
    category: "Stocks",
    timestamp: "Sep 29, 3:20 PM",
    title: "Will the US Federal Reserve cut rates by 50bps at the next FOMC?",
    yesPercent: 38.0,
    noPercent: 62.0,
    yesPrice: 0.38,
    noPrice: 0.62,
    volume: "$9,400 VOL",
    volumeRaw: 9400,
    creator: "FedWatcher",
    phase: "primary",
    description: "Resolves YES if the target benchmark rate is reduced by 50 basis points.",
  },
];

const CATEGORIES = ["All", "Crypto", "Sports", "Stocks", "Macroeconomics", "Pop Culture"];

export default function MarketExplorer() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [chartMode, setChartMode] = useState<"price" | "volume">("price");
  const [timeframe, setTimeframe] = useState("7D");

  // Quick Buy Modal State
  const [activeModalMarket, setActiveModalMarket] = useState<MarketItem | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<"yes" | "no">("yes");
  const [spendAmount, setSpendAmount] = useState<number>(20);

  // Filtered Markets
  const filteredMarkets = useMemo(() => {
    return INITIAL_MARKETS.filter((m) => {
      const matchesCategory =
        selectedCategory === "All" || m.category.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.creator.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const heroMarket = INITIAL_MARKETS[0];

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
      {/* Universal Panta Header */}
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
                    ? INITIAL_MARKETS.length
                    : INITIAL_MARKETS.filter((m) => m.category.toLowerCase() === cat.toLowerCase()).length}
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
          {/* Hero Featured Market */}
          <div className="panta-card p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <span>⚡</span> {heroMarket.category} • FEATURED
              </span>
              <span className="font-mono text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Primary Curve
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

            {/* Probability Line Chart (SVG Realism) */}
            <div className="w-full h-40 bg-[#0b0e14]/60 rounded-md border border-[#1e2638] p-3 flex flex-col justify-between relative overflow-hidden">
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>Avg: 7d</span>
                <span>panta-amm</span>
              </div>

              <div className="w-full h-24 relative">
                <svg viewBox="0 0 500 100" className="w-full h-full" preserveAspectRatio="none">
                  <line x1="0" y1="25" x2="500" y2="25" stroke="#1e2638" strokeWidth="0.5" strokeDasharray="3 3" />
                  <line x1="0" y1="50" x2="500" y2="50" stroke="#1e2638" strokeWidth="0.5" strokeDasharray="3 3" />
                  <line x1="0" y1="75" x2="500" y2="75" stroke="#1e2638" strokeWidth="0.5" strokeDasharray="3 3" />

                  {/* NO Polyline */}
                  <polyline
                    fill="none"
                    stroke="#c084fc"
                    strokeWidth="2"
                    points="0,55 90,65 180,45 270,40 360,38 450,36 500,36"
                  />

                  {/* YES Polyline */}
                  <polyline
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2"
                    points="0,45 90,35 180,55 270,60 360,62 450,64 500,64"
                  />
                </svg>

                <div className="absolute right-1 top-2 text-[10px] font-mono text-[#38bdf8]">64%</div>
                <div className="absolute right-1 bottom-4 text-[10px] font-mono text-[#c084fc]">36%</div>
              </div>

              <div className="flex justify-between text-[10px] font-mono text-slate-500 px-2">
                <span>Sep 25</span>
                <span>Sep 29</span>
                <span>Oct 2</span>
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
                  64% • ${(heroMarket.yesPrice).toFixed(2)}
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
                  36% • ${(heroMarket.noPrice).toFixed(2)}
                </span>
              </button>
            </div>
          </div>

          {/* Search & Explore Controls */}
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
                  <span className="text-slate-400">By @{market.creator}</span>
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* ================================================================== */}
        {/* Right Column (Trending, Royalties Preview) */}
        {/* ================================================================== */}
        <aside className="col-span-12 lg:col-span-3 flex flex-col gap-5 text-xs">
          {/* Quick Creator Vault Banner */}
          <div className="panta-card p-4 flex flex-col gap-2">
            <span className="font-semibold text-white">⚡ Creator Royalties Vault</span>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Every market spawned from chat earns you 20% protocol trading fees automatically upon graduation.
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
              {INITIAL_MARKETS.slice(0, 3).map((item, idx) => (
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
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* ==================================================================== */}
      {/* Quick-Buy Modal */}
      {/* ==================================================================== */}
      {activeModalMarket && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md panta-card p-5 border border-[#1e2638] shadow-2xl flex flex-col gap-4 relative animate-in fade-in zoom-in-95 duration-150">
            {/* Close Button */}
            <button
              onClick={() => setActiveModalMarket(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-mono text-sm cursor-pointer"
            >
              ✕
            </button>

            <div className="flex flex-col gap-1 pr-6">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                {activeModalMarket.category} • QUICK BET
              </span>
              <h2 className="font-heading font-semibold text-sm text-white leading-snug">
                {activeModalMarket.title}
              </h2>
            </div>

            {/* Choose YES or NO */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono font-medium">
              <button
                onClick={() => setSelectedOutcome("yes")}
                className={`py-2 rounded border transition cursor-pointer ${
                  selectedOutcome === "yes"
                    ? "bg-[#38bdf8]/15 border-[#38bdf8] text-[#38bdf8] font-bold"
                    : "bg-[#0f1520] border-[#1e2638] text-slate-400 hover:text-white"
                }`}
              >
                YES (${activeModalMarket.yesPrice.toFixed(2)})
              </button>
              <button
                onClick={() => setSelectedOutcome("no")}
                className={`py-2 rounded border transition cursor-pointer ${
                  selectedOutcome === "no"
                    ? "bg-[#c084fc]/15 border-[#c084fc] text-[#c084fc] font-bold"
                    : "bg-[#0f1520] border-[#1e2638] text-slate-400 hover:text-white"
                }`}
              >
                NO (${activeModalMarket.noPrice.toFixed(2)})
              </button>
            </div>

            {/* Spend Presets */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-mono text-slate-400">Bet Size (USDC)</span>
              <div className="grid grid-cols-4 gap-2">
                {[5, 20, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setSpendAmount(amt)}
                    className={`py-1.5 rounded text-xs font-mono transition cursor-pointer ${
                      spendAmount === amt
                        ? "bg-white text-black font-semibold"
                        : "bg-[#181f2c] text-slate-300 border border-[#1e2638] hover:border-slate-500"
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Projection Details */}
            <div className="panta-card-subtle p-3 text-xs font-mono flex flex-col gap-1.5 text-slate-400">
              <div className="flex justify-between">
                <span>Est. Shares</span>
                <span className="text-white font-medium">
                  {(spendAmount / (selectedOutcome === "yes" ? activeModalMarket.yesPrice : activeModalMarket.noPrice)).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Max Payout</span>
                <span className="text-emerald-400 font-semibold">
                  ${(spendAmount * (1 / (selectedOutcome === "yes" ? activeModalMarket.yesPrice : activeModalMarket.noPrice))).toFixed(2)} USDC
                </span>
              </div>
              <div className="flex justify-between">
                <span>Bonding Curve Protection</span>
                <span className="text-slate-300">3% Max Slippage</span>
              </div>
            </div>

            {/* Review & Sign Button */}
            <button
              onClick={handleProceedToSign}
              className="w-full py-2.5 rounded-md bg-white hover:bg-slate-200 text-black text-xs font-semibold transition cursor-pointer"
            >
              Proceed to Non-Custodial Sign ($ {spendAmount}) →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
