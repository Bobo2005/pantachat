import {
  type Client,
  type ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { getMarketById, getMarketStats, getTrendingMarkets } from "../../api/panta/markets.js";
import { createTradeSession } from "../../api/panta/trading.js";
import { createClaimSession } from "../../api/panta/positions.js";
import { buildDiscordMarketCard, buildDiscordTrendingCard } from "./embeds.js";
import { getRecentTradesForUser, disputeMarketOutcome } from "../../db/queries.js";
import { getUserEarnings } from "../../services/graduation-poller.js";
import { registerCardUpdateListener } from "../../services/attribution-reporter.js";
import { formatUsdc, isCutoffExpired } from "../../utils/formatters.js";
import { generateProgressBar } from "../common/card-builder.js";
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
    const market = await getMarketById(marketId).catch(() => null);
    if (market) {
      if (market.phase === "resolved" || market.resolvedOutcome) {
        await interaction.reply({
          content: "⚪ **This market is resolved.** Payouts can be claimed in `/positions`.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (isCutoffExpired(market.cutoffAt)) {
        await interaction.reply({
          content: "❌ **Trading has ended for this market.** Betting is no longer permitted while awaiting outcome resolution.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    const session = await createTradeSession({
      platformUserId,
      platform: "discord",
      chatId,
      marketId,
      outcome,
      amountUsdc: amount,
    });

    const safeSignUrl =
      session.signUrl && session.signUrl.length <= 512
        ? session.signUrl
        : `${config.WEBAPP_URL}/sign?session=${session.sessionId}`;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel(`⚡ Sign $${amount} ${outcome.toUpperCase()} (Phantom)`)
        .setStyle(ButtonStyle.Link)
        .setURL(safeSignUrl)
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
 * Handle In-Place Refresh for /trending List
 */
async function handleRefreshTrending(interaction: ButtonInteraction): Promise<void> {
  try {
    const topMarkets = await getTrendingMarkets(3);
    if (!topMarkets || topMarkets.length === 0) {
      await interaction.reply({
        content: "⚠️ No trending markets found.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { embed, components } = buildDiscordTrendingCard(topMarkets);

    await interaction.update({
      embeds: [embed],
      components,
    });
  } catch (err: any) {
    console.warn("[Discord Button] Failed to refresh trending markets:", err.message);
    await interaction.reply({
      content: "⚠️ Trending markets are up to date.",
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
    const market = await getMarketById(marketId).catch(() => null);
    if (market) {
      if (market.phase === "resolved" || market.resolvedOutcome) {
        await interaction.reply({
          content: "⚪ **This market is resolved.** Payouts can be claimed in `/positions`.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (isCutoffExpired(market.cutoffAt)) {
        await interaction.reply({
          content: "❌ **Trading has ended for this market.** Betting is no longer permitted while awaiting outcome resolution.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

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
        `📊 **Your Positions & Claims**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `You have no recorded prediction bets yet! Place a bet on any live market or type \`/market\` to launch your own.`,
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const enrichedTrades = await Promise.all(
    userTrades.map(async (t) => {
      const marketId = t.marketId || "";
      const market = marketId ? await getMarketById(marketId).catch(() => null) : null;
      const title = market?.title || (marketId ? `Market #${marketId.slice(0, 12)}` : "Prediction Market");
      const phase = market?.phase || "primary";
      const resolvedOutcome = market?.resolvedOutcome as "yes" | "no" | "void" | undefined;
      const resolutionStatus = market?.resolutionStatus || (phase === "resolved" ? "resolved" : "open");
      const cutoffAt = market?.cutoffAt;

      const myOutcome = (t.outcome || "yes").toLowerCase() as "yes" | "no";
      const spendUsdc = Number(t.spendUsdc || 0);
      const shares = Number(t.shares || spendUsdc * 2);

      let settledBadge = "⏳ In Progress";
      let statusText = "🔵 Active Position";
      let isClaimable = false;
      let claimAmount = 0;

      if (resolutionStatus === "void" || resolvedOutcome === "void") {
        settledBadge = "⚪ VOID (Canceled)";
        statusText = `⚪ 100% Refund Ready ($${spendUsdc.toFixed(2)} USDC)`;
        isClaimable = true;
        claimAmount = spendUsdc;
      } else if (resolvedOutcome === "yes" || resolvedOutcome === "no") {
        const isWinner = myOutcome === resolvedOutcome;
        settledBadge = resolvedOutcome === "yes" ? "🟢 YES WON" : "🟣 NO WON";
        if (isWinner) {
          settledBadge += " • 🏆 WON!";
          statusText = `🏆 Won ($${shares.toFixed(2)} USDC)`;
          isClaimable = true;
          claimAmount = shares;
        } else {
          statusText = "🔴 Lost";
        }
      } else if (phase === "resolved") {
        settledBadge = "⚪ Resolved";
        statusText = "⚪ Finalized";
      } else if (cutoffAt && isCutoffExpired(cutoffAt)) {
        settledBadge = "⏳ Trading Closed (Awaiting Resolution)";
        statusText = "⏳ Awaiting Settlement";
      }

      return {
        ...t,
        title,
        myOutcome,
        settledBadge,
        statusText,
        isClaimable,
        claimAmount,
        shares,
        spendUsdc,
      };
    })
  );

  const embed = new EmbedBuilder()
    .setTitle("📊 Your Prediction Portfolio & Claims")
    .setDescription("Non-custodial positions and claimable payouts on Solana Devnet.")
    .setColor(0x38bdf8);

  enrichedTrades.forEach((pos, idx) => {
    const outcomeEmoji = pos.myOutcome === "yes" ? "🟢" : "🔴";
    embed.addFields({
      name: `${idx + 1}. ${pos.title.length > 60 ? pos.title.slice(0, 57) + "..." : pos.title}`,
      value:
        `• Stance: ${outcomeEmoji} **${pos.myOutcome.toUpperCase()}** • Spent: **$${pos.spendUsdc.toFixed(2)}** (${pos.shares.toFixed(1)} shares)\n` +
        `• Settled: **${pos.settledBadge}**\n` +
        `• Status: **${pos.statusText}**`,
      inline: false,
    });
  });

  const claimable = enrichedTrades.filter((t) => t.isClaimable);
  if (claimable.length > 0) {
    const topClaim = claimable[0];
    try {
      const claimSession = await createClaimSession({
        platformUserId: userId,
        platform: "discord",
        chatId: interaction.channelId,
        marketId: topClaim.marketId || "",
        estimatedPayoutUsdc: topClaim.claimAmount,
      });

      const isRefund = topClaim.statusText.includes("Refund");
      const claimBtnLabel = isRefund
        ? `💰 Claim 100% Refund ($${topClaim.claimAmount.toFixed(2)} USDC)`
        : `💰 Claim Payout ($${topClaim.claimAmount.toFixed(2)} USDC)`;

      row.addComponents(
        new ButtonBuilder()
          .setLabel(claimBtnLabel)
          .setStyle(ButtonStyle.Success)
          .setURL(claimSession.signUrl)
      );
    } catch (claimErr) {
      console.warn("[Discord btn_positions] Failed generating claim session:", claimErr);
    }
  }

  const top = enrichedTrades[0];
  if (top) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`share_pos_btn_${top.marketId}_${top.myOutcome}_${Math.round(top.spendUsdc || 20)}`)
        .setLabel("📤 Share Top Bet")
        .setStyle(ButtonStyle.Secondary)
    );
  }

  await interaction.reply({
    embeds: [embed],
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

/**
 * Handle Ephemeral Share Market Button
 * Format: share_mkt_btn_<marketId>
 */
async function handleShareMarketButton(interaction: ButtonInteraction, marketId: string): Promise<void> {
  try {
    const market = await getMarketById(marketId);
    const yesPrice = Number(market.yesPrice) || 0.5;
    const noPrice = Number(market.noPrice) || 0.5;
    const total = yesPrice + noPrice;
    const yesPct = Math.round((total > 0 ? yesPrice / total : 0.5) * 100);
    const noPct = 100 - yesPct;
    const userHandle = interaction.user.username || "trader";
    const shareUrl = `${config.WEBAPP_URL}/?market=${encodeURIComponent(market.id)}&ref=${encodeURIComponent(userHandle)}`;

    const shareSnippet = `🔥 Prediction Market: "${market.title}" (YES ${yesPct}% • NO ${noPct}%)\nTrade now on PantaChat: ${shareUrl}`;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("🌐 Open on WebApp")
        .setStyle(ButtonStyle.Link)
        .setURL(shareUrl)
    );

    await interaction.reply({
      content:
        `📋 **Copy & Share into Any Channel or DM:**\n` +
        `\`\`\`text\n${shareSnippet}\n\`\`\`\n` +
        `💡 *Friends who click your link will see you referred the trade and can place 1-tap bets!*`,
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  } catch (err: any) {
    await interaction.reply({
      content: `❌ Could not generate share link: ${err.message}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handle Ephemeral Share Position Button
 * Format: share_pos_btn_<marketId>_<outcome>_<spend>
 */
async function handleSharePositionButton(
  interaction: ButtonInteraction,
  marketId: string,
  outcome: string,
  spend: number
): Promise<void> {
  try {
    const market = await getMarketById(marketId);
    const yesPrice = Number(market.yesPrice) || 0.5;
    const noPrice = Number(market.noPrice) || 0.5;
    const total = yesPrice + noPrice;
    const yesPct = Math.round((total > 0 ? yesPrice / total : 0.5) * 100);
    const noPct = 100 - yesPct;
    const odds = outcome === "yes" ? yesPct : noPct;
    const userHandle = interaction.user.username || "trader";
    const shareUrl = `${config.WEBAPP_URL}/?market=${encodeURIComponent(market.id)}&ref=${encodeURIComponent(userHandle)}&side=${outcome}`;

    const shareSnippet = `🎯 I'm holding ${outcome.toUpperCase()} on "${market.title}"! Current odds: ${odds}%. Agree or fade me on PantaChat: ${shareUrl}`;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("🌐 View on WebApp")
        .setStyle(ButtonStyle.Link)
        .setURL(shareUrl)
    );

    await interaction.reply({
      content:
        `🎯 **Your Position Share Call:**\n` +
        `\`\`\`text\n${shareSnippet}\n\`\`\`\n` +
        `💡 *Forward this snippet to challenge your friends to ride or fade your bet!*`,
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  } catch (err: any) {
    await interaction.reply({
      content: `❌ Could not generate position share: ${err.message}`,
      flags: MessageFlags.Ephemeral,
    });
  }
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

      // Share Market Button (Ephemeral link generation)
      if (customId.startsWith("share_mkt_btn_")) {
        const marketId = customId.replace(/^share_mkt_btn_/, "");
        await handleShareMarketButton(interaction, marketId);
        return;
      }

      // Share Position Button (Ephemeral stance generation)
      if (customId.startsWith("share_pos_btn_")) {
        const match = customId.match(/^share_pos_btn_([^_]+)_(yes|no)_(\d+)/i);
        if (match) {
          await handleSharePositionButton(
            interaction,
            match[1],
            match[2].toLowerCase(),
            Number(match[3]) || 20
          );
          return;
        }
      }

      // Buy Preset Button
      const buyMatch = customId.match(/^buy_(.+?)_(yes|no)_(\d+)$/i);
      if (buyMatch) {
        await handleBuyPresetButton(interaction, buyMatch);
        return;
      }

      // Refresh Trending Button
      if (customId === "refresh_trending") {
        await handleRefreshTrending(interaction);
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

      // Trading Closed Button
      const closedMatch = customId.match(/^closed_(.+)$/);
      if (closedMatch) {
        await interaction.reply({
          content: "⏳ **Trading has ended for this market.** It is awaiting outcome resolution.",
          flags: MessageFlags.Ephemeral,
        });
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

      // Dispute Resolution Challenge Button
      if (customId.startsWith("dispute_")) {
        const marketId = customId.replace("dispute_", "");
        const market = await getMarketById(marketId).catch(() => null);
        if (!market) {
          await interaction.reply({
            content: "❌ Market not found.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (market.resolutionStatus === "disputed") {
          await interaction.reply({
            content: "⚠️ This market is already disputed and auto-finalization is currently halted.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        if (market.resolutionStatus !== "proposed") {
          await interaction.reply({
            content: `⚠️ Market is not in the 2-hour challenge window (current status: ${market.resolutionStatus || "open"}).`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const userTag = `@${interaction.user.username || interaction.user.id}`;
        const updated = await disputeMarketOutcome(market.id, `Disputed via button by ${userTag}`);

        await interaction.reply({
          content: `⚠️ **Dispute Registered!** You have challenged the proposed outcome for **${market.title}**.\nTotal disputes: ${updated?.disputeCount || 1}.\n🛑 Automated finalization is now paused for review.`,
          flags: MessageFlags.Ephemeral,
        });

        if (interaction.channel && interaction.channel.isTextBased()) {
          await (interaction.channel as any).send({
            content:
              `⚠️ **RESOLUTION CHALLENGED!**\n` +
              `Trader <@${interaction.user.id}> has disputed the proposed outcome for **${market.title}**.\n` +
              `🛑 **Auto-finalization has been halted for human verification / consensus review.**`,
          }).catch(() => {});
        }
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
