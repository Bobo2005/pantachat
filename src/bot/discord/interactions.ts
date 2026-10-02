import {
  type Client,
  type ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import { getMarketById, getMarketStats } from "../../api/panta/markets.js";
import { createTradeSession } from "../../api/panta/trading.js";
import { buildDiscordMarketCard } from "./embeds.js";
import { getRecentTradesForUser } from "../../db/queries.js";
import { getUserEarnings } from "../../services/graduation-poller.js";
import { registerCardUpdateListener } from "../../services/attribution-reporter.js";
import { formatUsdc } from "../../utils/formatters.js";
import { config } from "../../config.js";

// =============================================================================
// Button Interaction Handlers
// =============================================================================

/**
 * Handle Buy Preset Buttons (YES $5, YES $20, NO $5, NO $20)
 * Format: buy_<marketId>_<outcome>_<amount>
 */
async function handleBuyPresetButton(interaction: ButtonInteraction, match: RegExpMatchArray): Promise<void> {
  const marketId = match[1];
  const outcome = match[2].toLowerCase() as "yes" | "no";
  const amount = Number(match[3]);

  const platformUserId = interaction.user.username || interaction.user.id;
  const chatId = interaction.channelId;

  try {
    const session = await createTradeSession({
      platformUserId,
      platform: "discord",
      chatId,
      marketId,
      outcome,
      amountUsdc: amount,
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel(`⚡ Sign $${amount} ${outcome.toUpperCase()} (Phantom)`)
        .setStyle(ButtonStyle.Link)
        .setURL(session.signUrl)
    );

    // Ephemeral response protects personal signing links from public chat
    await interaction.reply({
      content:
        `🎯 **Ready to place bet:** $${amount} on **${outcome.toUpperCase()}**\n` +
        `Click below to review the order quote and sign in Phantom non-custodially:`,
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  } catch (err: any) {
    console.error("[Discord Button] Buy preset error:", err);
    await interaction.reply({
      content: `❌ **Failed to initiate trade session:** ${err.message || "Unknown error"}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handle In-Place Refresh Button
 * Format: refresh_<marketId>
 */
async function handleRefreshButton(interaction: ButtonInteraction, marketId: string): Promise<void> {
  try {
    const market = await getMarketById(marketId);
    const { embed, components } = buildDiscordMarketCard(market);

    // In-place edit with zero chat spam
    await interaction.update({
      embeds: [embed],
      components,
    });
  } catch (err: any) {
    console.warn(`[Discord Button] Failed to refresh market ${marketId}:`, err.message);
    await interaction.reply({
      content: "⚠️ Odds are currently up to date.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handle Market Details Button
 * Format: details_<marketId>
 */
async function handleDetailsButton(interaction: ButtonInteraction, marketId: string): Promise<void> {
  try {
    const stats = await getMarketStats(marketId);
    const text =
      `📊 **Market Details for \`${marketId}\`:**\n` +
      `• **YES Probability:** ${stats.yesProbPercent} (Multiplier: ${stats.yesPayout}x)\n` +
      `• **NO Probability:**  ${stats.noProbPercent} (Multiplier: ${stats.noPayout}x)\n` +
      `• **Time Remaining:** ${stats.timeRemaining}\n` +
      `• **Phase:** ${stats.phase.toUpperCase()}`;

    await interaction.reply({
      content: text,
      flags: MessageFlags.Ephemeral,
    });
  } catch (err: any) {
    await interaction.reply({
      content: "ℹ️ Market details are currently unavailable.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handle Custom Bet Button
 * Format: custom_<marketId>
 */
async function handleCustomBetButton(interaction: ButtonInteraction, marketId: string): Promise<void> {
  const platformUserId = interaction.user.username || interaction.user.id;
  const chatId = interaction.channelId;

  try {
    const session = await createTradeSession({
      platformUserId,
      platform: "discord",
      chatId,
      marketId,
      outcome: "yes",
      amountUsdc: 10,
    });

    const customUrl = `${config.WEBAPP_URL}/sign?session=${session.sessionId}&custom=true`;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("⚡ Open Custom Bet Sheet")
        .setStyle(ButtonStyle.Link)
        .setURL(customUrl)
    );

    await interaction.reply({
      content:
        `⚙️ **Custom Bet Slider**\n` +
        `Choose your custom amount ($5 - $1,000+), pick YES/NO, and adjust slippage in the non-custodial signing sheet:`,
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  } catch (err: any) {
    await interaction.reply({
      content: "❌ Failed to open custom order modal.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handle Ephemeral Positions Button
 */
async function handleEphemeralPositions(interaction: ButtonInteraction): Promise<void> {
  const userId = interaction.user.username || interaction.user.id;
  const userTrades = await getRecentTradesForUser(userId, 5);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("🌐 Open Full Positions Hub")
      .setStyle(ButtonStyle.Link)
      .setURL(`${config.WEBAPP_URL}/positions`)
  );

  if (userTrades.length === 0) {
    await interaction.reply({
      content:
        `📊 **Your Positions**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `You have no recorded prediction bets yet! Place a bet on any market to get started.`,
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  let text = `📊 **Your Recent Positions:**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  userTrades.forEach((t, i) => {
    const outcomeTag = t.outcome?.toUpperCase() === "YES" ? "🟢 YES" : "🔴 NO";
    text += `${i + 1}. ${outcomeTag} • Spent: **${formatUsdc(t.spendUsdc || 0)}** • Shares: **${(t.shares || 0).toFixed(2)}**\n`;
    text += `   Market ID: \`${t.marketId}\`\n\n`;
  });

  await interaction.reply({
    content: text,
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Handle Ephemeral Creator Royalties Button
 */
async function handleEphemeralEarnings(interaction: ButtonInteraction): Promise<void> {
  const userId = interaction.user.username || interaction.user.id;
  const earnings = await getUserEarnings(userId, "discord", interaction.channelId);

  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  const row = new ActionRowBuilder<ButtonBuilder>();

  if (earnings.claimableMarkets.length > 0) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel("⚡ Claim Creator Royalties")
        .setStyle(ButtonStyle.Link)
        .setURL(earnings.claimableMarkets[0].claimUrl)
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setLabel("🌐 Royalties Dashboard")
      .setStyle(ButtonStyle.Link)
      .setURL(`${config.WEBAPP_URL}/positions`)
  );
  components.push(row);

  await interaction.reply({
    content: earnings.formattedMessage,
    components,
    flags: MessageFlags.Ephemeral,
  });
}

// =============================================================================
// Register Discord Interaction Listeners
// =============================================================================

export function registerDiscordInteractions(client: Client): void {
  // 1. Button Interaction Router
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    try {
      const customId = interaction.customId;

      // Buy Preset Button
      const buyMatch = customId.match(/^buy_(.+?)_(yes|no)_(\d+)$/i);
      if (buyMatch) {
        await handleBuyPresetButton(interaction, buyMatch);
        return;
      }

      // Refresh Button
      const refreshMatch = customId.match(/^refresh_(.+)$/);
      if (refreshMatch) {
        await handleRefreshButton(interaction, refreshMatch[1]);
        return;
      }

      // Details Button
      const detailsMatch = customId.match(/^details_(.+)$/);
      if (detailsMatch) {
        await handleDetailsButton(interaction, detailsMatch[1]);
        return;
      }

      // Custom Amount Button
      const customMatch = customId.match(/^custom_(.+)$/);
      if (customMatch) {
        await handleCustomBetButton(interaction, customMatch[1]);
        return;
      }

      // Ephemeral Balances / Royalties
      if (customId === "btn_positions") {
        await handleEphemeralPositions(interaction);
        return;
      }
      if (customId === "btn_earnings") {
        await handleEphemeralEarnings(interaction);
        return;
      }

      // Dismiss Preview Draft Button
      if (customId.startsWith("dismiss_draft")) {
        await interaction.update({
          content: "❌ *Market draft preview dismissed.*",
          components: [],
        });
        return;
      }
    } catch (err: any) {
      console.error("[Discord Button Router Error]:", err);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction
          .reply({
            content: "⚠️ An error occurred processing this button action.",
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    }
  });

  // 2. Connect Attribution Auto-Refresh Hook (Prompt 8 & 15 integration)
  registerCardUpdateListener(async ({ platform, chatId, messageId, marketId }) => {
    if (platform !== "discord" || !chatId || !messageId) return;

    try {
      const channel = await client.channels.fetch(chatId);
      if (channel && channel.isTextBased()) {
        const message = await channel.messages.fetch(messageId);
        if (message) {
          const market = await getMarketById(marketId);
          const { embed, components } = buildDiscordMarketCard(market);
          await message.edit({
            embeds: [embed],
            components,
          });
        }
      }
    } catch (err: any) {
      console.warn(`[Discord Auto-Refresh] In-place edit skipped for message ${messageId}:`, err.message);
    }
  });
}
