import {
  getActiveMarkets,
  getMarketsPendingResolution,
  getProposedMarkets,
  updateMarketPhase,
  updateMarketResolutionStatus,
  proposeMarketOutcome,
  resolveMarketFinal,
  getRecentTradesForMarket,
} from "../db/queries.js";
import { pantaGet } from "../api/panta/client.js";
import { createClaimSession } from "../api/panta/positions.js";
import { verifyMarketOutcome } from "./ai-oracle.js";
import { isCutoffExpired } from "../utils/formatters.js";

// =============================================================================
// Interfaces & Types
// =============================================================================

export interface WinnerNotification {
  marketId: string;
  marketTitle: string;
  platform: "telegram" | "discord";
  chatId: string;
  platformUserId: string;
  walletAddress?: string;
  resolvedOutcome: "yes" | "no" | "void";
  shares: number;
  estimatedPayoutUsdc: number;
  messageText: string;
  claimUrl: string;
}

export type WinnerNotificationHandler = (notification: WinnerNotification) => Promise<void> | void;

export interface ProposedResolutionNotification {
  marketId: string;
  marketTitle: string;
  platform: "telegram" | "discord";
  chatId: string;
  proposedOutcome: "yes" | "no" | "void";
  evidenceUrl: string;
  evidenceSummary: string;
  confidenceScore: number;
  disputeUntil: number;
}

export type ProposedResolutionHandler = (
  notification: ProposedResolutionNotification
) => Promise<void> | void;

export interface DisputeNotification {
  marketId: string;
  marketTitle: string;
  platform: "telegram" | "discord";
  chatId: string;
  disputerPlatformUserId: string;
  reason?: string;
  disputeCount: number;
}

export type DisputeNotificationHandler = (
  notification: DisputeNotification
) => Promise<void> | void;

const notificationHandlers: WinnerNotificationHandler[] = [];
const proposedResolutionHandlers: ProposedResolutionHandler[] = [];
const disputeNotificationHandlers: DisputeNotificationHandler[] = [];

/**
 * Registers a bot callback to broadcast celebratory claim alerts in Telegram/Discord.
 */
export function registerWinnerNotificationHandler(handler: WinnerNotificationHandler): void {
  notificationHandlers.push(handler);
}

/**
 * Registers a bot callback to broadcast 2-hour dispute challenge cards in Telegram/Discord.
 */
export function registerProposedResolutionHandler(handler: ProposedResolutionHandler): void {
  proposedResolutionHandlers.push(handler);
}

/**
 * Registers a bot callback to alert admins/community when a proposed resolution is disputed.
 */
export function registerDisputeNotificationHandler(handler: DisputeNotificationHandler): void {
  disputeNotificationHandlers.push(handler);
}

/**
 * Dispatches a dispute alert notification to registered handlers.
 */
export async function dispatchDisputeNotification(notification: DisputeNotification): Promise<void> {
  for (const handler of disputeNotificationHandlers) {
    try {
      await handler(notification);
    } catch (err: any) {
      console.warn("[Notify] Dispute notification handler error:", err.message);
    }
  }
}

// =============================================================================
// Payout & Winner Claim Dispatcher Helper
// =============================================================================

async function finalizeAndBroadcastWinners(
  market: { id: string; title: string; chatId?: string | null; platform?: string | null },
  resolvedOutcome: "yes" | "no" | "void"
): Promise<void> {
  const allTrades = await getRecentTradesForMarket(market.id, 100);

  // If outcome is void, all trades are refunded
  // If yes/no, only trades matching outcome win
  const eligibleTrades =
    resolvedOutcome === "void"
      ? allTrades
      : allTrades.filter((t) => t.outcome?.toLowerCase() === resolvedOutcome);

  // Group by user to consolidate winning positions
  const userWinners = new Map<
    string,
    {
      platformUserId: string;
      platform: "telegram" | "discord";
      chatId: string;
      walletAddress?: string;
      totalShares: number;
      totalCost: number;
    }
  >();

  for (const trade of eligibleTrades) {
    if (!trade.platformUserId) continue;
    const key = `${trade.platform || "telegram"}:${trade.platformUserId}`;
    const existing = userWinners.get(key) || {
      platformUserId: trade.platformUserId,
      platform: (trade.platform || "telegram") as "telegram" | "discord",
      chatId: trade.chatId || market.chatId || "",
      walletAddress: trade.walletAddress || undefined,
      totalShares: 0,
      totalCost: 0,
    };

    existing.totalShares += trade.shares || 0;
    existing.totalCost += trade.spendUsdc || 0;
    userWinners.set(key, existing);
  }

  // Send celebratory winner alerts with deep-linked claim sessions
  for (const winner of userWinners.values()) {
    const estimatedPayoutUsdc =
      resolvedOutcome === "void"
        ? winner.totalCost
        : winner.totalShares > 0
        ? winner.totalShares
        : winner.totalCost * 1.5;

    const claimSession = await createClaimSession({
      platformUserId: winner.platformUserId,
      platform: winner.platform,
      chatId: winner.chatId,
      marketId: market.id,
      walletAddress: winner.walletAddress,
      estimatedPayoutUsdc,
    });

    const userTag = winner.platformUserId.startsWith("@")
      ? winner.platformUserId
      : `@${winner.platformUserId}`;

    const messageText =
      resolvedOutcome === "void"
        ? `⚪ *Market Declared VOID!* "${market.title}"\n` +
          `Event was canceled, postponed indefinitely, or unresolvable.\n\n` +
          `${userTag} full refund available: *${estimatedPayoutUsdc.toFixed(2)} USDC*.\n` +
          `Tap below to claim your refund directly to your wallet.`
        : `🎉 *Market Resolved!* "${market.title}"\n` +
          `🏆 Outcome: *${resolvedOutcome.toUpperCase()} WON!*\n\n` +
          `${userTag} won estimated *${estimatedPayoutUsdc.toFixed(2)} USDC*!\n` +
          `Tap below to claim your payout directly to your wallet.`;

    const notification: WinnerNotification = {
      marketId: market.id,
      marketTitle: market.title,
      platform: winner.platform,
      chatId: winner.chatId,
      platformUserId: winner.platformUserId,
      walletAddress: winner.walletAddress,
      resolvedOutcome,
      shares: winner.totalShares,
      estimatedPayoutUsdc,
      messageText,
      claimUrl: claimSession.signUrl,
    };

    for (const handler of notificationHandlers) {
      try {
        await handler(notification);
      } catch (handlerErr) {
        console.error("[Poller] Notification handler error:", handlerErr);
      }
    }
  }
}

// =============================================================================
// Resolution Poller Core Engine
// =============================================================================

/**
 * Scans markets at cutoff timestamp, runs AI verification, manages 2-hour dispute window,
 * and executes automated consensus finalization.
 */
export async function checkMarketResolutionsOnce(): Promise<number> {
  let resolvedCount = 0;

  // ---------------------------------------------------------------------------
  // 1. Scan for expired markets and run Evidence-First AI Oracle
  // ---------------------------------------------------------------------------
  try {
    const pendingMarkets = await getMarketsPendingResolution();
    for (const market of pendingMarkets) {
      if (!isCutoffExpired(market.cutoffAt)) {
        continue;
      }

      // Immediately set resolution_status = 'closed' to lock out late bets
      if (market.resolutionStatus === "open") {
        await updateMarketResolutionStatus(market.id, "closed");
      }

      // Run AI Oracle verification with strict confidence thresholds
      try {
        const oracleResult = await verifyMarketOutcome(market);

        if (
          oracleResult.isOfficialFinished &&
          oracleResult.confidence >= 0.95 &&
          (oracleResult.outcome === "yes" || oracleResult.outcome === "no" || oracleResult.outcome === "void")
        ) {
          const disputeUntil = Math.floor(Date.now() / 1000) + 7200; // 2 hours in seconds

          await proposeMarketOutcome(market.id, {
            proposedOutcome: oracleResult.outcome,
            evidenceUrl: oracleResult.evidenceUrl,
            evidenceSummary: oracleResult.evidenceSummary,
            confidenceScore: oracleResult.confidence,
            disputeUntil,
          });

          console.log(
            `[AI Oracle] Market ${market.id} proposed outcome: ${oracleResult.outcome.toUpperCase()} (dispute until ${new Date(disputeUntil * 1000).toISOString()})`
          );

          // Broadcast proposed resolution card to chat
          for (const handler of proposedResolutionHandlers) {
            try {
              await handler({
                marketId: market.id,
                marketTitle: market.title,
                platform: (market.platform || "telegram") as "telegram" | "discord",
                chatId: market.chatId || "",
                proposedOutcome: oracleResult.outcome,
                evidenceUrl: oracleResult.evidenceUrl,
                evidenceSummary: oracleResult.evidenceSummary,
                confidenceScore: oracleResult.confidence,
                disputeUntil,
              });
            } catch (broadcastErr: any) {
              console.warn(`[Broadcast] Proposed resolution notice error for ${market.id}:`, broadcastErr.message);
            }
          }
        }
      } catch (oracleErr: any) {
        console.warn(`[AI Oracle] Market ${market.id} check error:`, oracleErr.message);
      }
    }
  } catch (err: any) {
    console.error("[Poller] Error scanning pending markets:", err.message);
  }

  // ---------------------------------------------------------------------------
  // 2. Auto-finalize undisputed proposed markets when 2h window expires
  // ---------------------------------------------------------------------------
  try {
    const proposedMarkets = await getProposedMarkets();
    const nowMs = Date.now();

    for (const market of proposedMarkets) {
      if (!market.disputeUntil) continue;
      const disputeMs =
        market.disputeUntil < 10000000000 ? market.disputeUntil * 1000 : market.disputeUntil;

      // Has 2-hour dispute challenge window expired?
      if (nowMs >= disputeMs) {
        // If 0 active disputes, auto-finalize!
        if ((market.disputeCount || 0) === 0) {
          const finalOutcome = market.proposedOutcome || "yes";
          await resolveMarketFinal(market.id, finalOutcome);
          resolvedCount++;

          console.log(
            `[Poller] Auto-finalized undisputed market ${market.id} as ${finalOutcome.toUpperCase()}`
          );

          await finalizeAndBroadcastWinners(market, finalOutcome);
        } else {
          console.log(
            `[Poller] Market ${market.id} dispute window passed but has ${market.disputeCount} active disputes. Auto-finalization halted.`
          );
        }
      }
    }
  } catch (err: any) {
    console.error("[Poller] Error auto-finalizing proposed markets:", err.message);
  }

  // ---------------------------------------------------------------------------
  // 3. Fallback: Check external Panta API for graduated or secondary resolutions
  // ---------------------------------------------------------------------------
  try {
    const activeMarkets = await getActiveMarkets();
    for (const market of activeMarkets) {
      try {
        const raw = await pantaGet<any>(`/markets/${market.id}/`, undefined, "read", 9);
        const pantaData = raw?.market || raw?.data || raw;

        const isResolved =
          pantaData?.phase === "resolved" ||
          pantaData?.status === "resolved" ||
          pantaData?.resolved === true;

        if (!isResolved) continue;

        const outcomeRaw =
          pantaData?.resolvedOutcome ||
          pantaData?.winner ||
          pantaData?.winningOutcome ||
          pantaData?.outcome ||
          "yes";
        const resolvedOutcome = String(outcomeRaw).toLowerCase() as "yes" | "no";

        await updateMarketPhase(market.id, "resolved", resolvedOutcome);
        resolvedCount++;

        await finalizeAndBroadcastWinners(market, resolvedOutcome);
      } catch {}
    }
  } catch (err: any) {
    console.warn("[Poller] External API check error:", err.message);
  }

  return resolvedCount;
}

/**
 * Starts the resolution watcher interval running every 60 seconds.
 * Returns a teardown function to stop polling.
 */
export function startResolutionPoller(intervalMs = 60000): () => void {
  let isRunning = false;

  const timer = setInterval(async () => {
    if (isRunning) return; // Prevent concurrent overlapping checks
    isRunning = true;
    try {
      await checkMarketResolutionsOnce();
    } catch (err) {
      console.error("[Poller] Unexpected error during resolution check:", err);
    } finally {
      isRunning = false;
    }
  }, intervalMs);

  return () => clearInterval(timer);
}
