import { getActiveMarkets, updateMarketPhase, getMarketsByCreator } from "../db/queries.js";
import { pantaGet } from "../api/panta/client.js";
import { createCreatorClaimSession } from "../api/panta/claims.js";
import { formatUsdc } from "../utils/formatters.js";

// =============================================================================
// Interfaces & Types
// =============================================================================

export interface GraduationNotification {
  marketId: string;
  title: string;
  platform: "telegram" | "discord";
  chatId: string;
  creatorPlatformId: string;
  creatorWallet?: string;
  messageText: string;
  claimUrl?: string;
}

export type GraduationListener = (notification: GraduationNotification) => Promise<void> | void;

const graduationListeners: GraduationListener[] = [];

/**
 * Registers a bot callback to notify creators when their bonding curve graduates.
 */
export function registerGraduationListener(listener: GraduationListener): void {
  graduationListeners.push(listener);
}

// =============================================================================
// Graduation Watcher Engine
// =============================================================================

/**
 * Scans active primary markets created by users, checks Panta for secondary graduation,
 * updates SQLite state, and alerts creators.
 */
export async function checkGraduationsOnce(): Promise<number> {
  const activeMarkets = await getActiveMarkets();
  // Filter for markets still in primary phase created by users
  const primaryMarkets = activeMarkets.filter(
    (m) => m.phase === "primary" && m.creatorPlatformId
  );

  let graduatedCount = 0;

  for (const market of primaryMarkets) {
    try {
      const raw = await pantaGet<any>(`/markets/${market.id}/`, undefined, "read");
      const pantaData = raw?.market || raw?.data || raw;

      const isGraduated =
        pantaData?.phase === "secondary" ||
        pantaData?.graduated === true ||
        pantaData?.isGraduated === true;

      if (!isGraduated) {
        continue;
      }

      // 1. Advance market phase in SQLite
      await updateMarketPhase(market.id, "secondary");
      graduatedCount++;

      // 2. Generate claim session and alert creator if creator is tracked
      if (market.creatorPlatformId) {
        const session = await createCreatorClaimSession({
          platformUserId: market.creatorPlatformId,
          platform: (market.platform || "telegram") as "telegram" | "discord",
          chatId: market.chatId || "",
          marketId: market.id,
          creatorWallet: market.creatorWallet || undefined,
        });

        const creatorTag = market.creatorPlatformId.startsWith("@")
          ? market.creatorPlatformId
          : `@${market.creatorPlatformId}`;

        const messageText =
          `🚀 *Market Graduated to Secondary Trading!* "${market.title}"\n\n` +
          `Hey ${creatorTag}, your prediction market has successfully completed its bonding curve sale ` +
          `and migrated to secondary trading! Creator fee royalties are now unlocked.\n\n` +
          `Type /earnings or tap below to claim your royalties directly to your wallet.`;

        const notification: GraduationNotification = {
          marketId: market.id,
          title: market.title,
          platform: (market.platform || "telegram") as "telegram" | "discord",
          chatId: market.chatId || "",
          creatorPlatformId: market.creatorPlatformId,
          creatorWallet: market.creatorWallet || undefined,
          messageText,
          claimUrl: session.signUrl,
        };

        for (const listener of graduationListeners) {
          try {
            await listener(notification);
          } catch (err) {
            console.error("[Graduation] Notification listener error:", err);
          }
        }
      }
    } catch (err) {
      console.warn(`[Graduation] Failed checking market ${market.id}:`, err);
    }
  }

  return graduatedCount;
}

/**
 * Starts graduation poller running periodically.
 */
export function startGraduationPoller(intervalMs = 60000): () => void {
  let isRunning = false;

  const timer = setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await checkGraduationsOnce();
    } catch (err) {
      console.error("[Graduation] Unexpected error during graduation check:", err);
    } finally {
      isRunning = false;
    }
  }, intervalMs);

  return () => clearInterval(timer);
}

// =============================================================================
// /earnings Handler Logic
// =============================================================================

export interface UserEarningsSummary {
  creatorPlatformId: string;
  totalMarketsCreated: number;
  graduatedMarketsCount: number;
  totalVolumeUsdc: number;
  claimableMarkets: Array<{
    marketId: string;
    title: string;
    phase: string;
    volumeUsdc: number;
    claimUrl: string;
  }>;
  formattedMessage: string;
}

/**
 * Aggregates all markets created by a platform user, tallies volume and graduation status,
 * and creates 1-tap claim session links for unlocked creator fees.
 */
export async function getUserEarnings(
  creatorPlatformId: string,
  platform: "telegram" | "discord" = "telegram",
  chatId = ""
): Promise<UserEarningsSummary> {
  const userMarkets = await getMarketsByCreator(creatorPlatformId);

  let totalVolumeUsdc = 0;
  const graduatedMarkets: typeof userMarkets = [];
  const claimableMarkets: UserEarningsSummary["claimableMarkets"] = [];

  for (const m of userMarkets) {
    totalVolumeUsdc += m.volumeUsdc || 0;
    if (m.phase === "secondary") {
      graduatedMarkets.push(m);

      const session = await createCreatorClaimSession({
        platformUserId: creatorPlatformId,
        platform,
        chatId: chatId || m.chatId || "",
        marketId: m.id,
        creatorWallet: m.creatorWallet || undefined,
      });

      claimableMarkets.push({
        marketId: m.id,
        title: m.title,
        phase: m.phase,
        volumeUsdc: m.volumeUsdc || 0,
        claimUrl: session.signUrl,
      });
    }
  }

  const creatorTag = creatorPlatformId.startsWith("@")
    ? creatorPlatformId
    : `@${creatorPlatformId}`;

  let formattedMessage =
    `💰 *Creator Royalties & Earnings*\n` +
    `👤 Creator: ${creatorTag}\n\n` +
    `📊 *Performance Summary:*\n` +
    `• Markets Created: *${userMarkets.length}*\n` +
    `• Graduated Markets: *${graduatedMarkets.length}*\n` +
    `• Total Volume Generated: *${formatUsdc(totalVolumeUsdc)}*\n\n`;

  if (claimableMarkets.length > 0) {
    formattedMessage += `⚡ *Unlocked Creator Royalties:*\n`;
    claimableMarkets.forEach((cm, i) => {
      formattedMessage += `${i + 1}. "${cm.title}" (${formatUsdc(cm.volumeUsdc)} volume)\n`;
    });
    formattedMessage += `\nTap the button below to claim your royalties directly to your wallet.`;
  } else {
    formattedMessage +=
      `ℹ️ *Note on Unlocking:* Creator royalties unlock when your market bonding curve graduates to secondary trading. ` +
      `Keep promoting your active markets!`;
  }

  return {
    creatorPlatformId,
    totalMarketsCreated: userMarkets.length,
    graduatedMarketsCount: graduatedMarkets.length,
    totalVolumeUsdc,
    claimableMarkets,
    formattedMessage,
  };
}
