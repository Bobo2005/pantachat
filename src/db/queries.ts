import { eq, or, desc, sql } from "drizzle-orm";
import { db } from "./index.js";
import {
  markets,
  trades,
  sessions,
  type Market,
  type NewMarket,
  type Trade,
  type NewTrade,
  type Session,
  type NewSession,
} from "./schema.js";

// =============================================================================
// Market Queries
// =============================================================================

/**
 * Saves a new market or updates an existing market by ID.
 */
export async function saveMarket(data: NewMarket): Promise<Market> {
  const existing = await getMarketById(data.id);
  if (existing) {
    const [updated] = await db
      .update(markets)
      .set(data)
      .where(eq(markets.id, data.id))
      .returning();
    return updated;
  }

  const [created] = await db.insert(markets).values(data).returning();
  return created;
}

/**
 * Retrieves a market by its unique ID (Panta event PDA or local UUID).
 */
export async function getMarketById(id: string): Promise<Market | undefined> {
  const [market] = await db
    .select()
    .from(markets)
    .where(eq(markets.id, id))
    .limit(1);
  return market;
}

/**
 * Updates market prices and optional cumulative volume.
 */
export async function updateMarketOdds(
  id: string,
  yesPrice: number,
  noPrice: number,
  volumeUsdc?: number
): Promise<Market | undefined> {
  const updateData: Partial<NewMarket> = {
    yesPrice,
    noPrice,
  };
  if (volumeUsdc !== undefined) {
    updateData.volumeUsdc = volumeUsdc;
  }

  const [updated] = await db
    .update(markets)
    .set(updateData)
    .where(eq(markets.id, id))
    .returning();
  return updated;
}

/**
 * Updates the card message ID for in-place edit tracking.
 */
export async function updateMarketMessageId(
  id: string,
  messageId: string
): Promise<void> {
  await db
    .update(markets)
    .set({ messageId })
    .where(eq(markets.id, id));
}

/**
 * Updates market lifecycle phase (primary -> secondary -> resolved).
 */
export async function updateMarketPhase(
  id: string,
  phase: "primary" | "secondary" | "resolved",
  resolvedOutcome?: "yes" | "no"
): Promise<Market | undefined> {
  const updateData: Partial<NewMarket> = { phase };
  if (resolvedOutcome) {
    updateData.resolvedOutcome = resolvedOutcome;
  }

  const [updated] = await db
    .update(markets)
    .set(updateData)
    .where(eq(markets.id, id))
    .returning();

  // Sync lifecycle phase and resolution to Supabase
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseKey) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/markets?id=eq.${id}`, {
        method: "PATCH",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          phase,
          resolved_outcome: resolvedOutcome || null,
        }),
      });
    } catch (sbErr: any) {
      console.warn("[updateMarketPhase Supabase Sync Warning]:", sbErr.message);
    }
  }

  return updated;
}

/**
 * Retrieves all markets currently active in primary or secondary trading phases.
 */
export async function getActiveMarkets(): Promise<Market[]> {
  return db
    .select()
    .from(markets)
    .where(or(eq(markets.phase, "primary"), eq(markets.phase, "secondary")));
}

/**
 * Retrieves all markets created by a specific platform user.
 */
export async function getMarketsByCreator(creatorPlatformId: string): Promise<Market[]> {
  return db
    .select()
    .from(markets)
    .where(eq(markets.creatorPlatformId, creatorPlatformId))
    .orderBy(desc(markets.createdAt));
}

/**
 * Normalizes a market title for deduplication comparison.
 */
export function normalizeMarketTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[?!.,;:'"“”’]+$/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Queries Supabase markets table directly to check if a market title already exists in the cloud catalog.
 */
async function findDuplicateInSupabase(normalizedTarget: string): Promise<Market | undefined> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return undefined;

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/markets?select=*`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const match = data.find(
          (m: any) => m.title && normalizeMarketTitle(m.title) === normalizedTarget
        );
        if (match) {
          const cutMs = match.cutoff_at ? new Date(match.cutoff_at).getTime() : null;
          const createdMs = match.created_at ? new Date(match.created_at).getTime() : Date.now();
          return {
            id: String(match.id),
            title: String(match.title),
            description: match.description || null,
            category: match.category || null,
            creatorWallet: match.creator_wallet || null,
            creatorPlatformId: match.creator || match.creator_platform_id || null,
            platform: (match.platform as any) || "telegram",
            chatId: match.chat_id ? String(match.chat_id) : null,
            messageId: match.message_id ? String(match.message_id) : null,
            phase: (match.phase as any) || "primary",
            cutoffAt: cutMs,
            resolvedOutcome: match.resolved_outcome || null,
            yesPrice: Number(match.yes_price ?? 0.5),
            noPrice: Number(match.no_price ?? 0.5),
            volumeUsdc: Number(match.volume_usdc ?? 50),
            createdAt: createdMs,
          };
        }
      }
    }
  } catch (err: any) {
    console.warn("[findDuplicateInSupabase Warning]:", err.message);
  }

  return undefined;
}

/**
 * Searches for an existing active market with the same or equivalent normalized question/title.
 * Checks Supabase and local SQLite to prevent users from launching duplicate prediction markets.
 */
export async function findDuplicateMarket(title: string): Promise<Market | undefined> {
  const normalizedTarget = normalizeMarketTitle(title);
  if (!normalizedTarget) return undefined;

  // 1. Check Supabase cloud database first (global source of truth)
  const supabaseMatch = await findDuplicateInSupabase(normalizedTarget);
  if (supabaseMatch) return supabaseMatch;

  // 2. Check local SQLite DB
  const activeMarkets = await getActiveMarkets();
  return activeMarkets.find((m) => {
    return normalizeMarketTitle(m.title) === normalizedTarget;
  });
}

// =============================================================================
// Trade Queries
// =============================================================================

/**
 * Records a newly signed and confirmed trade in the local database.
 */
export async function recordTrade(data: NewTrade): Promise<Trade> {
  const [created] = await db.insert(trades).values(data).returning();
  return created;
}

/**
 * Fetches recent trades executed by a specific user across Telegram/Discord.
 */
export async function getRecentTradesForUser(
  platformUserId: string,
  limit = 10
): Promise<Trade[]> {
  return db
    .select()
    .from(trades)
    .where(eq(trades.platformUserId, platformUserId))
    .orderBy(desc(trades.createdAt))
    .limit(limit);
}

/**
 * Fetches recent trades executed on a specific market.
 */
export async function getRecentTradesForMarket(
  marketId: string,
  limit = 10
): Promise<Trade[]> {
  return db
    .select()
    .from(trades)
    .where(eq(trades.marketId, marketId))
    .orderBy(desc(trades.createdAt))
    .limit(limit);
}

/**
 * Marks a recorded trade as reported to Panta API (POST /trades/).
 */
export async function markTradeReported(txSignature: string): Promise<void> {
  await db
    .update(trades)
    .set({ reportedToPanta: 1 })
    .where(eq(trades.txSignature, txSignature));
}

export interface LeaderboardEntry {
  platformUserId: string | null;
  platform: string | null;
  totalVolumeUsdc: number;
  totalTrades: number;
}

/**
 * Returns top users aggregated by total trading volume in USDC.
 */
export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const results = await db
    .select({
      platformUserId: trades.platformUserId,
      platform: trades.platform,
      totalVolumeUsdc: sql<number>`COALESCE(SUM(${trades.spendUsdc}), 0)`.as("totalVolumeUsdc"),
      totalTrades: sql<number>`COUNT(${trades.id})`.as("totalTrades"),
    })
    .from(trades)
    .groupBy(trades.platformUserId, trades.platform)
    .orderBy(sql`totalVolumeUsdc DESC`)
    .limit(limit);

  return results.map((row) => ({
    platformUserId: row.platformUserId,
    platform: row.platform,
    totalVolumeUsdc: Number(row.totalVolumeUsdc) || 0,
    totalTrades: Number(row.totalTrades) || 0,
  }));
}

// =============================================================================
// Session Queries (Signing WebApp & TMA handoffs)
// =============================================================================

/**
 * Creates a signing or transaction session with TTL.
 */
export async function createSession(data: NewSession): Promise<Session> {
  const [created] = await db.insert(sessions).values(data).returning();
  return created;
}

/**
 * Retrieves a session by UUID.
 */
export async function getSessionById(id: string): Promise<Session | undefined> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);
  return session;
}

/**
 * Updates a session status (pending -> signed -> confirmed -> failed / expired).
 */
export async function updateSessionStatus(
  id: string,
  status: Session["status"]
): Promise<Session | undefined> {
  const [updated] = await db
    .update(sessions)
    .set({ status })
    .where(eq(sessions.id, id))
    .returning();
  return updated;
}
