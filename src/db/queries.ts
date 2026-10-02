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
