import { bot } from "../bot/telegram/client.js";
import { discordClient } from "../bot/discord/client.js";
import { buildMarketCardText, getPresetBuyButtons } from "../bot/common/card-builder.js";
import { buildDiscordMarketCard } from "../bot/discord/embeds.js";
import { type Market } from "../db/schema.js";
import { config } from "../config.js";

// =============================================================================
// Market Creation Notification Dispatcher
// =============================================================================

export interface MarketCreatedNotificationParams {
  market: Market;
  signature: string;
  creatorPlatformId?: string | null;
  platform?: "telegram" | "discord" | string | null;
  chatId?: string | null;
}

/**
 * Dispatches an on-chain market launch confirmation message directly into the
 * Telegram chat or Discord channel where the draft was initiated.
 */
export async function broadcastMarketCreatedNotification(
  params: MarketCreatedNotificationParams
): Promise<void> {
  const { market, signature, creatorPlatformId, platform, chatId } = params;

  if (!chatId) {
    console.warn(`[Market Notifier] Skipping notification: No chatId provided for market ${market.id}`);
    return;
  }

  const explorerUrl = `${config.EXPLORER_URL_PREFIX}/tx/${signature}`;

  // ---------------------------------------------------------------------------
  // 1. Telegram Confirmation Message
  // ---------------------------------------------------------------------------
  if (platform === "telegram") {
    try {
      const creatorTag = creatorPlatformId
        ? creatorPlatformId.startsWith("@")
          ? creatorPlatformId
          : `@${creatorPlatformId}`
        : "Community Predictor";

      const confirmationText = [
        `🎉 *PREDICTION MARKET OFFICIALLY LIVE!*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🎯 *${market.title}*`,
        ``,
        `👤 *Created by:* ${creatorTag}`,
        `🏷️ *Category:* ${market.category || "Crypto"}`,
        `📈 *Initial Odds:* YES 50% • NO 50%`,
        `📜 *Resolution Criteria:*`,
        `${market.description || "Resolves per official consensus rules."}`,
        ``,
        `⛓️ [View On-Chain Tx on Solana Explorer](${explorerUrl})`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👇 *Start trading right now inside chat:*`,
      ].join("\n");

      const buttons = getPresetBuyButtons(market.id, market.phase);

      await bot.telegram.sendMessage(chatId, confirmationText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: buttons as any,
        },
      });

      console.log(`✅ [Market Notifier] Telegram confirmation posted to chat ${chatId} for market "${market.title}"`);
    } catch (err: any) {
      console.warn(`⚠️ [Market Notifier] Telegram confirmation notice error:`, err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Discord Confirmation Message
  // ---------------------------------------------------------------------------
  else if (platform === "discord") {
    try {
      const channel = await discordClient.channels.fetch(chatId);
      if (channel && channel.isTextBased()) {
        const { embed, components } = buildDiscordMarketCard({
          id: market.id,
          title: market.title,
          description: market.description,
          category: market.category,
          phase: market.phase,
          yesPrice: market.yesPrice,
          noPrice: market.noPrice,
          volumeUsdc: market.volumeUsdc,
        });

        const creatorDisplay = creatorPlatformId ? `<@${creatorPlatformId}>` : "Community";
        embed.setTitle(`🎉 PREDICTION MARKET LIVE: ${market.title}`);
        embed.setDescription(
          `**Created by:** ${creatorDisplay}\n` +
          `**Resolution Criteria:** ${market.description || "Resolves per official consensus rules."}\n\n` +
          `🔗 [View On-Chain Solana Devnet Tx](${explorerUrl})`
        );

        await (channel as any).send({
          content: `🚀 **Prediction market successfully launched on Solana!**`,
          embeds: [embed],
          components,
        });

        console.log(`✅ [Market Notifier] Discord confirmation posted to channel ${chatId} for market "${market.title}"`);
      }
    } catch (err: any) {
      console.warn(`⚠️ [Market Notifier] Discord confirmation notice error:`, err.message);
    }
  }
}
