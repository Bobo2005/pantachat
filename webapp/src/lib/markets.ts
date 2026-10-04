import { supabase, isSupabaseConfigured } from "./supabase";

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
 * Asynchronously loads live markets from Supabase (or cloud persistent store).
 */
export async function getAllLiveMarketsAsync(): Promise<LiveMarket[]> {
  // 1. Check Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from("markets")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped: LiveMarket[] = data.map((m: any) => ({
          id: m.id,
          title: m.title,
          category: m.category || "Crypto",
          description: m.description || "",
          creator: m.creator || "Community Predictor",
          phase: m.phase || "primary",
          yesPrice: Number(m.yes_price ?? m.yesPrice ?? 0.5),
          noPrice: Number(m.no_price ?? m.noPrice ?? 0.5),
          volumeUsdc: Number(m.volume_usdc ?? m.volumeUsdc ?? 50),
          volumeRaw: Number(m.volume_raw ?? m.volumeRaw ?? 50),
          createdAt: m.created_at || "Recent",
          cutoffAt: m.cutoff_at || m.cutoffAt,
          txSignature: m.tx_signature || m.txSignature,
          chatId: m.chat_id || m.chatId,
        }));
        globalThis.__PANTA_MARKETS__ = mapped;
        return mapped;
      }
    } catch (sbErr) {
      console.warn("[Supabase Market Fetch Warning]:", sbErr);
    }
  }

  // 2. Cloud catalog fallback
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
    // Memory fallback
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

  // 1. Supabase persistence if configured
  if (isSupabaseConfigured && supabase) {
    Promise.resolve(
      supabase.from("markets").upsert({
        id: newEntry.id,
        title: newEntry.title,
        category: newEntry.category,
        description: newEntry.description,
        creator: newEntry.creator,
        phase: newEntry.phase,
        yes_price: newEntry.yesPrice,
        no_price: newEntry.noPrice,
        volume_usdc: newEntry.volumeUsdc,
        volume_raw: newEntry.volumeRaw,
        cutoff_at: newEntry.cutoffAt,
        tx_signature: newEntry.txSignature,
        chat_id: newEntry.chatId,
      })
    )
      .then((res: any) => {
        if (res?.error) console.warn("[Supabase Market Upsert Warning]:", res.error.message);
      })
      .catch((e: any) => console.warn("[Supabase Market Upsert Error]:", e));
  }

  // 2. Fallback cloud catalog
  fetch(`https://api.restful-api.dev/objects/${CLOUD_CATALOG_ID}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "PantaChat_Market_Catalog",
      data: { markets: existingList },
    }),
  }).catch(() => {});

  return newEntry;
}

/**
 * Asynchronously loads user trades/positions from Supabase, cloud store, and memory.
 */
export async function getUserTradesAsync(wallet?: string): Promise<any[]> {
  // 1. Check Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from("trades").select("*").order("created_at", { ascending: false });
      if (wallet) {
        query = query.ilike("wallet_address", `%${wallet.slice(0, 6)}%`);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        const mappedTrades = data.map((t: any) => ({
          id: t.id,
          marketId: t.market_id || t.marketId,
          marketTitle: t.market_title || t.marketTitle,
          category: t.category || "Crypto",
          outcome: t.outcome,
          shares: Number(t.shares || 0),
          costUsdc: Number(t.cost_usdc ?? t.costUsdc ?? 0),
          currentValueUsdc: Number(t.current_value_usdc ?? t.currentValueUsdc ?? 0),
          pnlUsdc: Number(t.pnl_usdc ?? t.pnlUsdc ?? 0),
          pnlPercent: Number(t.pnl_percent ?? t.pnlPercent ?? 0),
          status: t.status || "open",
          isClaimed: Boolean(t.is_claimed ?? t.isClaimed),
          wallet: t.wallet_address || t.wallet,
          txSignature: t.tx_signature || t.txSignature,
          createdAt: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
        }));

        if (!globalThis.__PANTA_TRADES__) globalThis.__PANTA_TRADES__ = [];
        for (const mt of mappedTrades) {
          if (!globalThis.__PANTA_TRADES__.some((x) => x.id === mt.id)) {
            globalThis.__PANTA_TRADES__.push(mt);
          }
        }
        return mappedTrades;
      }
    } catch (sbErr) {
      console.warn("[Supabase Trades Fetch Warning]:", sbErr);
    }
  }

  // 2. In-memory + cloud store fallback
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
 * Records a user trade to Supabase and in-memory store.
 */
export async function addUserTradeAsync(trade: any): Promise<void> {
  if (!globalThis.__PANTA_TRADES__) {
    globalThis.__PANTA_TRADES__ = [];
  }
  globalThis.__PANTA_TRADES__ = [
    trade,
    ...globalThis.__PANTA_TRADES__.filter((t: any) => t.id !== trade.id),
  ];

  // 1. Supabase persistence if configured
  if (isSupabaseConfigured && supabase) {
    try {
      if (trade.marketId) {
        await supabase.from("markets").upsert(
          {
            id: trade.marketId,
            title: trade.marketTitle || "Prediction Market",
            category: trade.category || "Crypto",
            yes_price: 0.5,
            no_price: 0.5,
            volume_usdc: trade.costUsdc || 50,
            volume_raw: trade.costUsdc || 50,
          },
          { onConflict: "id", ignoreDuplicates: true }
        );
      }

      const { error } = await supabase.from("trades").upsert({
        id: trade.id,
        market_id: trade.marketId,
        market_title: trade.marketTitle,
        category: trade.category || "Crypto",
        outcome: trade.outcome,
        shares: trade.shares,
        cost_usdc: trade.costUsdc,
        current_value_usdc: trade.currentValueUsdc,
        pnl_usdc: trade.pnlUsdc || 0,
        pnl_percent: trade.pnlPercent || 0,
        status: trade.status || "open",
        is_claimed: Boolean(trade.isClaimed),
        wallet_address: trade.wallet,
        tx_signature: trade.txSignature,
        created_at: new Date(trade.createdAt || Date.now()).toISOString(),
      });

      if (error) {
        console.warn("[Supabase Add Trade Error]:", error.message);
      }
    } catch (sbErr) {
      console.warn("[Supabase Add Trade Error]:", sbErr);
    }
  }

  // 2. Cloud store fallback backup
  try {
    fetch(`https://api.restful-api.dev/objects/${CLOUD_TRADES_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "PantaChat_User_Trades",
        data: { trades: globalThis.__PANTA_TRADES__ },
      }),
    }).catch(() => {});
  } catch (err) {}
}

