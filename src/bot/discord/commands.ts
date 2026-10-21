import {
  Client,
  REST,
  Routes,
  SlashCommandBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type MessageContextMenuCommandInteraction,
  type Interaction,
} from "discord.js";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { config } from "../../config.js";
import { draftMarketFromText } from "../../ai/drafter.js";
import { initiateMarketCreationSession, DuplicateMarketError } from "../../api/panta/create.js";
import { createTradeSession } from "../../api/panta/trading.js";
import { getMarketById, getTrendingMarkets } from "../../api/panta/markets.js";
import { createClaimSession } from "../../api/panta/positions.js";
import { buildDiscordMarketCard, buildDiscordTrendingCard } from "./embeds.js";
import { registerDiscordInteractions } from "./interactions.js";
import { getRecentTradesForUser, getLeaderboard, disputeMarketOutcome } from "../../db/queries.js";
import { getUserEarnings } from "../../services/graduation-poller.js";
import { solanaConnection, waitForConfirmation } from "../../utils/solana.js";
import { formatUsdc, isCutoffExpired } from "../../utils/formatters.js";
import { generateProgressBar } from "../common/card-builder.js";

// =============================================================================
// Application Command Definitions (Slash Commands + Context Menu)
// =============================================================================

export const commandDefinitions = [
  // 1. Slash Command: /market [query]
  new SlashCommandBuilder()
    .setName("market")
    .setDescription("Draft and launch a prediction market from chat banter, or view by ID")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("Prediction question, proposition, or market ID")
        .setRequired(false)
    ),

  // 1b. Slash Command: /bet [market_id] [outcome] [amount]
  new SlashCommandBuilder()
    .setName("bet")
    .setDescription("Place a custom amount prediction bet on a market")
    .addStringOption((opt) =>
      opt.setName("market_id").setDescription("The market ID to bet on").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("outcome").setDescription("Outcome to bet on (yes or no)").setRequired(true).addChoices(
        { name: "YES", value: "yes" },
        { name: "NO", value: "no" }
      )
    )
    .addNumberOption((opt) =>
      opt.setName("amount").setDescription("Amount in USDC to bet (e.g. 15, 50, 100)").setRequired(true).setMinValue(0.1)
    ),

  // 2. Slash Command: /positions
  new SlashCommandBuilder()
    .setName("positions")
    .setDescription("View your active prediction bets and claimable payouts"),

  // 3. Slash Command: /earnings
  new SlashCommandBuilder()
    .setName("earnings")
    .setDescription("Check your creator fee royalties and graduation status"),

  // 4. Slash Command: /leaderboard
  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View top community predictors by trading volume and trades"),

  // 4b. Slash Command: /trending
  new SlashCommandBuilder()
    .setName("trending")
    .setDescription("View top 3 trending prediction markets on Panta with live odds"),

  // 4c. Slash Command: /hot (alias)
  new SlashCommandBuilder()
    .setName("hot")
    .setDescription("View top 3 trending prediction markets on Panta with live odds"),

  // 5. Slash Command: /faucet [wallet]
  new SlashCommandBuilder()
    .setName("faucet")
    .setDescription("Request 2 Devnet SOL for risk-free sandbox testing")
    .addStringOption((option) =>
      option
        .setName("wallet")
        .setDescription("Your Solana Devnet public key (base58)")
        .setRequired(true)
    ),

  // 5b. Slash Command: /dispute [market_id] [reason]
  new SlashCommandBuilder()
    .setName("dispute")
    .setDescription("Dispute a proposed market outcome within the 2-hour challenge window")
    .addStringOption((option) =>
      option
        .setName("market_id")
        .setDescription("The ID of the market to challenge")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Factual evidence or explanation for dispute")
        .setRequired(false)
    ),

  // 5c. Slash Command: /oracle [market_id]
  new SlashCommandBuilder()
    .setName("oracle")
    .setDescription("View AI Oracle verification log, source URL, confidence score & dispute status")
    .addStringOption((option) =>
      option
        .setName("market_id")
        .setDescription("The ID of the market to inspect")
        .setRequired(true)
    ),

  // 6. Message Context Menu Command: "Make a prediction market" (Reply-to-Create)
  // Right-click any chat message -> Apps -> "Make a prediction market"
  // (Zero MessageContent privileged bot intent required!)
  new ContextMenuCommandBuilder()
    .setName("Make a prediction market")
    .setType(ApplicationCommandType.Message),

  // 7. Slash Command: /share [market_id]
  new SlashCommandBuilder()
    .setName("share")
    .setDescription("Share a prediction market to this channel with live odds & quick-bet buttons")
    .addStringOption((opt) =>
      opt
        .setName("market_id")
        .setDescription("Market ID to share (optional, defaults to top trending)")
        .setRequired(false)
    ),
];

// =============================================================================
// REST Registration Helper
// =============================================================================

export async function registerDiscordApplicationCommands(guildId?: string): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(config.DISCORD_BOT_TOKEN);
  const body = commandDefinitions.map((cmd) => cmd.toJSON());

  try {
    if (guildId) {
      console.log(`[Discord REST] Registering ${body.length} commands to guild: ${guildId}...`);
      await rest.put(Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, guildId), { body });
      console.log(`✅ [Discord REST] Guild application commands registered!`);
    } else {
      console.log(`[Discord REST] Registering ${body.length} global commands...`);
      await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body });
      console.log(`✅ [Discord REST] Global application commands registered!`);
    }
  } catch (err: any) {
    console.error("❌ [Discord REST] Failed to register application commands:", err);
    throw err;
  }
}

// =============================================================================
// Core Command Execution Handlers
// =============================================================================

/**
 * Shared Helper: Drafts a market from arbitrary banter text and presents
 * an ephemeral preview card with Phantom signing button.
 */
async function processBanterDraft(
  interaction: ChatInputCommandInteraction | MessageContextMenuCommandInteraction,
  rawText: string
): Promise<void> {
  const trimmed = rawText.trim();
  if (!trimmed) {
    await interaction.editReply({
      content: "⚠️ The selected content contains no readable text to draft a market from.",
    });
    return;
  }

  try {
    const draft = await draftMarketFromText(trimmed);

    // 1. Ambiguity Guard Handling
    if (draft.isAmbiguous) {
      await interaction.editReply({
        content:
          `🤔 **Ambiguity Guard Notice:**\n\n` +
          `${draft.clarificationPrompt || "This statement is subjective or lacks verifiable criteria."}\n\n` +
          `*Try formulating with specific dates, official oracles, or quantitative metrics!*`,
      });
      return;
    }

    // 2. Initiate Pending Creation Session in DB
    const platformUserId = interaction.user.username || interaction.user.id;
    const session = await initiateMarketCreationSession({
      platformUserId,
      platform: "discord",
      chatId: interaction.channelId,
      title: draft.title,
      description: draft.description,
      category: draft.category,
      cutoffAt: draft.cutoffAt,
    });

    const previewMessage = [
      `📝 **Drafted Prediction Market Preview**`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `**Title:** ${draft.title}`,
      `**Category:** ${draft.category}`,
      `**Ends:** ${draft.cutoffAt}`,
      ``,
      `📜 **Resolution Criteria:**`,
      `${draft.description}`,
      ``,
      `💰 **Creation Fee:** 50 USDC (Devnet sandbox funds)`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Click below to review and sign the transaction in Phantom:`,
    ].join("\n");

    const safeSignUrl =
      session.signUrl && session.signUrl.length <= 512
        ? session.signUrl
        : `${config.WEBAPP_URL}/sign?session=${session.sessionId}`;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("✅ Confirm & Launch (50 USDC)")
        .setStyle(ButtonStyle.Link)
        .setURL(safeSignUrl),
      new ButtonBuilder()
        .setCustomId(`dismiss_draft_${session.sessionId}`)
        .setLabel("❌ Dismiss")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      content: previewMessage,
      components: [row],
    });
  } catch (err: any) {
    if (err instanceof DuplicateMarketError) {
      const m = err.existingMarket;
      const duplicateMsg = [
        `⚠️ **Market Already Exists!**`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `An active prediction market for this question is already live:`,
        `**${m.title}**`,
        ``,
        `📊 **Current Odds:** YES ${(m.yesPrice * 100).toFixed(0)}% • NO ${(m.noPrice * 100).toFixed(0)}%`,
        `📈 **Volume:** $${m.volumeUsdc.toFixed(2)} USDC`,
        ``,
        `*You cannot launch the same market twice, but you can trade on it right now!*`,
      ].join("\n");

      const isDuplicateClosed = isCutoffExpired(m.cutoffAt) || m.phase === "resolved";
      const row = new ActionRowBuilder<ButtonBuilder>();
      if (isDuplicateClosed) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`closed_${m.id}`)
            .setLabel("⏳ Trading Closed (Awaiting Resolution)")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );
      } else {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`buy_${m.id}_yes_20`)
            .setLabel(`Trade YES ($${m.yesPrice.toFixed(2)})`)
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`buy_${m.id}_no_20`)
            .setLabel(`Trade NO ($${m.noPrice.toFixed(2)})`)
            .setStyle(ButtonStyle.Danger)
        );
      }

      await interaction.editReply({
        content: duplicateMsg,
        components: [row],
      });
      return;
    }

    console.error("[Discord AI Drafter Error]:", err);
    await interaction.editReply({
      content: `❌ **Failed to draft market:** ${err.message || "Unknown error"}`,
    });
  }
}

/**
 * Handle /market [query]
 */
/**
 * Handle /bet (Custom Bet Command)
 */
async function handleBetCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const marketId = interaction.options.getString("market_id", true);
  const outcome = (interaction.options.getString("outcome", true).toLowerCase() as "yes" | "no");
  const amount = interaction.options.getNumber("amount", true);

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

    const rawUrl = `${session.signUrl}&custom=true`;
    const safeSignUrl =
      rawUrl.length <= 512 ? rawUrl : `${config.WEBAPP_URL}/sign?session=${session.sessionId}&custom=true`;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel(`⚡ Sign ${amount} ${outcome.toUpperCase()} (Phantom)`)
        .setStyle(ButtonStyle.Link)
        .setURL(safeSignUrl)
    );

    await interaction.reply({
      content:
        `🎯 **Ready to place bet:** ${amount} on **${outcome.toUpperCase()}**\n` +
        `Market: \`${marketId}\`\n` +
        `Click below to review odds and sign non-custodially in Phantom:`,
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  } catch (err: any) {
    await interaction.reply({
      content: `❌ **Failed to initiate bet session:** ${err.message || "Unknown error"}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

async function handleMarketCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const query = interaction.options.getString("query");

  if (!query) {
    await interaction.reply({
      content:
        `💡 **PantaChat Market Drafting Guide**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `• **Direct Command:** Type \`/market Will Solana hit $300 by end of month?\`\n` +
        `• **Reply-to-Create:** Right-click ANY friend's message $\\to$ **Apps** $\\to$ **"Make a prediction market"**\n\n` +
        `Claude Sonnet 5.5 will instantly structure the debate into an on-chain prediction market!`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const cleanQuery = query.trim();
  // Only treat as market ID if it has NO spaces and matches an ID format
  const isExplicitMarketId =
    !cleanQuery.includes(" ") &&
    (cleanQuery.startsWith("mkt_") || /^[a-zA-Z0-9_\-]{20,50}$/.test(cleanQuery));

  if (isExplicitMarketId) {
    await interaction.deferReply();
    try {
      const market = await getMarketById(cleanQuery);
      // Ensure market is valid and not a dummy fixture
      if (market && market.id && !market.title?.includes("Fixture market")) {
        const { embed, components } = buildDiscordMarketCard(market);
        await interaction.editReply({
          embeds: [embed],
          components,
        });
        return;
      }
    } catch {
      // If not found, fall through to AI drafter
    }
  }

  // Defer ephemerally while AI drafts
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await processBanterDraft(interaction, query);
}

/**
 * Handle Message Context Menu Command ("Make a prediction market")
 */
async function handleContextMenuMarketDraft(
  interaction: MessageContextMenuCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const targetText = interaction.targetMessage.content;
  await processBanterDraft(interaction, targetText);
}

/**
 * Handle /positions (Ephemeral balance protection)
 */
async function handlePositionsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const userId = interaction.user.username || interaction.user.id;
  const userTrades = await getRecentTradesForUser(userId, 5);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("🌐 Open Full Positions Hub")
      .setStyle(ButtonStyle.Link)
      .setURL(`${config.WEBAPP_URL}/positions`)
  );

  if (userTrades.length === 0) {
    await interaction.editReply({
      content:
        `📊 **Your Positions & Claims**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `You have no recorded prediction bets yet! Place a bet on any live market or use \`/market\` to launch your own.`,
      components: [row],
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
      console.warn("[Discord /positions] Failed generating claim session:", claimErr);
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

  await interaction.editReply({
    embeds: [embed],
    components: [row],
  });
}

/**
 * Handle /earnings (Ephemeral creator royalties protection)
 */
async function handleEarningsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

  await interaction.editReply({
    content: earnings.formattedMessage,
    components,
  });
}

/**
 * Handle /leaderboard (Public - Scoped to Guild/Channel)
 */
async function handleLeaderboardCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const targetChatId = interaction.guildId || interaction.channelId || undefined;
  const serverName = interaction.guild?.name || "Server";

  const topTraders = await getLeaderboard(10, targetChatId, "discord");
  if (topTraders.length === 0) {
    await interaction.editReply({
      content:
        `🏆 **${serverName} Leaderboard**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `No trades recorded in this server yet! Be the first to place an on-chain prediction!`,
    });
    return;
  }

  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
  let text = `🏆 **${serverName} Top Predictors (by Volume)**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  topTraders.forEach((entry, idx) => {
    const medal = medals[idx] || "•";
    const userTag = entry.platformUserId || "anonymous";
    text += `${medal} **${userTag}** — **${formatUsdc(entry.totalVolumeUsdc)}** (${entry.totalTrades} trade${entry.totalTrades === 1 ? "" : "s"})\n`;
  });

  text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚡ *Powered by Panta • Non-Custodial*`;

  await interaction.editReply({ content: text });
}

/**
 * Handle /faucet [wallet]
 */
async function handleFaucetCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const walletArg = interaction.options.getString("wallet", true).trim();

  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(walletArg);
  } catch {
    await interaction.reply({
      content: `❌ **Invalid Solana Address:** \`${walletArg}\` is not a valid base58 public key.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();

  try {
    const recipientAddress = pubkey.toBase58();

    // 1. Try central API faucet (enforces 24-hour limit and treasury wallet)
    let apiSuccess = false;
    let apiResult: any = null;

    try {
      const res = await fetch(`${config.WEBAPP_URL}/api/faucet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: recipientAddress }),
      });
      apiResult = await res.json();

      if (res.status === 429) {
        // Strictly rate limited: Cannot request until after a day!
        await interaction.editReply({
          content:
            `⏳ **Daily Limit Reached**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `This wallet address has already claimed demo funds today.\n\n` +
            `• **Wallet:** \`${recipientAddress}\`\n` +
            `• **Next Claim Available:** **${apiResult.formattedWait || "after 24 hours"}**\n\n` +
            `_Rate limit: Each wallet address can only request once every 24 hours._`,
        });
        return;
      }

      if (res.ok && apiResult.success) {
        apiSuccess = true;
      }
    } catch {
      // Fallback to direct RPC if webapp is starting up
    }

    let signature = "";
    let amount = 0.25;

    if (apiSuccess && apiResult) {
      signature = apiResult.signature;
      amount = apiResult.amount || 0.25;
    } else {
      // 2. Direct RPC Fallback
      const airdropSig = await solanaConnection.requestAirdrop(pubkey, Math.round(0.25 * LAMPORTS_PER_SOL));
      await waitForConfirmation(airdropSig, 25000);
      signature = airdropSig;
    }

    // Fetch updated balance
    let currentBal: number | null = null;
    try {
      const lamports = await solanaConnection.getBalance(pubkey);
      currentBal = Number(lamports) / Number(LAMPORTS_PER_SOL);
    } catch {}

    const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
    const shortWallet = `${recipientAddress.slice(0, 4)}...${recipientAddress.slice(-4)}`;

    const embed = new EmbedBuilder()
      .setTitle("💧 Devnet Faucet Confirmation")
      .setColor(0x10b981)
      .setDescription("Demo SOL was successfully transferred to your wallet on Solana Devnet.")
      .addFields(
        { name: "💰 Amount Credited", value: `+${amount} SOL`, inline: true },
        { name: "👤 Recipient", value: `\`${shortWallet}\``, inline: true },
        { name: "🌐 Network", value: "Solana Devnet 🟢", inline: true }
      );

    if (currentBal !== null) {
      embed.addFields({ name: "💳 Current Balance", value: `${currentBal.toFixed(3)} SOL`, inline: true });
    }

    embed.addFields({ name: "⏳ Daily Limit", value: "Strictly 1 request per 24 hours", inline: true });
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

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });
  } catch (err: any) {
    await interaction.editReply({
      content:
        `⚠️ **Faucet Request Failed:** ${err.message || "RPC rate limit or error"}\n\n` +
        `👉 **Instant No-GitHub Options:**\n` +
        `1. Claim in our WebApp: [PantaChat Faucet](${config.WEBAPP_URL}/?faucet=true)\n` +
        `2. Alternative Web Faucet: [solfaucet.com](https://solfaucet.com)`,
    });
  }
}

/**
 * Handle /trending & /hot (Top 3 highest volume prediction markets)
 */
async function handleTrendingCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  try {
    const topMarkets = await getTrendingMarkets(3);

    if (!topMarkets || topMarkets.length === 0) {
      await interaction.editReply({
        content: "🔥 **Trending Prediction Markets**\nNo active markets found yet! Use `/market <question>` to launch the first market!",
      });
      return;
    }

    const { embed, components } = buildDiscordTrendingCard(topMarkets);

    await interaction.editReply({
      embeds: [embed],
      components,
    });
  } catch (err: any) {
    console.error("[Discord /trending Error]:", err);
    await interaction.editReply({
      content: `⚠️ Failed to fetch trending markets: ${err.message || "Unknown error"}`,
    });
  }
}

/**
 * Handle /share [market_id]
 */
async function handleShareCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const inputMarketId = interaction.options.getString("market_id");

  let market: any = null;
  if (inputMarketId) {
    try {
      market = await getMarketById(inputMarketId.trim());
    } catch {
      // not found, fallback to trending
    }
  }

  if (!market) {
    const trending = await getTrendingMarkets(1);
    market = trending[0] || null;
  }

  if (!market) {
    await interaction.editReply({
      content: "⚠️ No active markets found to share. Try drafting one with `/market`!",
    });
    return;
  }

  const yesPrice = Number(market.yesPrice) || 0.5;
  const noPrice = Number(market.noPrice) || 0.5;
  const total = yesPrice + noPrice;
  const yesProb = total > 0 ? yesPrice / total : 0.5;
  const yesPercent = Math.round(yesProb * 100);
  const noPercent = 100 - yesPercent;
  const progressBar = generateProgressBar(yesPercent, 10);
  const yesMultiplier = yesPrice > 0 ? (1 / yesPrice).toFixed(2) : "0.00";
  const noMultiplier = noPrice > 0 ? (1 / noPrice).toFixed(2) : "0.00";
  const volumeStr = formatUsdc(market.volumeUsdc || 0);

  const embed = new EmbedBuilder()
    .setTitle(`🔥 ${market.title}`)
    .setColor(0x38bdf8) // #38bdf8 brand accent color
    .setDescription(
      `Shared by <@${interaction.user.id}>\n\n` +
      `📊 **Sentiment & Odds:**\n\`${progressBar}\`\n` +
      `🟢 **YES ${yesPercent}%** ($${yesPrice.toFixed(2)}) • 🔴 **${noPercent}% NO** ($${noPrice.toFixed(2)})\n\n` +
      `💰 **Est. Win Multipliers:**\n• YES: **${yesMultiplier}x** • NO: **${noMultiplier}x**\n\n` +
      `📈 **Volume:** **${volumeStr}**`
    )
    .setFooter({ text: "⚡ Shared via PantaChat • Non-Custodial Prediction Markets" })
    .setTimestamp();

  const userHandle = interaction.user.username || "trader";
  const shareWebUrl = `${config.WEBAPP_URL}/?market=${encodeURIComponent(market.id)}&ref=${encodeURIComponent(userHandle)}`;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`buy_${market.id}_yes_5`)
      .setLabel("🟢 Bet YES $5")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`buy_${market.id}_no_5`)
      .setLabel("🔴 Bet NO $5")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setLabel("🌐 Open & Share on WebApp")
      .setStyle(ButtonStyle.Link)
      .setURL(shareWebUrl)
  );

  await interaction.editReply({
    embeds: [embed],
    components: [row],
  });
}

/**
 * Handle /dispute [market_id] [reason]
 */
async function handleDisputeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const marketId = interaction.options.getString("market_id", true);
  const reason = interaction.options.getString("reason") || "Community dispute challenge";

  try {
    const market = await getMarketById(marketId).catch(() => null);
    if (!market) {
      await interaction.reply({
        content: `❌ Market \`${marketId}\` not found.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (market.resolutionStatus === "disputed") {
      await interaction.reply({
        content: `⚠️ Market "**${market.title}**" is already disputed. Auto-finalization is currently halted.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (market.resolutionStatus !== "proposed") {
      await interaction.reply({
        content: `⚠️ Market "**${market.title}**" is currently **${(market.resolutionStatus || "open").toUpperCase()}** and is not inside the 2-hour challenge window.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const updated = await disputeMarketOutcome(
      market.id,
      `@${interaction.user.username || interaction.user.id}: ${reason}`
    );

    await interaction.reply({
      content:
        `⚠️ **RESOLUTION CHALLENGED!**\n` +
        `Trader <@${interaction.user.id}> has disputed the proposed outcome for:\n` +
        `**${market.title}**\n\n` +
        `📝 **Reason:** ${reason}\n` +
        `⚠️ **Total Disputes:** ${updated?.disputeCount || 1}\n` +
        `🛑 **Auto-finalization has been halted for human verification / consensus review.**`,
    });
  } catch (err: any) {
    await interaction.reply({
      content: `❌ Failed to record dispute: ${err.message}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handle /oracle [market_id] - Inspect AI Oracle Verification Log
 */
async function handleOracleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const marketId = interaction.options.getString("market_id", true);

  try {
    const market = await getMarketById(marketId).catch(() => null);
    if (!market) {
      await interaction.reply({
        content: `❌ Market \`${marketId}\` not found.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const confPct =
      market.confidenceScore !== undefined && market.confidenceScore !== null
        ? `${Math.round(Number(market.confidenceScore) * 100)}%`
        : "Pending (Eval at Cutoff)";

    const disputeStr = market.disputeUntil
      ? `<t:${Math.floor(
          (market.disputeUntil < 10000000000 ? market.disputeUntil * 1000 : market.disputeUntil) / 1000
        )}:R>`
      : "Not triggered";

    const cutoffStr = market.cutoffAt
      ? `<t:${Math.floor(
          (typeof market.cutoffAt === "number" && market.cutoffAt < 10000000000
            ? market.cutoffAt * 1000
            : Number(market.cutoffAt)) / 1000
        )}:F>`
      : "N/A";

    const embed = new EmbedBuilder()
      .setColor(
        market.resolutionStatus === "resolved"
          ? 0x10b981 // Green
          : market.resolutionStatus === "proposed"
          ? 0xf59e0b // Amber
          : market.resolutionStatus === "disputed"
          ? 0xef4444 // Red
          : market.resolutionStatus === "void"
          ? 0x6b7280 // Gray
          : 0x3b82f6 // Blue
      )
      .setTitle(`🔮 AI Oracle Verification Log: ${market.title.slice(0, 80)}`)
      .setDescription(
        `**Market ID:** \`${market.id}\`\n` +
        `**Lifecycle Status:** \`${(market.resolutionStatus || "open").toUpperCase()}\`\n` +
        (market.proposedOutcome ? `**⏳ Proposed Winner:** \`${market.proposedOutcome.toUpperCase()}\`\n` : "") +
        (market.resolvedOutcome ? `**🏆 Final Settled Outcome:** \`${market.resolvedOutcome.toUpperCase()}\`\n` : "")
      )
      .addFields(
        {
          name: "🧠 AI Confidence Score",
          value: `**${confPct}** (Deterministic Consensus Temp 0.0)`,
          inline: true,
        },
        {
          name: "⚠️ Total Disputes",
          value: `**${market.disputeCount || 0}** dispute(s) registered`,
          inline: true,
        },
        {
          name: "⏱️ Timestamps",
          value: `• **Cutoff:** ${cutoffStr}\n• **Challenge Deadline:** ${disputeStr}`,
          inline: false,
        },
        {
          name: "🔍 Factual Evidence Snippet",
          value: market.evidenceSummary
            ? `> ${market.evidenceSummary}`
            : "_Awaiting cutoff timestamp & official consensus verification._",
          inline: false,
        },
        {
          name: "🔗 Official Resolution Source",
          value: market.evidenceUrl
            ? `[View Source Proof Document](${market.evidenceUrl})`
            : "_No URL registered yet_",
          inline: false,
        }
      )
      .setFooter({
        text: "PantaChat AI Oracle • Tamper-Proof Automated Resolution Engine",
      })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>();
    if (market.evidenceUrl) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel("🔍 View Official Evidence")
          .setStyle(ButtonStyle.Link)
          .setURL(market.evidenceUrl)
      );
    }
    if (market.resolutionStatus === "proposed") {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`dispute_${market.id}`)
          .setLabel("⚠️ Challenge / Dispute")
          .setStyle(ButtonStyle.Danger)
      );
    }
    row.addComponents(
      new ButtonBuilder()
        .setLabel("🌐 View on WebApp")
        .setStyle(ButtonStyle.Link)
        .setURL(`${config.WEBAPP_URL}/#mkt-${market.id}`)
    );

    await interaction.reply({
      embeds: [embed],
      components: row.components.length > 0 ? [row] : [],
    });
  } catch (err: any) {
    await interaction.reply({
      content: `❌ Error retrieving Oracle verification log: ${err.message}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

// =============================================================================
// Register Discord Interaction Listeners
// =============================================================================

export function registerDiscordCommands(client: Client): void {
  // Register button and auto-refresh interactions
  registerDiscordInteractions(client);

  client.on("interactionCreate", async (interaction: Interaction) => {
    try {
      // 1. Message Context Menu Command ("Make a prediction market")
      if (interaction.isMessageContextMenuCommand()) {
        if (interaction.commandName === "Make a prediction market") {
          await handleContextMenuMarketDraft(interaction);
        }
        return;
      }

      // 2. Chat Input Slash Commands
      if (interaction.isChatInputCommand()) {
        switch (interaction.commandName) {
          case "market":
            await handleMarketCommand(interaction);
            break;
          case "bet":
            await handleBetCommand(interaction);
            break;
          case "positions":
            await handlePositionsCommand(interaction);
            break;
          case "earnings":
            await handleEarningsCommand(interaction);
            break;
          case "leaderboard":
            await handleLeaderboardCommand(interaction);
            break;
          case "trending":
          case "hot":
            await handleTrendingCommand(interaction);
            break;
          case "faucet":
            await handleFaucetCommand(interaction);
            break;
          case "share":
            await handleShareCommand(interaction);
            break;
          case "dispute":
            await handleDisputeCommand(interaction);
            break;
          case "oracle":
            await handleOracleCommand(interaction);
            break;
        }
        return;
      }
    } catch (err: any) {
      console.error("[Discord Interaction Handler Error]:", err);
      if (interaction.isRepliable()) {
        if (interaction.deferred || interaction.replied) {
          await interaction
            .followUp({
              content: "⚠️ An unexpected error occurred while executing this command.",
              flags: MessageFlags.Ephemeral,
            })
            .catch(() => {});
        } else {
          await interaction
            .reply({
              content: "⚠️ An unexpected error occurred while executing this command.",
              flags: MessageFlags.Ephemeral,
            })
            .catch(() => {});
        }
      }
    }
  });
}
