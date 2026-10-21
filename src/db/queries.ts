import { eq, or, desc, sql, and, ne } from "drizzle-orm";
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
 * Helper to sync updates to Supabase REST API in the background.
 */
export async function syncMarketToSupabase(id: string, patch: Record<string, any>): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return;

  try {
    await fetch(`${supabaseUrl}/rest/v1/markets?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patch),
    });
  } catch (sbErr: any) {
    console.warn("[syncMarketToSupabase Warning]:", sbErr.message);
  }
}

/**
 * Updates market lifecycle phase (primary -> secondary -> resolved).
 */
export async function updateMarketPhase(
  id: string,
  phase: "primary" | "secondary" | "resolved",
  resolvedOutcome?: "yes" | "no" | "void"
): Promise<Market | undefined> {
  const updateData: Partial<NewMarket> = { phase };
  if (resolvedOutcome) {
    updateData.resolvedOutcome = resolvedOutcome;
    updateData.resolutionStatus = resolvedOutcome === "void" ? "void" : "resolved";
  }

  const [updated] = await db
    .update(markets)
    .set(updateData)
    .where(eq(markets.id, id))
    .returning();

  syncMarketToSupabase(id, {
    phase,
    resolved_outcome: resolvedOutcome || null,
    resolution_status: resolvedOutcome ? (resolvedOutcome === "void" ? "void" : "resolved") : undefined,
  });

  return updated;
}

/**
 * Updates resolution status ('open' | 'closed' | 'proposed' | 'resolved' | 'disputed' | 'void').
 */
export async function updateMarketResolutionStatus(
  id: string,
  resolutionStatus: "open" | "closed" | "proposed" | "resolved" | "disputed" | "void"
): Promise<Market | undefined> {
  const [updated] = await db
    .update(markets)
    .set({ resolutionStatus })
    .where(eq(markets.id, id))
    .returning();

  syncMarketToSupabase(id, { resolution_status: resolutionStatus });
  return updated;
}

/**
 * Proposes a resolution outcome along with evidence and activates the 2-hour dispute challenge window.
 */
export async function proposeMarketOutcome(
  id: string,
  data: {
    proposedOutcome: "yes" | "no" | "void";
    evidenceUrl: string;
    evidenceSummary: string;
    confidenceScore: number;
    disputeUntil: number; // Unix timestamp in seconds
  }
): Promise<Market | undefined> {
  const [updated] = await db
    .update(markets)
    .set({
      resolutionStatus: "proposed",
      proposedOutcome: data.proposedOutcome,
      evidenceUrl: data.evidenceUrl,
      evidenceSummary: data.evidenceSummary,
      confidenceScore: data.confidenceScore,
      disputeUntil: data.disputeUntil,
    })
    .where(eq(markets.id, id))
    .returning();

  syncMarketToSupabase(id, {
    resolution_status: "proposed",
    proposed_outcome: data.proposedOutcome,
    evidence_url: data.evidenceUrl,
    evidence_summary: data.evidenceSummary,
    confidence_score: data.confidenceScore,
    dispute_until: data.disputeUntil,
  });

  return updated;
}

/**
 * Flags a market resolution proposal as disputed by community traders.
 */
export async function disputeMarketOutcome(
  id: string,
  reason?: string
): Promise<Market | undefined> {
  const current = await getMarketById(id);
  const newCount = (current?.disputeCount || 0) + 1;

  const [updated] = await db
    .update(markets)
    .set({
      resolutionStatus: "disputed",
      disputeCount: newCount,
    })
    .where(eq(markets.id, id))
    .returning();

  syncMarketToSupabase(id, {
    resolution_status: "disputed",
    dispute_count: newCount,
  });

  return updated;
}

/**
 * Finalizes resolution of a market (sets phase to resolved and resolved_outcome).
 */
export async function resolveMarketFinal(
  id: string,
  finalOutcome: "yes" | "no" | "void"
): Promise<Market | undefined> {
  const resolutionStatus = finalOutcome === "void" ? "void" : "resolved";
  const [updated] = await db
    .update(markets)
    .set({
      phase: "resolved",
      resolutionStatus,
      resolvedOutcome: finalOutcome,
    })
    .where(eq(markets.id, id))
    .returning();

  syncMarketToSupabase(id, {
    phase: "resolved",
    resolution_status: resolutionStatus,
    resolved_outcome: finalOutcome,
  });

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
 * Retrieves all markets where trading has closed or cutoff expired, pending automated AI verification.
 */
export async function getMarketsPendingResolution(): Promise<Market[]> {
  return db
    .select()
    .from(markets)
    .where(
      and(
        ne(markets.phase, "resolved"),
        or(eq(markets.resolutionStatus, "open"), eq(markets.resolutionStatus, "closed"))
      )
    );
}

/**
 * Retrieves all markets currently within the 2-hour dispute challenge window ('proposed').
 */
export async function getProposedMarkets(): Promise<Market[]> {
  return db
    .select()
    .from(markets)
    .where(eq(markets.resolutionStatus, "proposed"));
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
            resolutionStatus: (match.resolution_status as any) || "open",
            proposedOutcome: match.proposed_outcome || null,
            disputeUntil: match.dispute_until ? Number(match.dispute_until) : null,
            evidenceUrl: match.evidence_url || null,
            evidenceSummary: match.evidence_summary || null,
            confidenceScore: match.confidence_score !== undefined ? Number(match.confidence_score) : null,
            disputeCount: Number(match.dispute_count || 0),
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
 * Can be scoped to a specific group/channel chatId or platform.
 */
export async function getLeaderboard(
  limit = 10,
  chatId?: string,
  platform?: "telegram" | "discord"
): Promise<LeaderboardEntry[]> {
  const conditions = [];
  if (chatId) {
    conditions.push(eq(trades.chatId, chatId));
  }
  if (platform) {
    conditions.push(eq(trades.platform, platform));
  }

  const baseQuery = db
    .select({
      platformUserId: trades.platformUserId,
      platform: trades.platform,
      totalVolumeUsdc: sql<number>`COALESCE(SUM(${trades.spendUsdc}), 0)`.as("totalVolumeUsdc"),
      totalTrades: sql<number>`COUNT(${trades.id})`.as("totalTrades"),
    })
    .from(trades);

  const queryWithWhere = conditions.length > 0
    ? (baseQuery as any).where(and(...conditions))
    : baseQuery;

  const results = await queryWithWhere
    .groupBy(trades.platformUserId, trades.platform)
    .orderBy(sql`totalVolumeUsdc DESC`)
    .limit(limit);

  return results.map((row: any) => ({
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

/**
 * Retrieves the top trending prediction markets sorted by trading volume.
 * Fallbacks to Supabase if fewer than requested count exist in local SQLite.
 */
export async function getTrendingMarkets(limit: number = 3): Promise<Market[]> {
  try {
    const live = await db
      .select()
      .from(markets)
      .where(or(eq(markets.phase, "primary"), eq(markets.phase, "secondary")))
      .orderBy(desc(markets.volumeUsdc))
      .limit(limit);

    if (live.length >= limit) {
      return live;
    }

    // Check Supabase if local DB has fewer than desired limit
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      const res = await fetch(`${supabaseUrl}/rest/v1/markets?select=*&order=volume_usdc.desc&limit=${limit}`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mapped: Market[] = data.map((m: any) => ({
            id: m.id,
            title: m.title,
            description: m.description,
            category: m.category || "Crypto",
            creatorWallet: m.creator_wallet,
            creatorPlatformId: m.creator_platform_id,
            platform: m.platform,
            chatId: m.chat_id,
            messageId: m.message_id,
            phase: m.phase || "primary",
            cutoffAt: m.cutoff_at,
            resolvedOutcome: m.resolved_outcome,
            resolutionStatus: (m.resolution_status as any) || "open",
            proposedOutcome: m.proposed_outcome || null,
            disputeUntil: m.dispute_until ? Number(m.dispute_until) : null,
            evidenceUrl: m.evidence_url || null,
            evidenceSummary: m.evidence_summary || null,
            confidenceScore: m.confidence_score !== undefined ? Number(m.confidence_score) : null,
            disputeCount: Number(m.dispute_count || 0),
            yesPrice: Number(m.yes_price ?? 0.5),
            noPrice: Number(m.no_price ?? 0.5),
            volumeUsdc: Number(m.volume_usdc ?? 50),
            createdAt: m.created_at ? Math.floor(new Date(m.created_at).getTime() / 1000) : Math.floor(Date.now() / 1000),
          }));

          // Merge without duplicates
          const seen = new Set(live.map((m) => m.id));
          const combined = [...live];
          for (const m of mapped) {
            if (!seen.has(m.id)) {
              seen.add(m.id);
              combined.push(m);
            }
          }
          return combined.sort((a, b) => (b.volumeUsdc || 0) - (a.volumeUsdc || 0)).slice(0, limit);
        }
      }
    }

    return live;
  } catch (err: any) {
    console.warn("[getTrendingMarkets Error]:", err.message);
    return [];
  }
}
