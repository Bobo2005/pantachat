import { pantaGet } from "./client.js";

// =============================================================================
// Interfaces & Types
// =============================================================================

export interface PantaMarket {
  id: string; // Panta eventPda or unique market ID
  title: string;
  description?: string;
  category: string;
  status?: string;
  phase: "primary" | "secondary" | "resolved" | string;
  yesPrice: number;
  noPrice: number;
  volumeUsdc?: number;
  liquidityUsdc?: number;
  cutoffAt: string | number; // ISO string or unix timestamp
  createdAt?: string | number;
  resolvedOutcome?: "yes" | "no" | null;
  creatorWallet?: string;
  metadata?: Record<string, unknown>;
}

export interface MarketQueryParams {
  category?: string;
  status?: string;
  limit?: number;
}

export interface MarketStats {
  marketId: string;
  yesPrice: number;
  noPrice: number;
  yesProb: number;
  noProb: number;
  yesProbPercent: string;
  noProbPercent: string;
  yesPayout: number;
  noPayout: number;
  timeRemaining: string;
  isExpired: boolean;
  phase: string;
}

// =============================================================================
// In-Memory Cache (Quota Protection)
// =============================================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | undefined {
  const entry = memoryCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T, ttlMs: number): void {
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Clears or invalidates market cache.
 */
export function invalidateMarketCache(marketId?: string): void {
  if (marketId) {
    memoryCache.delete(`market:${marketId}`);
  } else {
    memoryCache.clear();
  }
}

// Default standard categories fallback according to memory.md
export const DEFAULT_CATEGORIES = [
  "Crypto",
  "Sports",
  "Tech",
  "Politics",
  "Culture",
  "Finance",
];

// =============================================================================
// Market Discovery & Detail Functions
// =============================================================================

/**
 * Fetches market catalog with 60-second in-memory caching to protect 120 req/min read quota.
 */
export async function getMarkets(
  params?: MarketQueryParams
): Promise<PantaMarket[]> {
  const cacheKey = `markets:${params?.category || "all"}:${params?.status || "all"}:${params?.limit || 20}`;
  const cached = getCached<PantaMarket[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const raw = await pantaGet<any>("/markets/", { params }, "read");
  const markets: PantaMarket[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.markets)
    ? raw.markets
    : Array.isArray(raw?.data)
    ? raw.data
    : [];

  setCached(cacheKey, markets, 60 * 1000); // 60-second TTL
  return markets;
}

/**
 * Fetches single market details including live spot prices, volume, phase, and cutoff time.
 * Cached in-memory for 60 seconds.
 */
export async function getMarketById(marketId: string): Promise<PantaMarket> {
  const cacheKey = `market:${marketId}`;
  const cached = getCached<PantaMarket>(cacheKey);
  if (cached) {
    return cached;
  }

  const raw = await pantaGet<any>(`/markets/${marketId}/`, undefined, "read");
  const market: PantaMarket = raw?.market || raw?.data || raw;
  setCached(cacheKey, market, 60 * 1000); // 60-second TTL
  return market;
}

/**
 * Fetches official Panta categories, cached for 1 hour.
 */
export async function getCategories(): Promise<string[]> {
  const cacheKey = "categories:all";
  const cached = getCached<string[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const raw = await pantaGet<any>("/categories/", undefined, "read");
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.categories)
      ? raw.categories
      : Array.isArray(raw?.data)
      ? raw.data
      : null;

    if (list && list.length > 0) {
      const normalized = list.map((c: string) => String(c));
      setCached(cacheKey, normalized, 60 * 60 * 1000); // 1-hour TTL
      return normalized;
    }
  } catch (err) {
    // Fallback to official default categories if offline or staging endpoint not yet provisioned
    console.warn("Using default category list fallback:", err);
  }

  setCached(cacheKey, DEFAULT_CATEGORIES, 60 * 60 * 1000);
  return DEFAULT_CATEGORIES;
}

/**
 * Calculates market statistics including implied probabilities, payout multipliers,
 * and formatted human-readable time remaining string.
 */
export async function getMarketStats(marketId: string): Promise<MarketStats> {
  const market = await getMarketById(marketId);

  const yesPrice = Number(market.yesPrice) || 0.5;
  const noPrice = Number(market.noPrice) || 0.5;

  const totalProb = yesPrice + noPrice;
  const yesProb = totalProb > 0 ? yesPrice / totalProb : 0.5;
  const noProb = totalProb > 0 ? noPrice / totalProb : 0.5;

  const yesPayout = yesPrice > 0 ? Number((1 / yesPrice).toFixed(2)) : 0;
  const noPayout = noPrice > 0 ? Number((1 / noPrice).toFixed(2)) : 0;

  // Calculate cutoff timestamp
  let cutoffMs: number;
  if (typeof market.cutoffAt === "number") {
    // Check if cutoff is in seconds (10 digits) or ms (13 digits)
    cutoffMs = market.cutoffAt < 10000000000 ? market.cutoffAt * 1000 : market.cutoffAt;
  } else {
    cutoffMs = new Date(market.cutoffAt).getTime();
  }

  const now = Date.now();
  const diffMs = cutoffMs - now;
  const isExpired = diffMs <= 0;

  let timeRemaining = "Closed";
  if (!isExpired) {
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
      timeRemaining = `${days}d ${hours}h`;
    } else if (hours > 0) {
      timeRemaining = `${hours}h ${minutes}m`;
    } else {
      timeRemaining = `${minutes}m`;
    }
  }

  return {
    marketId,
    yesPrice,
    noPrice,
    yesProb,
    noProb,
    yesProbPercent: `${Math.round(yesProb * 100)}%`,
    noProbPercent: `${Math.round(noProb * 100)}%`,
    yesPayout,
    noPayout,
    timeRemaining,
    isExpired,
    phase: market.phase || "primary",
  };
}
