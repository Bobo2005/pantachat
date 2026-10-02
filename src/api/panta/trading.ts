import { createHash } from "node:crypto";
import { pantaPost } from "./client.js";
import { createSession } from "../../db/queries.js";
import { config } from "../../config.js";

// =============================================================================
// Interfaces & Types
// =============================================================================

export interface PrimaryOrderQuoteParams {
  marketId: string;
  outcome: "yes" | "no";
  spendUsdc: string | number;
  buyerWallet?: string;
}

export interface PrimaryOrderQuoteResponse {
  quoteId: string;
  estimatedShares: number;
  feeUsdc: number;
  effectivePrice: number;
  raw?: unknown;
}

export interface PrimaryOrderBuildParams {
  marketId: string;
  outcome: "yes" | "no";
  spendUsdc: string | number;
  buyerWallet: string;
  platformUserId: string;
  quoteId?: string;
  maxSlippageBps?: number;
}

export interface PrimaryOrderBuildResponse {
  transaction: string; // Unsigned base64-encoded VersionedTransaction
  quoteId?: string;
  raw?: unknown;
}

export interface ReportTradeParams {
  signature: string;
  userId: string;
  marketId: string;
}

export interface CreateTradeSessionParams {
  platformUserId: string;
  platform: "telegram" | "discord";
  chatId: string;
  marketId: string;
  outcome: "yes" | "no";
  amountUsdc: number;
  buyerWallet?: string;
}

export interface TradeSessionResult {
  sessionId: string;
  signUrl: string;
  marketId: string;
  outcome: "yes" | "no";
  amountUsdc: number;
  expiresAt: number;
}

// =============================================================================
// User ID Normalizer for Attribution (memory.md)
// =============================================================================

/**
 * Derives a consistent pseudonymous Panta user identifier from Telegram or Discord user ID.
 * Format: usr_<16_hex_chars>
 */
export function derivePantaUserId(platformUserId: string): string {
  const hash = createHash("sha256").update(platformUserId).digest("hex").slice(0, 16);
  return `usr_${hash}`;
}

// =============================================================================
// Trading Pipeline Functions
// =============================================================================

/**
 * Requests a primary order quote on the bonding curve.
 * Calls POST /primaryorderquote/
 *
 * @param params marketId, outcome ('yes'|'no'), spendUsdc human string (e.g. "20.00")
 */
export async function getPrimaryOrderQuote(
  params: PrimaryOrderQuoteParams
): Promise<PrimaryOrderQuoteResponse> {
  const humanAmount =
    typeof params.spendUsdc === "number" ? params.spendUsdc.toFixed(2) : params.spendUsdc;

  const wallet = params.buyerWallet || "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";

  const payload = {
    wallet,
    marketId: params.marketId,
    side: params.outcome.toLowerCase(),
    outcome: params.outcome.toLowerCase(),
    amountUsdc: humanAmount,
    spendUsdc: humanAmount,
  };

  const raw = await pantaPost<any>("/primaryorderquote/", payload, undefined, "read");

  const quoteId = raw?.quoteId || raw?.id || `quote_${Date.now()}`;
  const estimatedShares = Number(raw?.estimatedShares || raw?.shares || 0);
  const feeUsdc = Number(raw?.feeUsdc || raw?.fee || 0);
  const effectivePrice = Number(raw?.effectivePrice || raw?.price || 0.5);

  return {
    quoteId,
    estimatedShares,
    feeUsdc,
    effectivePrice,
    raw,
  };
}

/**
 * Compiles an unsigned base64 Solana VersionedTransaction for primary buy orders.
 * Strictly throttled by buildLimiter (20 req/min quota).
 *
 * @param params marketId, outcome, spendUsdc, buyerWallet, platformUserId, maxSlippageBps
 */
export async function getPrimaryOrderBuild(
  params: PrimaryOrderBuildParams
): Promise<PrimaryOrderBuildResponse> {
  const humanAmount =
    typeof params.spendUsdc === "number" ? params.spendUsdc.toFixed(2) : params.spendUsdc;

  const pantaUserId = derivePantaUserId(params.platformUserId);
  const slippageBps = params.maxSlippageBps ?? 300; // Default 3.0% slippage protection

  let quoteId = params.quoteId;
  if (!quoteId) {
    const quote = await getPrimaryOrderQuote({
      marketId: params.marketId,
      outcome: params.outcome,
      spendUsdc: humanAmount,
      buyerWallet: params.buyerWallet,
    });
    quoteId = quote.quoteId;
  }

  const payload = {
    quoteId,
    wallet: params.buyerWallet,
    buyerWallet: params.buyerWallet,
    marketId: params.marketId,
    side: params.outcome.toLowerCase(),
    outcome: params.outcome.toLowerCase(),
    amountUsdc: humanAmount,
    spendUsdc: humanAmount,
    maxSlippageBps: slippageBps,
    userId: pantaUserId,
  };

  const raw = await pantaPost<any>("/primaryorderbuild/", payload, undefined, "build");

  const transaction =
    raw?.transaction || raw?.tx || raw?.base64Transaction || raw?.serializedTx || "";

  return {
    transaction,
    quoteId,
    raw,
  };
}

/**
 * Explicitly reports a confirmed trade on-chain signature to Panta for partner attribution.
 * Must only be called AFTER Solana RPC commitment 'confirmed'.
 * Calls POST /trades/
 */
export async function reportTrade(params: ReportTradeParams): Promise<{ success: boolean; data?: unknown }> {
  const payload = {
    signature: params.signature,
    userId: params.userId.startsWith("usr_") ? params.userId : derivePantaUserId(params.userId),
    marketId: params.marketId,
  };

  const res = await pantaPost<any>("/trades/", payload, undefined, "none");
  return {
    success: true,
    data: res,
  };
}

/**
 * Helper to record a pending trade session in SQLite and generate the signing deep link.
 * Supports preset values ($5, $20) and arbitrary custom amounts.
 */
export async function createTradeSession(
  params: CreateTradeSessionParams
): Promise<TradeSessionResult> {
  const sessionId = `sess_buy_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 600; // 10 minutes TTL

  const pantaUserId = derivePantaUserId(params.platformUserId);

  const payloadJson = JSON.stringify({
    marketId: params.marketId,
    outcome: params.outcome,
    amountUsdc: params.amountUsdc,
    buyerWallet: params.buyerWallet,
    pantaUserId,
  });

  await createSession({
    id: sessionId,
    type: "buy",
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
    marketId: params.marketId,
    outcome: params.outcome,
    amountUsdc: params.amountUsdc,
    expiresAt,
  };
}
