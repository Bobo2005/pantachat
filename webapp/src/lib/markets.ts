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
const initialMarkets: LiveMarket[] = [];

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
