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

const CLOUD_CATALOG_ID = "ff808181a09d98f701a102a0f5c26d9c";
const CLOUD_TRADES_ID = "ff808181a09d98f701a102a584e56da3";

declare global {
  // eslint-disable-next-line no-var
  var __PANTA_MARKETS__: LiveMarket[] | undefined;
  // eslint-disable-next-line no-var
  var __PANTA_TRADES__: any[] | undefined;
}

if (!globalThis.__PANTA_MARKETS__) {
  globalThis.__PANTA_MARKETS__ = [...initialMarkets];
}

export function getAllLiveMarkets(): LiveMarket[] {
  return globalThis.__PANTA_MARKETS__ || initialMarkets;
}

/**
 * Asynchronously loads live markets from cloud persistent store.
 */
export async function getAllLiveMarketsAsync(): Promise<LiveMarket[]> {
  try {
    const res = await fetch(`https://api.restful-api.dev/objects/${CLOUD_CATALOG_ID}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.data?.markets) && json.data.markets.length > 0) {
        globalThis.__PANTA_MARKETS__ = json.data.markets;
        return json.data.markets;
      }
    }
  } catch (err) {
    console.warn("[Cloud Catalog Warning]:", err);
  }
  return getAllLiveMarkets();
}

/**
 * Synchronous in-memory market registration with background cloud persistence.
 */
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

  // Asynchronously persist to cloud store
  fetch(`https://api.restful-api.dev/objects/${CLOUD_CATALOG_ID}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "PantaChat_Market_Catalog",
      data: { markets: existingList },
    }),
  }).catch((err) => console.warn("[Cloud Market Save Warning]:", err));

  return newEntry;
}

/**
 * Asynchronously loads user trades/positions from cloud store and in-memory cache.
 */
export async function getUserTradesAsync(wallet?: string): Promise<any[]> {
  if (!globalThis.__PANTA_TRADES__) {
    globalThis.__PANTA_TRADES__ = [];
  }
  const trades: any[] = [...globalThis.__PANTA_TRADES__];

  try {
    const res = await fetch(`https://api.restful-api.dev/objects/${CLOUD_TRADES_ID}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      const cloudTrades = Array.isArray(json?.data?.trades) ? json.data.trades : [];
      for (const ct of cloudTrades) {
        if (!trades.some((t: any) => t.id === ct.id)) {
          trades.push(ct);
        }
      }
    }
  } catch (err) {
    // Graceful fallback to memory store
  }

  if (!wallet) return trades;
  return trades.filter(
    (t: any) =>
      !t.wallet ||
      t.wallet.toLowerCase().trim() === wallet.toLowerCase().trim() ||
      t.wallet.toLowerCase().includes(wallet.toLowerCase().slice(0, 6)) ||
      wallet.toLowerCase().includes(t.wallet.toLowerCase().slice(0, 6))
  );
}

/**
 * Records a user trade to in-memory store and attempts persistent cloud backup.
 */
export async function addUserTradeAsync(trade: any): Promise<void> {
  if (!globalThis.__PANTA_TRADES__) {
    globalThis.__PANTA_TRADES__ = [];
  }
  globalThis.__PANTA_TRADES__ = [
    trade,
    ...globalThis.__PANTA_TRADES__.filter((t: any) => t.id !== trade.id),
  ];

  try {
    await fetch(`https://api.restful-api.dev/objects/${CLOUD_TRADES_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "PantaChat_User_Trades",
        data: { trades: globalThis.__PANTA_TRADES__ },
      }),
    });
  } catch (err) {
    // Cloud quota warning ignored
  }
}

