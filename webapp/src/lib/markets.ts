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
  chatId?: string;
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
    chatId: "-1004471636999",
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
    if (market.chatId && !existing.chatId) {
      existing.chatId = market.chatId;
    }
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
    chatId: market.chatId,
  };

  existingList.unshift(newEntry);
  return newEntry;
}
