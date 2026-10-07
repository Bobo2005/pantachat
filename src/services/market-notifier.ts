import { bot } from "../bot/telegram/client.js";
import { discordClient } from "../bot/discord/client.js";
import { buildMarketCardText, getPresetBuyButtons } from "../bot/common/card-builder.js";
import { buildDiscordMarketCard } from "../bot/discord/embeds.js";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
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

// =============================================================================
// Trade Execution Notification Dispatcher
// =============================================================================

export interface TradeNotificationParams {
  marketTitle: string;
  marketId: string;
  category?: string | null;
  traderPlatformId?: string | null;
  wallet?: string | null;
  outcome: "yes" | "no";
  amountUsdc: number;
  signature: string;
  chatId?: string | null;
  platform?: "telegram" | "discord" | string | null;
}

function formatShortWallet(wallet?: string | null): string {
  if (!wallet || wallet.length < 10) return wallet || "";
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

/**
 * Dispatches an on-chain trade confirmation notice directly into the
 * Telegram group chat or Discord channel where the trade was initiated.
 */
export async function broadcastTradeNotification(
  params: TradeNotificationParams
): Promise<void> {
  const {
    marketTitle,
    marketId,
    category,
    traderPlatformId,
    wallet,
    outcome,
    amountUsdc,
    signature,
    chatId,
    platform = "telegram",
  } = params;

  if (!chatId) {
    console.warn(`[Market Notifier] Skipping trade notification: No chatId provided for market ${marketId}`);
    return;
  }

  const explorerUrl = `${config.EXPLORER_URL_PREFIX}/tx/${signature}`;
  const shortWallet = formatShortWallet(wallet);
  const traderTag = traderPlatformId
    ? traderPlatformId.startsWith("@")
      ? traderPlatformId
      : `@${traderPlatformId}`
    : "";

  const traderDisplay =
    traderTag && shortWallet
      ? `${traderTag} (\`${shortWallet}\`)`
      : traderTag || (shortWallet ? `\`${shortWallet}\`` : "Anonymous Trader");

  const outcomeUpper = outcome.toUpperCase();
  const outcomeEmoji = outcomeUpper === "YES" ? "🟢" : "🔴";

  // ---------------------------------------------------------------------------
  // 1. Telegram In-Chat Trade Confirmation
  // ---------------------------------------------------------------------------
  if (platform === "telegram") {
    try {
      const confirmationText = [
        `🎯 *TRADE EXECUTED ON-CHAIN!*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📈 *Market:* ${marketTitle}`,
        ``,
        `👤 *Trader:* ${traderDisplay}`,
        `💰 *Position Placed:* $${Number(amountUsdc).toFixed(2)} USDC on *${outcomeUpper}* ${outcomeEmoji}`,
        `🏷️ *Category:* ${category || "General"}`,
        ``,
        `⛓️ [View On-Chain Tx on Solana Explorer](${explorerUrl})`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👇 *Trade this market right now:*`,
      ].join("\n");

      const buttons = getPresetBuyButtons(marketId, "primary");

      await bot.telegram.sendMessage(chatId, confirmationText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: buttons as any,
        },
      });

      console.log(`✅ [Market Notifier] Telegram trade confirmation posted to chat ${chatId} for trader ${traderDisplay}`);
    } catch (err: any) {
      console.warn(`⚠️ [Market Notifier] Telegram trade confirmation notice error:`, err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Discord In-Chat Trade Confirmation
  // ---------------------------------------------------------------------------
  else if (platform === "discord") {
    try {
      const channel = await discordClient.channels.fetch(chatId);
      if (channel && channel.isTextBased()) {
        const userMention = traderPlatformId ? `<@${traderPlatformId}>` : (shortWallet || "Trader");
        await (channel as any).send({
          content:
            `🎯 **Trade Placed on Solana!**\n` +
            `**${userMention}** placed **$${Number(amountUsdc).toFixed(2)} USDC** on **${outcomeUpper}** ${outcomeEmoji}\n` +
            `📈 **Market:** ${marketTitle}\n` +
            `🔗 [View On-Chain Tx](${explorerUrl})`,
        });
        console.log(`✅ [Market Notifier] Discord trade confirmation posted to channel ${chatId}`);
      }
    } catch (err: any) {
      console.warn(`⚠️ [Market Notifier] Discord trade confirmation notice error:`, err.message);
    }
  }
}

// =============================================================================
// Privacy-Preserving "Brag in Chat" Dispatcher
// =============================================================================

export interface BragNotificationParams {
  platform: "telegram" | "discord" | string;
  chatId: string;
  userHandle: string;
  marketTitle: string;
  marketId?: string | null;
  outcome: "yes" | "no" | string;
  amount: number;
}

/**
 * Dispatches a privacy-preserving brag/flex card into Telegram or Discord.
 * NEVER outputs raw Solana wallet addresses or direct transaction signatures.
 * Includes instant counter-bet buttons so chat members can immediately take the other side.
 */
export async function broadcastBragNotification(params: BragNotificationParams): Promise<void> {
  const { platform, chatId, userHandle, marketTitle, marketId, outcome, amount } = params;
  if (!chatId) return;

  const outcomeUpper = String(outcome || "yes").toUpperCase();
  const isYes = outcomeUpper === "YES";
  const counterOutcome = isYes ? "no" : "yes";
  const counterUpper = isYes ? "NO" : "YES";
  const counterEmoji = isYes ? "🔴" : "🟢";

  // 1. Dispatch to Telegram
  if (platform === "telegram") {
    try {
      const userDisplay = userHandle.startsWith("@") ? userHandle : `@${userHandle}`;
      const bragText = [
        `🔥 *BET PLACED IN THE CHAT!*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `*${userDisplay}* just put *$${Number(amount || 20).toFixed(2)} USDC* on *${outcomeUpper}* ${isYes ? "🟢" : "🔴"}!`,
        ``,
        `🎯 *"${marketTitle}"*`,
        ``,
        `_Think they're wrong? Fade them right now:_`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join("\n");

      const inline_keyboard = marketId
        ? [
            [
              { text: `${counterEmoji} Fade: Bet ${counterUpper} $5`, callback_data: `buy_${marketId}_${counterOutcome}_5` },
              { text: `${counterEmoji} Fade: Bet ${counterUpper} $20`, callback_data: `buy_${marketId}_${counterOutcome}_20` },
            ],
            [
              { text: "📊 Market Details", callback_data: `details_${marketId}` },
              { text: "🌐 Open PantaChat", url: config.WEBAPP_URL },
            ],
          ]
        : [[{ text: "🌐 Trade on PantaChat", url: config.WEBAPP_URL }]];

      await bot.telegram.sendMessage(chatId, bragText, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard },
      });
      console.log(`✅ [Market Notifier] Telegram brag flex posted to ${chatId} for ${userDisplay}`);
    } catch (err: any) {
      console.warn(`⚠️ [Market Notifier] Telegram brag flex warning:`, err.message);
    }
  }

  // 2. Dispatch to Discord
  else if (platform === "discord") {
    try {
      const channel = await discordClient.channels.fetch(chatId);
      if (channel && channel.isTextBased()) {
        const userMention = userHandle.startsWith("<@")
          ? userHandle
          : userHandle.startsWith("@")
          ? userHandle
          : `@${userHandle}`;

        const embed = new EmbedBuilder()
          .setTitle("🔥 Prediction Bet Placed in the Channel!")
          .setColor(isYes ? 0x10b981 : 0xef4444)
          .setDescription(
            `**${userMention}** just locked in **$${Number(amount || 20).toFixed(2)} USDC** on **${outcomeUpper}** ${isYes ? "🟢" : "🔴"}!\n\n` +
            `🎯 **"${marketTitle}"**\n\n` +
            `*Think they're wrong? Take the opposite side right now:*`
          )
          .setFooter({ text: "PantaChat • Non-Custodial Social Betting" });

        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        if (marketId) {
          const fadeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`buy_${marketId}_${counterOutcome}_5`)
              .setLabel(`Fade: Bet ${counterUpper} $5`)
              .setStyle(isYes ? ButtonStyle.Danger : ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`buy_${marketId}_${counterOutcome}_20`)
              .setLabel(`Fade: Bet ${counterUpper} $20`)
              .setStyle(isYes ? ButtonStyle.Danger : ButtonStyle.Success)
          );
          rows.push(fadeRow);
        }

        const linkRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("🌐 Open PantaChat")
            .setStyle(ButtonStyle.Link)
            .setURL(config.WEBAPP_URL)
        );
        rows.push(linkRow);

        await (channel as any).send({
          embeds: [embed],
          components: rows,
        });
        console.log(`✅ [Market Notifier] Discord brag flex posted to ${chatId}`);
      }
    } catch (err: any) {
      console.warn(`⚠️ [Market Notifier] Discord brag flex warning:`, err.message);
    }
  }
}

// =============================================================================
// Faucet Request Notification Dispatcher
// =============================================================================

export interface FaucetNotificationParams {
  platform?: "telegram" | "discord" | string | null;
  chatId: string;
  walletAddress: string;
  amount: number;
  signature: string;
  newBalance?: number | null;
}

/**
 * Dispatches a formal on-chain Faucet Confirmation receipt to Telegram or Discord
 * when demo funds are requested and transferred.
 */
export async function broadcastFaucetNotification(params: FaucetNotificationParams): Promise<void> {
  const { platform = "telegram", chatId, walletAddress, amount, signature, newBalance } = params;
  const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
  const shortWallet = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;

  // 1. Telegram Confirmation Card
  if (platform === "telegram") {
    try {
      const confirmationText = [
        `💧 *Devnet Faucet Confirmation*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `✅ *Status:* Demo funds delivered on-chain!`,
        `💰 *Amount Credited:* *+${amount} SOL*`,
        `👤 *Recipient Wallet:* \`${walletAddress}\``,
        newBalance !== undefined && newBalance !== null
          ? `💳 *Current Balance:* \`${newBalance.toFixed(3)} SOL\``
          : null,
        `⏳ *Daily Limit:* 1 request per 24 hours`,
        ``,
        `⛓️ [View On-Chain Tx on Solana Explorer](${explorerUrl})`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👇 *Start trading risk-free on PantaChat:*`,
      ].filter(Boolean).join("\n");

      await bot.telegram.sendMessage(chatId, confirmationText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔍 View on Explorer", url: explorerUrl },
              { text: "🚀 Open Markets", url: config.WEBAPP_URL },
            ],
          ],
        },
      });

      console.log(`✅ [Market Notifier] Telegram faucet confirmation posted to chat ${chatId}`);
    } catch (err: any) {
      console.warn(`⚠️ [Market Notifier] Telegram faucet confirmation error:`, err.message);
    }
  }

  // 2. Discord Confirmation Embed & Buttons
  else if (platform === "discord") {
    try {
      const channel = await discordClient.channels.fetch(chatId);
      if (channel && channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setTitle("💧 Devnet Faucet Confirmation")
          .setColor(0x10b981)
          .setDescription("Demo SOL was successfully transferred to your wallet on Solana Devnet.")
          .addFields(
            { name: "💰 Amount Credited", value: `+${amount} SOL`, inline: true },
            { name: "👤 Recipient", value: `\`${shortWallet}\``, inline: true },
            { name: "🌐 Network", value: "Solana Devnet 🟢", inline: true }
          );

        if (newBalance !== undefined && newBalance !== null) {
          embed.addFields({ name: "💳 Current Balance", value: `${newBalance.toFixed(3)} SOL`, inline: true });
        }

        embed.addFields({ name: "⏳ Daily Limit", value: "1 request per 24 hours", inline: true });
        embed.setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("View on Solana Explorer")
            .setStyle(ButtonStyle.Link)
            .setURL(explorerUrl),
          new ButtonBuilder()
            .setLabel("Open Prediction Markets")
            .setStyle(ButtonStyle.Link)
            .setURL(config.WEBAPP_URL)
        );

        await (channel as any).send({
          embeds: [embed],
          components: [row],
        });

        console.log(`✅ [Market Notifier] Discord faucet confirmation posted to channel ${chatId}`);
      }
    } catch (err: any) {
      console.warn(`⚠️ [Market Notifier] Discord faucet confirmation error:`, err.message);
    }
  }
}

