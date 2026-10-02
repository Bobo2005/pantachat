import { type Telegraf, type Context } from "telegraf";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { draftMarketFromText } from "../../ai/drafter.js";
import { initiateMarketCreationSession } from "../../api/panta/create.js";
import { getMarketById } from "../../api/panta/markets.js";
import { buildMarketCardText, getPresetBuyButtons } from "../common/card-builder.js";
import { getRecentTradesForUser, getLeaderboard } from "../../db/queries.js";
import { getUserEarnings } from "../../services/graduation-poller.js";
import { solanaConnection, waitForConfirmation } from "../../utils/solana.js";
import { formatUsdc } from "../../utils/formatters.js";
import { config } from "../../config.js";

// =============================================================================
// Helper: Extract Text from Direct Message or Reply
// =============================================================================

function extractBanterText(ctx: Context): string {
  const message = ctx.message as any;
  if (!message) return "";

  // 1. If user replied to another message with /market
  if (message.reply_to_message) {
    if (message.reply_to_message.text) {
      return message.reply_to_message.text.trim();
    }
    if (message.reply_to_message.caption) {
      return message.reply_to_message.caption.trim();
    }
  }

  // 2. Direct arguments passed after command: /market <args>
  if (message.text) {
    return message.text.replace(/^\/(market|create)(@\w+)?\s*/i, "").trim();
  }

  return "";
}

// =============================================================================
// Register Core Telegram Commands
// =============================================================================

export function registerTelegramCommands(bot: Telegraf): void {
  // ---------------------------------------------------------------------------
  // /start [payload]
  // ---------------------------------------------------------------------------
  bot.command("start", async (ctx) => {
    const payload = (ctx as any).payload || "";

    // Deep-link routing for market cards: /start market_<id>
    if (payload.startsWith("market_") || payload.startsWith("mkt_")) {
      const marketId = payload.replace(/^market_/, "");
      try {
        const market = await getMarketById(marketId);
        const cardText = buildMarketCardText(market);
        const buttons = getPresetBuyButtons(market.id, market.phase);

        return ctx.reply(cardText, {
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: buttons as any },
        });
      } catch (err) {
        console.warn(`[Telegram /start] Failed loading deep-linked market ${marketId}:`, err);
      }
    }

    // Default Welcome Message
    const welcomeText = [
      `👋 *Welcome to PantaChat!*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `The first conversational prediction market bot on Solana, powered by the Panta Protocol.`,
      ``,
      `🎯 *How to Use:*`,
      `• *Reply-to-Market:* Reply to any message in a group chat with \`/market\` and Claude Sonnet 5.5 will turn the debate into a live on-chain market.`,
      `• *Trade Anywhere:* Tap preset buttons (\`$5\`, \`$20\`) right inside chat to bet YES or NO with zero custodial risk.`,
      `• *Earn Royalties:* Creators earn fee royalties when their market's bonding curve graduates to secondary trading!`,
      ``,
      `📌 *Commands:*`,
      `• \`/market [text]\` — Draft a prediction market from chat banter`,
      `• \`/positions\` — View your active bets and claimable payouts`,
      `• \`/earnings\` — Check creator royalties & claim graduated fees`,
      `• \`/leaderboard\` — Top predictors by volume & win rate`,
      `• \`/faucet [wallet]\` — Request Devnet SOL for risk-free testing`,
      ``,
      `⚡ *Environment:* ${config.ENV_LABEL}`,
    ].join("\n");

    return ctx.reply(welcomeText, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "➕ Add to Group",
              url: `https://t.me/${config.TELEGRAM_BOT_USERNAME}?startgroup=true`,
            },
            {
              text: "🌐 Open WebApp",
              url: config.WEBAPP_URL,
            },
          ],
        ],
      },
    });
  });

  // ---------------------------------------------------------------------------
  // /market & /create (Reply-to-Create)
  // ---------------------------------------------------------------------------
  const handleMarketDraft = async (ctx: Context) => {
    const banterText = extractBanterText(ctx);

    if (!banterText) {
      return ctx.reply(
        `💡 *Reply-to-Market Guide:*\n\n` +
          `Reply directly to any friend's message with \`/market\` or type your prediction statement after the command.\n\n` +
          `_Example:_ \`/market Will Solana hit $300 by end of the year?\``,
        { parse_mode: "Markdown" }
      );
    }

    const waitMsg = await ctx.reply("🤖 *Analyzing banter with Claude Sonnet 5.5...*", {
      parse_mode: "Markdown",
    });

    try {
      const draft = await draftMarketFromText(banterText);

      // Ambiguity Guard Handling
      if (draft.isAmbiguous) {
        return ctx.reply(
          `🤔 *Ambiguity Guard Notice:*\n\n` +
            `${draft.clarificationPrompt || "This statement is subjective or lacks clear criteria."}\n\n` +
            `_Try rephrasing with specific dates, metrics, or official sources!_`,
          { parse_mode: "Markdown" }
        );
      }

      const creatorId = ctx.from?.username || String(ctx.from?.id || "unknown");
      const chatId = String(ctx.chat?.id || "");

      // Create pending session
      const session = await initiateMarketCreationSession({
        platformUserId: creatorId,
        platform: "telegram",
        chatId,
        title: draft.title,
        description: draft.description,
        category: draft.category,
        cutoffAt: draft.cutoffAt,
      });

      const previewText = [
        `📝 *Drafted Prediction Market Preview*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `*Title:* ${draft.title}`,
        `*Category:* ${draft.category}`,
        `*Ends:* ${draft.cutoffAt}`,
        ``,
        `📜 *Resolution Criteria:*`,
        `${draft.description}`,
        ``,
        `💰 *Creation Fee:* 50 USDC (Devnet test funds)`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Tap below to sign the creation transaction in Phantom:`,
      ].join("\n");

      return ctx.reply(previewText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Confirm & Launch Market", url: session.signUrl }],
            [{ text: "❌ Cancel", callback_data: `cancel_${session.sessionId}` }],
          ],
        },
      });
    } catch (err: any) {
      console.error("[Telegram /market Error]:", err);
      return ctx.reply(`❌ Failed to draft market: ${err.message || "Unknown error"}`);
    }
  };

  bot.command("market", handleMarketDraft);
  bot.command("create", handleMarketDraft);

  // ---------------------------------------------------------------------------
  // /positions
  // ---------------------------------------------------------------------------
  bot.command("positions", async (ctx) => {
    const userId = ctx.from?.username || String(ctx.from?.id || "");
    const userTrades = await getRecentTradesForUser(userId, 5);

    if (userTrades.length === 0) {
      return ctx.reply(
        `📊 *Your Positions*\n\n` +
          `You have no recorded bets yet! Tap YES or NO on any market card or use \`/market\` to start a new market.`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🌐 Open Full Positions Hub", url: `${config.WEBAPP_URL}/positions` }],
            ],
          },
        }
      );
    }

    let text = `📊 *Your Recent Positions:*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    userTrades.forEach((t, i) => {
      const outcomeTag = t.outcome?.toUpperCase() === "YES" ? "🟢 YES" : "🔴 NO";
      text += `${i + 1}. ${outcomeTag} • Spent: *${formatUsdc(t.spendUsdc || 0)}* • Shares: *${(t.shares || 0).toFixed(2)}*\n`;
      text += `   Market ID: \`${t.marketId}\`\n\n`;
    });

    return ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🌐 Open Full Positions Hub", url: `${config.WEBAPP_URL}/positions` }],
        ],
      },
    });
  });

  // ---------------------------------------------------------------------------
  // /earnings
  // ---------------------------------------------------------------------------
  bot.command("earnings", async (ctx) => {
    const userId = ctx.from?.username || String(ctx.from?.id || "");
    const chatId = String(ctx.chat?.id || "");

    const earnings = await getUserEarnings(userId, "telegram", chatId);

    const buttons: any[] = [];
    if (earnings.claimableMarkets.length > 0) {
      buttons.push([
        {
          text: "⚡ Claim Creator Royalties",
          url: earnings.claimableMarkets[0].claimUrl,
        },
      ]);
    }
    buttons.push([
      {
        text: "🌐 View Royalties Dashboard",
        url: `${config.WEBAPP_URL}/positions`,
      },
    ]);

    return ctx.reply(earnings.formattedMessage, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: buttons },
    });
  });

  // ---------------------------------------------------------------------------
  // /leaderboard
  // ---------------------------------------------------------------------------
  bot.command("leaderboard", async (ctx) => {
    const topTraders = await getLeaderboard(10);

    if (topTraders.length === 0) {
      return ctx.reply(
        `🏆 *PantaChat Community Leaderboard*\n\n` +
          `No trades recorded yet! Be the first to place a prediction in this chat!`,
        { parse_mode: "Markdown" }
      );
    }

    const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
    let text = `🏆 *Top Community Predictors (by Volume)*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    topTraders.forEach((entry, idx) => {
      const medal = medals[idx] || "•";
      const userTag = entry.platformUserId?.startsWith("@")
        ? entry.platformUserId
        : `@${entry.platformUserId || "anonymous"}`;

      text += `${medal} *${userTag}* — *${formatUsdc(entry.totalVolumeUsdc)}* (${entry.totalTrades} trades)\n`;
    });

    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚡ *Powered by Panta • Non-Custodial*`;

    return ctx.reply(text, { parse_mode: "Markdown" });
  });

  // ---------------------------------------------------------------------------
  // /faucet [wallet]
  // ---------------------------------------------------------------------------
  bot.command("faucet", async (ctx) => {
    const text = (ctx.message as any)?.text || "";
    const args = text.replace(/^\/faucet(@\w+)?\s*/i, "").trim();

    if (!args) {
      return ctx.reply(
        `💧 *Devnet Faucet Guide*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Need test SOL to try out PantaChat on Devnet?\n\n` +
          `*Usage:* \`/faucet <your_solana_wallet_address>\`\n\n` +
          `_Example:_ \`/faucet Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr\``,
        { parse_mode: "Markdown" }
      );
    }

    try {
      const pubkey = new PublicKey(args);
      const airdropMsg = await ctx.reply("⏳ *Requesting 2 Devnet SOL from Solana Faucet...*", {
        parse_mode: "Markdown",
      });

      const airdropSig = await solanaConnection.requestAirdrop(
        pubkey,
        2 * LAMPORTS_PER_SOL
      );

      await waitForConfirmation(airdropSig, 20000);

      return ctx.reply(
        `✅ *Devnet Airdrop Successful!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `• *Amount:* 2.0 SOL\n` +
          `• *Recipient:* \`${pubkey.toBase58()}\`\n` +
          `• *Tx Signature:* \`${airdropSig}\`\n\n` +
          `[View on Solana Explorer](https://explorer.solana.com/tx/${airdropSig}?cluster=devnet)`,
        { parse_mode: "Markdown" }
      );
    } catch (err: any) {
      return ctx.reply(
        `⚠️ *Faucet Request Failed:*\n${err.message || "Invalid address or RPC faucet rate limit"}\n\n` +
          `You can also request airdrops directly at [faucet.solana.com](https://faucet.solana.com).`,
        { parse_mode: "Markdown" }
      );
    }
  });
}
