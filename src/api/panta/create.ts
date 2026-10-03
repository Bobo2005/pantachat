import { pantaPost } from "./client.js";
import { createSession, findDuplicateMarket } from "../../db/queries.js";
import { type Market } from "../../db/schema.js";
import { config } from "../../config.js";

// =============================================================================
// Interfaces & Types
// =============================================================================

export class DuplicateMarketError extends Error {
  public readonly existingMarket: Market;

  constructor(existingMarket: Market) {
    super(`An active prediction market for "${existingMarket.title}" is already live.`);
    this.name = "DuplicateMarketError";
    this.existingMarket = existingMarket;
    Object.setPrototypeOf(this, DuplicateMarketError.prototype);
  }
}

export interface CreateQuoteParams {
  title: string;
  category: string;
  cutoffAt: string | number;
  description?: string;
  creatorWallet?: string;
  sourcesOfTruth?: string[];
}

export interface CreateQuoteResponse {
  createId?: string;
  expectedEventPda?: string;
  eventPda?: string;
  paymentUsdc: string;
  feeBaseUnits: number;
}

export interface CreateBuildParams {
  createId?: string;
  title: string;
  description: string;
  category: string;
  cutoffAt: string;
  creatorWallet: string;
}

export interface CreateBuildResponse {
  transaction: string; // base64-encoded VersionedTransaction
  createId?: string;
  eventPda?: string;
}

export interface RegisterMarketParams {
  signature: string;
  eventPda: string;
}

export interface RegisterMarketResponse {
  marketId: string;
  status: string;
  raw?: unknown;
}

export interface InitiateCreationSessionParams {
  platformUserId: string;
  platform: "telegram" | "discord";
  chatId: string;
  title: string;
  description: string;
  category: string;
  cutoffAt: string;
  creatorWallet?: string;
}

// =============================================================================
// Pipeline Functions
// =============================================================================

/**
 * Derives market creation quote, fee (50 USDC in base units), and expected event PDA.
 * Calls POST /markets/create/quote/
 */
export async function getCreateQuote(params: CreateQuoteParams): Promise<CreateQuoteResponse> {
  const cutoffSeconds =
    typeof params.cutoffAt === "number"
      ? params.cutoffAt < 10000000000
        ? params.cutoffAt
        : Math.floor(params.cutoffAt / 1000)
      : Math.floor(new Date(params.cutoffAt).getTime() / 1000);

  const nowSec = Math.floor(Date.now() / 1000);
  // Panta MarketConfig requires minimumStartDelay >= 3600 seconds (1 hour)
  const startTime = nowSec + 3700;
  const endTime = Math.max(startTime + 3600, cutoffSeconds);
  const resolutionTime = endTime + 3600;

  // Use provider or standard Devnet testing wallet if none supplied
  const wallet = params.creatorWallet || "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";

  const payload = {
    wallet,
    question: params.title,
    title: params.title,
    resolutionRule: params.description || `Resolves according to official outcome for: ${params.title}`,
    description: params.description || `Resolves according to official outcome for: ${params.title}`,
    sourcesOfTruth:
      params.sourcesOfTruth && params.sourcesOfTruth.length > 0
        ? params.sourcesOfTruth
        : ["https://coingecko.com"],
    category: params.category.toLowerCase(),
    startTime,
    endTime,
    resolutionTime,
    imageUrl: "https://panta.market/logo.png",
  };

  const raw = await pantaPost<any>("/markets/create/quote/", payload, undefined, "read");

  const createId = raw?.createId || raw?.id || raw?.quoteId;
  const eventPda = raw?.expectedEventPda || raw?.eventPda || raw?.pda;
  const paymentUsdc = String(raw?.paymentUsdc || raw?.fee || raw?.amount || "50000000");
  const feeBaseUnits = parseInt(paymentUsdc, 10) || 50000000;

  return {
    createId,
    expectedEventPda: eventPda,
    eventPda,
    paymentUsdc,
    feeBaseUnits,
  };
}

/**
 * Compiles unsigned base64-encoded VersionedTransaction for market creation.
 * Calls POST /markets/create/build/ using strict buildLimiter (20 req/min quota).
 */
export async function getCreateBuild(params: CreateBuildParams): Promise<CreateBuildResponse> {
  let createId = params.createId;

  // If createId was not pre-fetched, obtain one via create quote first
  if (!createId) {
    const quote = await getCreateQuote({
      title: params.title,
      description: params.description,
      category: params.category,
      cutoffAt: params.cutoffAt,
      creatorWallet: params.creatorWallet,
    });
    createId = quote.createId;
  }

  const payload = {
    createId,
    wallet: params.creatorWallet,
    title: params.title,
    description: params.description,
    category: params.category.toLowerCase(),
  };

  const raw = await pantaPost<any>("/markets/create/build/", payload, undefined, "build");

  const transaction =
    raw?.transaction || raw?.tx || raw?.base64Transaction || raw?.serializedTx || "";

  return {
    transaction,
    createId,
    eventPda: raw?.eventPda || raw?.expectedEventPda,
  };
}

/**
 * Finalizes the market on Panta indexer after on-chain Solana broadcast.
 * Calls POST /markets/register/
 */
export async function registerMarket(params: RegisterMarketParams): Promise<RegisterMarketResponse> {
  const payload = {
    signature: params.signature,
    eventPda: params.eventPda,
  };

  const raw = await pantaPost<any>("/markets/register/", payload, undefined, "none");
  const marketId = raw?.marketId || raw?.id || params.eventPda;

  return {
    marketId,
    status: raw?.status || "registered",
    raw,
  };
}

/**
 * Initiates an ephemeral market creation signing session.
 * Stores pending state in SQLite sessions table with 10-minute TTL
 * and generates TMA / WebApp deep link.
 */
export async function initiateMarketCreationSession(
  params: InitiateCreationSessionParams
): Promise<{ sessionId: string; signUrl: string; expiresAt: number }> {
  // Prevent users from launching the same active prediction market twice
  const existing = await findDuplicateMarket(params.title);
  if (existing) {
    throw new DuplicateMarketError(existing);
  }

  const sessionId = `sess_create_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 600; // 10 minutes TTL

  const payloadJson = JSON.stringify({
    title: params.title,
    description: params.description,
    category: params.category,
    cutoffAt: params.cutoffAt,
    creatorWallet: params.creatorWallet,
  });

  await createSession({
    id: sessionId,
    type: "create",
    platformUserId: params.platformUserId,
    platform: params.platform,
    chatId: params.chatId,
    payloadJson,
    status: "pending",
    createdAt: now,
    expiresAt,
  });

  const queryParams = new URLSearchParams({
    session: sessionId,
    type: "create",
    title: params.title,
    category: params.category,
    chatId: params.chatId,
    platform: params.platform,
    creator: params.platformUserId,
    desc: params.description || "",
  });
  const signUrl = `${config.WEBAPP_URL}/sign?${queryParams.toString()}`;

  return {
    sessionId,
    signUrl,
    expiresAt,
  };
}
