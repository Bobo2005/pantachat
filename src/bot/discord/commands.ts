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
  MessageFlags,
  type ChatInputCommandInteraction,
  type MessageContextMenuCommandInteraction,
  type Interaction,
} from "discord.js";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { config } from "../../config.js";
import { draftMarketFromText } from "../../ai/drafter.js";
import { initiateMarketCreationSession, DuplicateMarketError } from "../../api/panta/create.js";
import { getMarketById } from "../../api/panta/markets.js";
import { buildDiscordMarketCard } from "./embeds.js";
import { registerDiscordInteractions } from "./interactions.js";
import { getRecentTradesForUser, getLeaderboard } from "../../db/queries.js";
import { getUserEarnings } from "../../services/graduation-poller.js";
import { solanaConnection, waitForConfirmation } from "../../utils/solana.js";
import { formatUsdc } from "../../utils/formatters.js";

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

  // 6. Message Context Menu Command: "Make a prediction market" (Reply-to-Create)
  // Right-click any chat message -> Apps -> "Make a prediction market"
  // (Zero MessageContent privileged bot intent required!)
  new ContextMenuCommandBuilder()
    .setName("Make a prediction market")
    .setType(ApplicationCommandType.Message),
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

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("✅ Confirm & Launch (50 USDC)")
        .setStyle(ButtonStyle.Link)
        .setURL(session.signUrl),
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

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`buy_${m.id}_yes_20`)
          .setLabel(`Trade YES ($${m.yesPrice.toFixed(2)})`)
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`buy_${m.id}_no_20`)
          .setLabel(`Trade NO ($${m.noPrice.toFixed(2)})`)
          .setStyle(ButtonStyle.Danger)
      );

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

  // If query is an existing market ID
  if (query.startsWith("mkt_") || query.length >= 20) {
    await interaction.deferReply();
    try {
      const market = await getMarketById(query);
      const { embed, components } = buildDiscordMarketCard(market);

      await interaction.editReply({
        embeds: [embed],
        components,
      });
      return;
    } catch {
      // If not an existing market, fall through to AI drafter
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
        `📊 **Your Positions**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `You have no recorded prediction bets yet! Place a bet on any market or use \`/market\` to launch your own.`,
      components: [row],
    });
    return;
  }

  let text = `📊 **Your Recent Positions:**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  userTrades.forEach((t, i) => {
    const outcomeTag = t.outcome?.toUpperCase() === "YES" ? "🟢 YES" : "🔴 NO";
    text += `${i + 1}. ${outcomeTag} • Spent: **${formatUsdc(t.spendUsdc || 0)}** • Shares: **${(t.shares || 0).toFixed(2)}**\n`;
    text += `   Market ID: \`${t.marketId}\`\n\n`;
  });

  await interaction.editReply({
    content: text,
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
 * Handle /leaderboard (Public)
 */
async function handleLeaderboardCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const topTraders = await getLeaderboard(10);
  if (topTraders.length === 0) {
    await interaction.editReply({
      content:
        `🏆 **PantaChat Community Leaderboard**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `No trades recorded yet! Be the first to place an on-chain prediction!`,
    });
    return;
  }

  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
  let text = `🏆 **Top Community Predictors (by Volume)**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  topTraders.forEach((entry, idx) => {
    const medal = medals[idx] || "•";
    const userTag = entry.platformUserId || "anonymous";
    text += `${medal} **${userTag}** — **${formatUsdc(entry.totalVolumeUsdc)}** (${entry.totalTrades} trades)\n`;
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
    const airdropSig = await solanaConnection.requestAirdrop(pubkey, 2 * LAMPORTS_PER_SOL);
    await waitForConfirmation(airdropSig, 25000);

    await interaction.editReply({
      content:
        `✅ **Devnet Airdrop Successful!**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `• **Amount:** 2.0 SOL\n` +
        `• **Recipient:** \`${pubkey.toBase58()}\`\n` +
        `• **Tx Signature:** \`${airdropSig}\`\n\n` +
        `[View on Solana Explorer](https://explorer.solana.com/tx/${airdropSig}?cluster=devnet)`,
    });
  } catch (err: any) {
    await interaction.editReply({
      content:
        `⚠️ **Faucet Request Failed:** ${err.message || "RPC rate limit or error"}\n\n` +
        `You can request test SOL directly from [faucet.solana.com](https://faucet.solana.com).`,
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
          case "positions":
            await handlePositionsCommand(interaction);
            break;
          case "earnings":
            await handleEarningsCommand(interaction);
            break;
          case "leaderboard":
            await handleLeaderboardCommand(interaction);
            break;
          case "faucet":
            await handleFaucetCommand(interaction);
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
