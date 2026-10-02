import { getActiveMarkets, updateMarketPhase, getRecentTradesForMarket } from "../db/queries.js";
import { pantaGet } from "../api/panta/client.js";
import { createClaimSession } from "../api/panta/positions.js";

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
  resolvedOutcome: "yes" | "no";
  shares: number;
  estimatedPayoutUsdc: number;
  messageText: string;
  claimUrl: string;
}

export type WinnerNotificationHandler = (notification: WinnerNotification) => Promise<void> | void;

const notificationHandlers: WinnerNotificationHandler[] = [];

/**
 * Registers a bot callback to broadcast celebratory claim alerts in Telegram/Discord.
 */
export function registerWinnerNotificationHandler(handler: WinnerNotificationHandler): void {
  notificationHandlers.push(handler);
}

// =============================================================================
// Resolution Poller Core Engine
// =============================================================================

/**
 * Scans all currently active markets in local SQLite database, checks Panta for
 * resolution transitions, marks winners, and generates claim sessions.
 */
export async function checkMarketResolutionsOnce(): Promise<number> {
  const activeMarkets = await getActiveMarkets();
  let resolvedCount = 0;

  for (const market of activeMarkets) {
    try {
      const raw = await pantaGet<any>(`/markets/${market.id}/`, undefined, "read");
      const pantaData = raw?.market || raw?.data || raw;

      const isResolved =
        pantaData?.phase === "resolved" ||
        pantaData?.status === "resolved" ||
        pantaData?.resolved === true;

      if (!isResolved) {
        continue;
      }

      const outcomeRaw =
        pantaData?.resolvedOutcome ||
        pantaData?.winner ||
        pantaData?.winningOutcome ||
        pantaData?.outcome ||
        "yes";
      const resolvedOutcome = String(outcomeRaw).toLowerCase() as "yes" | "no";

      // 1. Update local database phase to "resolved"
      await updateMarketPhase(market.id, "resolved", resolvedOutcome);
      resolvedCount++;

      // 2. Fetch all trades associated with this market
      const allTrades = await getRecentTradesForMarket(market.id, 100);
      const winningTrades = allTrades.filter(
        (t) => t.outcome?.toLowerCase() === resolvedOutcome
      );

      // 3. Group by user to consolidate winning positions
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

      for (const trade of winningTrades) {
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

      // 4. Send celebratory winner alerts with deep-linked claim sessions
      for (const winner of userWinners.values()) {
        const estimatedPayoutUsdc = winner.totalShares > 0 ? winner.totalShares : winner.totalCost * 1.5;

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
          `🎉 *Market Resolved!* "${market.title}"\n` +
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
    } catch (err) {
      console.warn(`[Poller] Failed checking market ${market.id}:`, err);
    }
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
