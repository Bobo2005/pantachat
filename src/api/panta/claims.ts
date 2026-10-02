import { pantaPost, PantaApiError } from "./client.js";
import { getMarketById } from "./markets.js";
import { createSession } from "../../db/queries.js";
import { config } from "../../config.js";

// =============================================================================
// Interfaces & Types
// =============================================================================

export interface CreatorFeeClaimParams {
  marketId: string;
  creatorWallet: string;
  currentPhase?: string;
}

export interface CreatorFeeClaimResponse {
  transaction: string; // Unsigned base64-encoded VersionedTransaction
  marketId: string;
  creatorWallet: string;
  claimableFeesUsdc?: number;
  raw?: unknown;
}

export interface CreateCreatorClaimSessionParams {
  platformUserId: string;
  platform: "telegram" | "discord";
  chatId: string;
  marketId: string;
  creatorWallet?: string;
  claimableUsdc?: number;
}

// =============================================================================
// Creator Royalties Claim Pipeline
// =============================================================================

/**
 * Builds an unsigned base64 VersionedTransaction for claiming unlocked creator fee royalties.
 *
 * CRITICAL INVARIANTS (memory.md):
 * 1. Checks that the market has graduated to `phase: "secondary"` before building.
 *    If still in `phase: "primary"`, aborts and prevents a 400 MARKET_NOT_GRADUATED error.
 * 2. Uses strict buildLimiter (20 req/min).
 * 3. WARNING: DO NOT report this claim transaction to POST /trades/!
 *    Claim transactions do not represent buy orders and will throw TX_MISMATCH.
 */
export async function getCreatorFeeClaimBuild(
  params: CreatorFeeClaimParams
): Promise<CreatorFeeClaimResponse> {
  const { marketId, creatorWallet } = params;

  // Step 1: Pre-validation of graduation state to protect the 20/min build quota
  let phase = params.currentPhase;
  if (!phase) {
    try {
      const market = await getMarketById(marketId);
      phase = market.phase;
    } catch (err) {
      // If market lookup fails, continue to Panta check
    }
  }

  if (phase && phase !== "secondary") {
    throw new PantaApiError(
      `Market ${marketId} has not graduated to secondary trading yet (Current phase: ${phase}). Creator royalties unlock exclusively upon graduation.`,
      "MARKET_NOT_GRADUATED",
      400
    );
  }

  // Step 2: Call Panta creator fee build endpoint with buildLimiter
  const payload = {
    marketId,
    wallet: creatorWallet,
  };

  const raw = await pantaPost<any>("/claim/creator-fees/build/", payload, undefined, "build");

  const transaction =
    raw?.transaction || raw?.tx || raw?.base64Transaction || raw?.serializedTx || "";

  return {
    transaction,
    marketId,
    creatorWallet,
    claimableFeesUsdc: raw?.claimableFeesUsdc ? Number(raw.claimableFeesUsdc) : undefined,
    raw,
  };
}

/**
 * Creates an ephemeral claim_creator session in SQLite and returns the WebApp signing deep link.
 */
export async function createCreatorClaimSession(
  params: CreateCreatorClaimSessionParams
): Promise<{ sessionId: string; signUrl: string; expiresAt: number }> {
  const sessionId = `sess_creator_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 600; // 10 minutes TTL

  const payloadJson = JSON.stringify({
    marketId: params.marketId,
    creatorWallet: params.creatorWallet,
    claimableUsdc: params.claimableUsdc,
  });

  await createSession({
    id: sessionId,
    type: "claim_creator",
    marketId: params.marketId,
    platformUserId: params.platformUserId,
    platform: params.platform,
    chatId: params.chatId,
    payloadJson,
    status: "pending",
    createdAt: now,
    expiresAt,
  });

  const signUrl = `${config.WEBAPP_URL}/sign?session=${sessionId}`;

  return {
    sessionId,
    signUrl,
    expiresAt,
  };
}
