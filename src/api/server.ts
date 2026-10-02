import express, { type Request, type Response, type Express } from "express";
import cors from "cors";
import { config } from "../config.js";
import { getSessionById, updateSessionStatus, recordTrade, saveMarket, getActiveMarkets } from "../db/queries.js";
import { getMarketById, getMarkets } from "./panta/markets.js";
import { getPrimaryOrderQuote, getPrimaryOrderBuild } from "./panta/trading.js";
import { getCreateBuild, registerMarket } from "./panta/create.js";
import { getClaimBuild } from "./panta/positions.js";
import { getCreatorFeeClaimBuild } from "./panta/claims.js";
import { reportTradeToPanta } from "../services/attribution-reporter.js";
import { solanaConnection, waitForConfirmation } from "../utils/solana.js";
import { pantaGet } from "./panta/client.js";

// =============================================================================
// Express App Initialization
// =============================================================================

export const app: Express = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /api/sessions/:id
 * Retrieves pending signing session with market details, live quote, and base64 transaction.
 */
app.get("/api/sessions/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const walletQuery = (req.query.wallet as string | undefined)?.trim();

  try {
    const session = await getSessionById(id);
    if (!session) {
      return res.status(404).json({
        error: "SESSION_NOT_FOUND",
        message: "Signing session not found or expired.",
      });
    }

    const now = Math.floor(Date.now() / 1000);
    if (session.expiresAt && now > session.expiresAt && session.status === "pending") {
      await updateSessionStatus(session.id, "expired");
      return res.status(410).json({
        error: "SESSION_EXPIRED",
        message: "This signing session has expired. Please re-draft from chat.",
      });
    }

    const payload = JSON.parse(session.payloadJson || "{}");
    const activeWallet = walletQuery || payload.buyerWallet || payload.creatorWallet || payload.walletAddress;

    let marketData: any = null;
    if (session.marketId) {
      marketData = await getMarketById(session.marketId).catch(() => null);
    }

    let quote: any = null;
    let transaction: string = "";

    // 1. Buy Order Sessions
    if (session.type === "buy" && session.marketId) {
      try {
        quote = await getPrimaryOrderQuote({
          marketId: session.marketId,
          outcome: payload.outcome,
          spendUsdc: String(payload.amountUsdc || "10"),
          buyerWallet: activeWallet,
        });
      } catch (err: any) {
        console.warn(`[Session API] Could not fetch quote for session ${id}:`, err.message);
      }

      if (activeWallet) {
        try {
          const build = await getPrimaryOrderBuild({
            marketId: session.marketId,
            outcome: payload.outcome,
            spendUsdc: payload.amountUsdc,
            buyerWallet: activeWallet,
            platformUserId: session.platformUserId || "anonymous",
            quoteId: quote?.quoteId,
          });
          transaction = build.transaction;
        } catch (err: any) {
          console.warn(`[Session API] Could not build primary buy transaction:`, err.message);
        }
      }
    }

    // 2. Create Market Sessions
    else if (session.type === "create") {
      if (activeWallet) {
        try {
          const build = await getCreateBuild({
            title: payload.title,
            description: payload.description,
            category: payload.category,
            cutoffAt: payload.cutoffAt,
            creatorWallet: activeWallet,
          });
          transaction = build.transaction;
          quote = {
            createId: build.createId,
            paymentUsdc: "50000000",
            expectedEventPda: build.eventPda,
          };
        } catch (err: any) {
          console.warn(`[Session API] Could not build create market transaction:`, err.message);
        }
      }
    }

    // 3. Claim Payout Sessions
    else if (session.type === "claim" && session.marketId && activeWallet) {
      try {
        const build = await getClaimBuild({
          marketId: session.marketId,
          walletAddress: activeWallet,
        });
        transaction = build.transaction;
      } catch (err: any) {
        console.warn(`[Session API] Could not build claim transaction:`, err.message);
      }
    }

    // 4. Claim Creator Fee Royalties Sessions
    else if (session.type === "claim_creator" && session.marketId && activeWallet) {
      try {
        const build = await getCreatorFeeClaimBuild({
          marketId: session.marketId,
          creatorWallet: activeWallet,
        });
        transaction = build.transaction;
      } catch (err: any) {
        console.warn(`[Session API] Could not build creator fee claim transaction:`, err.message);
      }
    }

    return res.json({
      session: {
        id: session.id,
        type: session.type,
        status: session.status,
        platformUserId: session.platformUserId,
        platform: session.platform,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
      },
      payload,
      market: marketData,
      quote,
      transaction,
    });
  } catch (err: any) {
    console.error(`[API /sessions/:id Error]:`, err);
    return res.status(500).json({ error: "INTERNAL_ERROR", message: err.message });
  }
});

/**
 * POST /api/sessions/:id/submit
 * Receives signed serialized transaction, broadcasts to Solana Devnet RPC,
 * awaits confirmation, reports attribution to Panta / trades, and updates DB status.
 */
app.post("/api/sessions/:id/submit", async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { signedTx, signature, wallet } = req.body;

  try {
    const session = await getSessionById(id);
    if (!session) {
      return res.status(404).json({ error: "SESSION_NOT_FOUND", message: "Session not found." });
    }

    if (session.status === "confirmed") {
      return res.json({
        success: true,
        status: "confirmed",
        message: "Session is already confirmed.",
      });
    }

    let finalSig = signature;

    // If base64 serialized signed transaction provided, broadcast via Solana RPC
    if (signedTx && !finalSig) {
      const txBuffer = Buffer.from(signedTx, "base64");
      finalSig = await solanaConnection.sendRawTransaction(txBuffer, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
    }

    if (!finalSig) {
      return res.status(400).json({
        error: "MISSING_TRANSACTION",
        message: "Either signedTx or signature must be provided.",
      });
    }

    // Await on-chain confirmation
    const confirmed = await waitForConfirmation(finalSig, 35000);
    if (!confirmed) {
      await updateSessionStatus(session.id, "failed");
      return res.status(408).json({
        error: "TRANSACTION_TIMED_OUT",
        message: "Transaction timed out on Solana RPC without confirmation.",
      });
    }

    const payload = JSON.parse(session.payloadJson || "{}");
    const activeWallet = wallet || payload.buyerWallet || payload.creatorWallet || payload.walletAddress || "";

    // 1. Post-Confirmation for Buy Orders
    if (session.type === "buy" && session.marketId) {
      // Attribution Reporting (POST /trades/)
      await reportTradeToPanta({
        signature: finalSig,
        userId: session.platformUserId || "anonymous",
        marketId: session.marketId,
        platform: session.platform || "telegram",
        chatId: session.chatId || undefined,
      }).catch((reportErr) => {
        console.warn(`[Submit API] Trade attribution report skipped or failed:`, reportErr.message);
      });

      // Record trade in local SQLite DB
      await recordTrade({
        id: `trd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        marketId: session.marketId,
        walletAddress: activeWallet,
        platformUserId: session.platformUserId,
        platform: session.platform,
        chatId: session.chatId,
        outcome: payload.outcome,
        spendUsdc: payload.amountUsdc,
        shares: payload.sharesExpected || 0,
        txSignature: finalSig,
        reportedToPanta: 1,
        createdAt: Math.floor(Date.now() / 1000),
      }).catch((tradeErr) => {
        console.warn(`[Submit API] Local trade record save warning:`, tradeErr.message);
      });
    }

    // 2. Post-Confirmation for Market Creation
    else if (session.type === "create") {
      const eventPda = payload.expectedEventPda || payload.eventPda || `pda_${Date.now()}`;

      // Register market on Panta API
      const registered = await registerMarket({
        eventPda,
        signature: finalSig,
      }).catch((regErr) => {
        console.warn(`[Submit API] Market register warning:`, regErr.message);
        return null;
      });

      // Save market in local DB
      await saveMarket({
        id: registered?.marketId || eventPda,
        title: payload.title,
        description: payload.description,
        category: payload.category,
        creatorWallet: activeWallet,
        creatorPlatformId: session.platformUserId,
        platform: session.platform,
        chatId: session.chatId,
        phase: "primary",
        yesPrice: 0.5,
        noPrice: 0.5,
        volumeUsdc: 0.0,
        createdAt: Math.floor(Date.now() / 1000),
      }).catch((mktErr) => {
        console.warn(`[Submit API] Local market save warning:`, mktErr.message);
      });
    }

    // Mark session confirmed
    await updateSessionStatus(session.id, "confirmed");

    return res.json({
      success: true,
      status: "confirmed",
      signature: finalSig,
      explorerUrl: `${config.EXPLORER_URL_PREFIX}/tx/${finalSig}`,
    });
  } catch (err: any) {
    console.error(`[API /sessions/:id/submit Error]:`, err);
    return res.status(500).json({ error: "SUBMISSION_FAILED", message: err.message });
  }
});

/**
 * GET /api/markets/trending
 * Returns top cached markets from Panta or local SQLite catalog.
 */
app.get("/api/markets/trending", async (_req: Request, res: Response) => {
  try {
    const markets = await getMarkets({ limit: 10 }).catch(async () => {
      return getActiveMarkets();
    });
    return res.json({ markets });
  } catch (err: any) {
    return res.status(500).json({ error: "MARKET_FETCH_FAILED", message: err.message });
  }
});

/**
 * GET /api/health
 * Health check verifying Solana RPC and Panta API connectivity.
 */
app.get("/api/health", async (_req: Request, res: Response) => {
  let rpcSlot: number | null = null;
  let rpcOk = false;
  try {
    rpcSlot = await solanaConnection.getSlot();
    rpcOk = true;
  } catch (err: any) {
    console.warn("[Health Check] Solana RPC unreachable:", err.message);
  }

  let pantaOk = false;
  try {
    await pantaGet("/markets/?limit=1", undefined, "read");
    pantaOk = true;
  } catch (err: any) {
    console.warn("[Health Check] Panta API unreachable:", err.message);
  }

  const isHealthy = rpcOk && pantaOk;

  return res.status(isHealthy ? 200 : 207).json({
    status: isHealthy ? "ok" : "degraded",
    network: config.SOLANA_NETWORK,
    solanaRpc: {
      ok: rpcOk,
      slot: rpcSlot,
      url: config.SOLANA_RPC_URL,
    },
    pantaApi: {
      ok: pantaOk,
      baseUrl: config.PANTA_API_BASE_URL,
    },
    environment: config.PANTA_ENV,
    timestamp: new Date().toISOString(),
  });
});

// =============================================================================
// Server Starter Function
// =============================================================================

export function startServer(port = config.PORT): import("http").Server {
  return app.listen(port, () => {
    console.log(`🌐 [Express API] PantaChat Server running at http://localhost:${port}`);
  });
}
