// =============================================================================
// PantaChat Live Markets State & Catalog
// =============================================================================

export interface LiveMarket {
  id: string;
  title: string;
  category: "Crypto" | "Sports" | "Stocks" | "Macroeconomics" | "Politics" | "Pop Culture" | string;
  description: string;
  creator: string;
  phase: "primary" | "secondary" | "resolved";
  yesPrice: number;
  noPrice: number;
  volumeUsdc: number;
  volumeRaw: number;
  createdAt: string;
  cutoffAt?: string;
  txSignature?: string;
}

// Global in-memory list (persists across requests within lambda instance lifecycle)
const initialMarkets: LiveMarket[] = [
  {
    id: "mkt_arsenal_chelsea_1790951354",
    title: "Will Arsenal beat Chelsea in the Premier League on October 18, 2026?",
    category: "Sports",
    description:
      "Resolves YES if Arsenal win the Premier League match against Chelsea scheduled for October 18, 2026, with the result decided after 90 minutes plus stoppage time, per the official Premier League match report. A draw or Chelsea win resolves NO.",
    creator: "@Bobotrades",
    phase: "primary",
    yesPrice: 0.5,
    noPrice: 0.5,
    volumeUsdc: 250,
    volumeRaw: 250,
    createdAt: "Just now",
    cutoffAt: "2026-10-18T23:59:59.000Z",
  },
  {
    id: "mkt_sol_flip_eth_2026",
    title: "Will Solana flip Ethereum in market cap before end of 2026?",
    category: "Crypto",
    description:
      "Resolves to YES if CoinGecko spot market cap of SOL exceeds ETH at any point before Dec 31, 2026.",
    creator: "PantaChat",
    phase: "primary",
    yesPrice: 0.65,
    noPrice: 0.35,
    volumeUsdc: 14200,
    volumeRaw: 14200,
    createdAt: "2h ago",
    cutoffAt: "2026-12-31T23:59:59.000Z",
  },
  {
    id: "mkt_btc_150k_q4",
    title: "Will Bitcoin reach $150,000 before the end of Q4 2026?",
    category: "Crypto",
    description: "Resolves YES if BTC spot price touches $150,000 on major exchanges before Dec 31, 2026.",
    creator: "CryptoWhale",
    phase: "primary",
    yesPrice: 0.58,
    noPrice: 0.42,
    volumeUsdc: 38900,
    volumeRaw: 38900,
    createdAt: "4h ago",
    cutoffAt: "2026-12-31T23:59:59.000Z",
  },
  {
    id: "mkt_fed_rate_cut_next",
    title: "Will the Federal Reserve cut interest rates at the next FOMC meeting?",
    category: "Macroeconomics",
    description: "Resolves YES if the FOMC announces a target rate reduction of 25bps or more.",
    creator: "MacroGuru",
    phase: "primary",
    yesPrice: 0.82,
    noPrice: 0.18,
    volumeUsdc: 22400,
    volumeRaw: 22400,
    createdAt: "1d ago",
    cutoffAt: "2026-11-15T18:00:00.000Z",
  },
  {
    id: "mkt_apple_ai_wearable",
    title: "Will Apple announce an AI smart ring or pin in 2026?",
    category: "Pop Culture",
    description: "Resolves YES if Apple officially announces a dedicated AI wearable product during 2026.",
    creator: "TechInsider",
    phase: "primary",
    yesPrice: 0.44,
    noPrice: 0.56,
    volumeUsdc: 8750,
    volumeRaw: 8750,
    createdAt: "1d ago",
    cutoffAt: "2026-12-31T23:59:59.000Z",
  },
];

declare global {
  // eslint-disable-next-line no-var
  var __PANTA_MARKETS__: LiveMarket[] | undefined;
}

if (!globalThis.__PANTA_MARKETS__) {
  globalThis.__PANTA_MARKETS__ = [...initialMarkets];
}

export function getAllLiveMarkets(): LiveMarket[] {
  return globalThis.__PANTA_MARKETS__ || initialMarkets;
}

export function addLiveMarket(market: Partial<LiveMarket> & { title: string }): LiveMarket {
  const existingList = getAllLiveMarkets();
  const id = market.id || `mkt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Prevent duplicate insertion
  const existing = existingList.find(
    (m) =>
      m.id === id ||
      m.title.toLowerCase().trim() === market.title.toLowerCase().trim()
  );
  if (existing) {
    return existing;
  }

  const newEntry: LiveMarket = {
    id,
    title: market.title,
    category: market.category || "Crypto",
    description: market.description || "Resolves according to official rules.",
    creator: market.creator || "Community Predictor",
    phase: (market.phase as any) || "primary",
    yesPrice: typeof market.yesPrice === "number" ? market.yesPrice : 0.5,
    noPrice: typeof market.noPrice === "number" ? market.noPrice : 0.5,
    volumeUsdc: market.volumeUsdc || 50,
    volumeRaw: market.volumeRaw || 50,
    createdAt: "Just now",
    cutoffAt: market.cutoffAt || new Date(Date.now() + 30 * 86400000).toISOString(),
    txSignature: market.txSignature,
  };

  existingList.unshift(newEntry);
  return newEntry;
}
