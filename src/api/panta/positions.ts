import { pantaGet, pantaPost } from "./client.js";
import { createSession } from "../../db/queries.js";
import { config } from "../../config.js";

// =============================================================================
// Interfaces & Types
// =============================================================================

export interface UserPosition {
  marketId: string;
  walletAddress: string;
  outcome: "yes" | "no";
  shares: number;
  spendUsdc?: number;
  status: "open" | "won" | "lost" | string;
  isClaimed: boolean;
  claimableUsdc?: number;
  raw?: unknown;
}

export interface ClaimBuildParams {
  marketId: string;
  walletAddress: string;
}

export interface ClaimBuildResponse {
  transaction: string; // Unsigned base64-encoded VersionedTransaction
  marketId: string;
  walletAddress: string;
  claimableUsdc?: number;
  raw?: unknown;
}

export interface CreateClaimSessionParams {
  platformUserId: string;
  platform: "telegram" | "discord";
  chatId: string;
  marketId: string;
  walletAddress?: string;
  estimatedPayoutUsdc?: number;
}

// =============================================================================
// Positions Service
// =============================================================================

/**
 * Fetches user positions from Panta using the strict positionLimiter (60 req/min).
 * Used for balance lookups and winner detection.
 *
 * @param walletAddress Solana wallet public key string
 */
export async function getWalletPositions(walletAddress: string): Promise<UserPosition[]> {
  const raw = await pantaGet<any>(
    "/positions/",
    { params: { wallet: walletAddress } },
    "position"
  );

  const rawList: any[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.positions)
    ? raw.positions
    : Array.isArray(raw?.data)
    ? raw.data
    : [];

  return rawList.map((item) => {
    const outcome = (item.outcome || item.side || "yes").toLowerCase() as "yes" | "no";
    const shares = Number(item.shares || item.amount || 0);
    const spendUsdc = Number(item.spendUsdc || item.costUsdc || 0);
    const status = String(item.status || "open").toLowerCase();
    const isClaimed = Boolean(item.isClaimed || item.claimed || false);
    const claimableUsdc = item.claimableUsdc ? Number(item.claimableUsdc) : undefined;

    return {
      marketId: item.marketId || item.id,
      walletAddress,
      outcome,
      shares,
      spendUsdc,
      status,
      isClaimed,
      claimableUsdc,
      raw: item,
    };
  });
}

/**
 * Filters for positions that have won but have not yet been claimed.
 */
export async function getUnclaimedWinningPositions(walletAddress: string): Promise<UserPosition[]> {
  const positions = await getWalletPositions(walletAddress);
  return positions.filter(
    (pos) => (pos.status === "won" || pos.status === "winner") && !pos.isClaimed
  );
}

/**
 * Compiles unsigned base64 VersionedTransaction to claim winnings.
 * Uses buildLimiter (strictly 20 req/min).
 *
 * CRITICAL INVARIANT: ONLY called when user physically clicks "Claim Winnings" in TMA/WebApp.
 * NEVER call this in background loops or cron jobs!
 */
export async function getClaimBuild(params: ClaimBuildParams): Promise<ClaimBuildResponse> {
  const payload = {
    marketId: params.marketId,
    wallet: params.walletAddress,
  };

  const raw = await pantaPost<any>("/claim/build/", payload, undefined, "build");

  const transaction =
    raw?.transaction || raw?.tx || raw?.base64Transaction || raw?.serializedTx || "";

  return {
    transaction,
    marketId: params.marketId,
    walletAddress: params.walletAddress,
    claimableUsdc: raw?.claimableUsdc ? Number(raw.claimableUsdc) : undefined,
    raw,
  };
}

/**
 * Creates an ephemeral claim session in SQLite and returns the WebApp signing deep link.
 */
export async function createClaimSession(
  params: CreateClaimSessionParams
): Promise<{ sessionId: string; signUrl: string; expiresAt: number }> {
  const sessionId = `sess_claim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 600; // 10 minutes TTL

  const payloadJson = JSON.stringify({
    marketId: params.marketId,
    walletAddress: params.walletAddress,
    estimatedPayoutUsdc: params.estimatedPayoutUsdc,
  });

  await createSession({
    id: sessionId,
    type: "claim",
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
