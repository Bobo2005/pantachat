import { type Telegraf, type Context } from "telegraf";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { draftMarketFromText } from "../../ai/drafter.js";
import { initiateMarketCreationSession, DuplicateMarketError } from "../../api/panta/create.js";
import { createTradeSession } from "../../api/panta/trading.js";
import { getMarketById, getTrendingMarkets } from "../../api/panta/markets.js";
import { buildMarketCardText, getPresetBuyButtons, generateProgressBar, buildTelegramTrendingCard } from "../common/card-builder.js";
import { getRecentTradesForUser, getLeaderboard, disputeMarketOutcome } from "../../db/queries.js";
import { getUserEarnings } from "../../services/graduation-poller.js";
import { solanaConnection, waitForConfirmation } from "../../utils/solana.js";
import { formatUsdc, isCutoffExpired } from "../../utils/formatters.js";
import { config } from "../../config.js";
import { handleInlineQuery } from "./inline.js";

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
// Helper: Safe Markdown Reply & Chat Action
// =============================================================================

export async function sendSafeReply(
  ctx: Context,
  text: string,
  extra: any = { parse_mode: "Markdown" }
) {
  try {
    return await ctx.reply(text, extra);
  } catch (err: any) {
    // If formatting fails, strip Markdown tokens and HTML tags and retry as clean plain text
    if (extra?.parse_mode) {
      const fallbackExtra = { ...extra };
      delete fallbackExtra.parse_mode;
      const stripped = text.replace(/<[^>]+>/g, "").replace(/[*_`\[\]]/g, "");
      return await ctx.reply(stripped, fallbackExtra).catch(() => {});
    }
    throw err;
  }
}

// =============================================================================
// Register Core Telegram Commands
// =============================================================================

export function registerTelegramCommands(bot: Telegraf): void {
  // ---------------------------------------------------------------------------
  // Register Inline Query Handler (@pantachat_bot <query>)
  // ---------------------------------------------------------------------------
  bot.on("inline_query", handleInlineQuery);

  // ---------------------------------------------------------------------------
  // /start [payload] (Supports Group Onboarding via startgroup=...)
  // ---------------------------------------------------------------------------
  bot.command("start", async (ctx) => {
    ctx.sendChatAction("typing").catch(() => {});
    const rawPayload = ((ctx as any).payload || "").trim();
    const payload = rawPayload.replace(/^startgroup=/, "");

    // 1. Position Share Deep-Link: share_pos_<marketId>_<outcome>_<spend>
    if (payload.startsWith("share_pos_")) {
      const match = payload.match(/^share_pos_([^_]+)_(yes|no)_(\d+)/i);
      if (match) {
        const marketId = match[1];
        const outcome = match[2].toLowerCase() as "yes" | "no";
        const spend = Number(match[3]) || 20;

        try {
          const market = await getMarketById(marketId);
          if (market) {
            const yesPrice = Number(market.yesPrice) || 0.5;
            const noPrice = Number(market.noPrice) || 0.5;
            const total = yesPrice + noPrice;
            const yesPct = Math.round((total > 0 ? yesPrice / total : 0.5) * 100);
            const noPct = 100 - yesPct;
            const progressBar = generateProgressBar(yesPct, 10);
            const outcomeEmoji = outcome === "yes" ? "🟢" : "🔴";
            const userHandle = ctx.from?.username
              ? `@${ctx.from.username}`
              : ctx.from?.first_name || "A member";

            const cardText = [
              `🎯 *POSITION SHARED BY ${userHandle}*`,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              `*"${market.title}"*`,
              ``,
              `Stance: *${outcomeEmoji} ${outcome.toUpperCase()}* (Spent $${spend} USDC)`,
              `📊 Current Odds: YES ${yesPct}% ${progressBar} ${noPct}% NO`,
              ``,
              `_Think they're wrong? Fade their position right now:_`,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ].join("\n");

            const rideOutcome = outcome;
            const fadeOutcome = outcome === "yes" ? "no" : "yes";
            const rideEmoji = outcome === "yes" ? "🟢" : "🔴";
            const fadeEmoji = outcome === "yes" ? "🔴" : "🟢";

            const buttons = [
              [
                {
                  text: `${rideEmoji} Ride with ${rideOutcome.toUpperCase()} $5`,
                  callback_data: `buy_${market.id}_${rideOutcome}_5`,
                },
                {
                  text: `${fadeEmoji} Fade with ${fadeOutcome.toUpperCase()} $5`,
                  callback_data: `buy_${market.id}_${fadeOutcome}_5`,
                },
              ],
              [
                {
                  text: "🚀 Open in Mini App",
                  url: `https://t.me/${config.TELEGRAM_BOT_USERNAME}?startapp=mkt_${market.id}`,
                },
                { text: "🔄 Refresh Odds", callback_data: `refresh_${market.id}` },
              ],
            ];

            return ctx.reply(cardText, {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: buttons as any },
            });
          }
        } catch (err: any) {
          console.warn("[Telegram /start] Failed loading deep-linked position market:", err.message);
        }
      }
    }

    // 2. Market Share Deep-Link: share_mkt_<id>, market_<id>, mkt_<id>
    if (
      payload.startsWith("share_mkt_") ||
      payload.startsWith("market_") ||
      payload.startsWith("mkt_")
    ) {
      const marketId = payload.replace(/^(share_mkt_|market_|mkt_)/, "");
      try {
        const market = await getMarketById(marketId);
        if (market) {
          const yesPrice = Number(market.yesPrice) || 0.5;
          const noPrice = Number(market.noPrice) || 0.5;
          const total = yesPrice + noPrice;
          const yesPct = Math.round((total > 0 ? yesPrice / total : 0.5) * 100);
          const noPct = 100 - yesPct;
          const progressBar = generateProgressBar(yesPct, 10);
          const yesMultiplier = yesPrice > 0 ? (1 / yesPrice).toFixed(2) : "0.00";
          const noMultiplier = noPrice > 0 ? (1 / noPrice).toFixed(2) : "0.00";
          const volumeStr = formatUsdc(market.volumeUsdc || 0);
          const statusBadge =
            market.phase === "secondary" ? "🟣 Graduated Secondary" : "🟢 Live Primary Curve";

          const cardText = [
            `🔥 *PREDICTION MARKET ON PANTA*`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `*"${market.title}"*`,
            ``,
            `📊 Current Odds: YES ${yesPct}% ${progressBar} ${noPct}% NO`,
            ``,
            `💰 *Est. Win Multipliers:*`,
            `• YES: *${yesMultiplier}x* (Spot: $${yesPrice.toFixed(2)})`,
            `• NO:  *${noMultiplier}x* (Spot: $${noPrice.toFixed(2)})`,
            ``,
            `📈 Volume: *${volumeStr}* • Status: *${statusBadge}*`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `⚡ *Trade non-custodially on Solana Devnet*`,
          ].join("\n");

          const buttons = getPresetBuyButtons(market.id, market.phase, market.cutoffAt);

          return ctx.reply(cardText, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: buttons as any },
          });
        }
      } catch (err: any) {
        console.warn(`[Telegram /start] Failed loading deep-linked market ${marketId}:`, err.message);
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
      `• \`/bet <id> <yes|no> <amount>\` — Place a custom bet on any market`,
      `• \`/positions\` — View your active bets and claimable payouts`,
      `• \`/earnings\` — Check creator royalties & claim graduated fees`,
      `• \`/trending\` — View top 3 live prediction markets by volume`,
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
    ctx.sendChatAction("typing").catch(() => {});
    const banterText = extractBanterText(ctx);

    if (!banterText) {
      return sendSafeReply(
        ctx,
        `💡 *Reply-to-Market Guide:*\n\n` +
        `Reply directly to any friend's message with \`/market\` or type your prediction statement after the command.\n\n` +
        `_Example:_ \`/market Will Solana hit $300 by end of the year?\``,
        { parse_mode: "Markdown" }
      );
    }

    const waitMsg = await sendSafeReply(ctx, "🤖 *Analyzing banter with Claude Sonnet 5.5...*", {
      parse_mode: "Markdown",
    });

    try {
      const draft = await draftMarketFromText(banterText);

      // Ambiguity Guard Handling
      if (draft.isAmbiguous) {
        return sendSafeReply(
          ctx,
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

      return sendSafeReply(ctx, previewText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Confirm & Launch Market", url: session.signUrl }],
            [{ text: "❌ Cancel", callback_data: `cancel_${session.sessionId}` }],
          ],
        },
      });
    } catch (err: any) {
      if (err instanceof DuplicateMarketError) {
        const m = err.existingMarket;
        const duplicateText = [
          `⚠️ *Market Already Exists!*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `An active prediction market for this question is already live:`,
          `*${m.title}*`,
          ``,
          `📊 *Current Odds:* YES ${(m.yesPrice * 100).toFixed(0)}% • NO ${(m.noPrice * 100).toFixed(0)}%`,
          `📈 *Volume:* $${m.volumeUsdc.toFixed(2)} USDC`,
          ``,
          `_You cannot launch the same market twice, but you can trade on it right now!_`,
        ].join("\n");

        const isDuplicateClosed = isCutoffExpired(m.cutoffAt) || m.phase === "resolved";
        const duplicateButtons = isDuplicateClosed
          ? [
              [{ text: "⏳ Trading Closed (Awaiting Resolution)", callback_data: `closed_${m.id}` }],
              [{ text: "📊 View Market Card", callback_data: `view_${m.id}` }],
            ]
          : [
              [
                { text: `Trade YES ($${m.yesPrice.toFixed(2)})`, callback_data: `buy_${m.id}_yes_20` },
                { text: `Trade NO ($${m.noPrice.toFixed(2)})`, callback_data: `buy_${m.id}_no_20` },
              ],
              [{ text: "📊 View Market Card", callback_data: `view_${m.id}` }],
            ];

        return sendSafeReply(ctx, duplicateText, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: duplicateButtons,
          },
        });
      }

      console.error("[Telegram /market Error]:", err);
      return sendSafeReply(ctx, `❌ Failed to draft market: ${err.message || "Unknown error"}`);
    }
  };

  bot.command("market", handleMarketDraft);
  bot.command("create", handleMarketDraft);

  // ---------------------------------------------------------------------------
  // /bet & /buy (Custom Amount Bet Command)
  // Usage: /bet [marketId] <yes|no> <amount> or replying to a card: /bet yes 50
  // ---------------------------------------------------------------------------
  const handleCustomBetCommand = async (ctx: Context) => {
    ctx.sendChatAction("typing").catch(() => {});
    const text = (ctx.message as any)?.text || "";
    const cleanArgs = text.replace(/^\/(bet|buy)(@\w+)?\s*/i, "").trim();

    // Check if replying to a market card to extract marketId
    let marketId = "";
    const replyMsg = (ctx.message as any)?.reply_to_message;
    if (replyMsg && replyMsg.text) {
      const match = replyMsg.text.match(/Market ID:\s*`?([a-zA-Z0-9_\-]+)`?/i) ||
        replyMsg.text.match(/([a-zA-Z0-9_\-]{15,})/);
      if (match) marketId = match[1];
    }

    const parts = cleanArgs.split(/\s+/).filter(Boolean);
    let outcome: "yes" | "no" = "yes";
    let amount = 20;

    for (const part of parts) {
      const p = part.toLowerCase();
      if (p === "yes" || p === "y") {
        outcome = "yes";
      } else if (p === "no" || p === "n") {
        outcome = "no";
      } else if (/^\$?\d+(\.\d+)?$/.test(p)) {
        amount = parseFloat(p.replace("$", ""));
      } else if (p.length > 5 && !marketId) {
        marketId = p;
      }
    }

    if (!marketId) {
      return sendSafeReply(
        ctx,
        [
          "🎯 *Custom Bet Command*",
          "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
          "Bet any custom amount on any prediction market!",
          "",
          "*Usage:* `/bet <marketId> <yes|no> <amount>`",
          "*Or reply to a market card with:* `/bet yes 50`",
          "",
          "_Example:_ `/bet mkt_arsenal_chelsea yes 75`",
        ].join("\n"),
        { parse_mode: "Markdown" }
      );
    }

    if (amount <= 0 || isNaN(amount)) {
      return sendSafeReply(ctx, "⚠️ Please specify a valid amount greater than $0 (e.g. /bet " + marketId + " yes 25).");
    }

    try {
      const market = await getMarketById(marketId).catch(() => null);
      if (market) {
        if (market.phase === "resolved" || market.resolvedOutcome) {
          return sendSafeReply(ctx, "⚪ *This market has already resolved.* Payouts can be claimed in /positions.", { parse_mode: "Markdown" });
        }
        if (isCutoffExpired(market.cutoffAt)) {
          return sendSafeReply(ctx, "❌ *Trading has ended for this market.* Betting is no longer permitted while awaiting outcome resolution.", { parse_mode: "Markdown" });
        }
      }

      const platformUserId = ctx.from?.username || String(ctx.from?.id || "unknown");
      const chatId = String(ctx.chat?.id || "");

      const session = await createTradeSession({
        platformUserId,
        platform: "telegram",
        chatId,
        marketId,
        outcome,
        amountUsdc: amount,
      });

      const signUrl = `${session.signUrl}&custom=true`;

      return sendSafeReply(
        ctx,
        `🎯 *Ready to place bet:* ${amount} on *${outcome.toUpperCase()}*\n` +
        `Market: \`${marketId}\`\n\n` +
        `Tap below to review odds and sign non-custodially in Phantom:`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: `⚡ Sign ${amount} ${outcome.toUpperCase()} (Mini App)`,
                  web_app: { url: signUrl },
                },
              ],
              [
                {
                  text: "🌐 Open in External Browser",
                  url: signUrl,
                },
              ],
            ],
          },
        }
      );
    } catch (err: any) {
      return sendSafeReply(ctx, `❌ Failed to create bet session: ${err.message || "Unknown error"}`);
    }
  };

  bot.command("bet", handleCustomBetCommand);
  bot.command("buy", handleCustomBetCommand);


  // ---------------------------------------------------------------------------
  // /positions
  // ---------------------------------------------------------------------------
  bot.command("positions", async (ctx) => {
    ctx.sendChatAction("typing").catch(() => {});
    try {
      const userId = ctx.from?.username || String(ctx.from?.id || "");
      const userTrades = await getRecentTradesForUser(userId, 5);

      if (userTrades.length === 0) {
        return sendSafeReply(
          ctx,
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

      return sendSafeReply(ctx, text, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🌐 Open Full Positions Hub", url: `${config.WEBAPP_URL}/positions` }],
          ],
        },
      });
    } catch (err: any) {
      console.error("[Telegram /positions Error]:", err);
      return sendSafeReply(ctx, `❌ Failed to load positions: ${err.message || "Unknown error"}`);
    }
  });

  // ---------------------------------------------------------------------------
  // /earnings
  // ---------------------------------------------------------------------------
  bot.command("earnings", async (ctx) => {
    ctx.sendChatAction("typing").catch(() => {});
    try {
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

      return sendSafeReply(ctx, earnings.formattedMessage, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: buttons },
      });
    } catch (err: any) {
      console.error("[Telegram /earnings Error]:", err);
      return sendSafeReply(ctx, `❌ Failed to retrieve creator earnings: ${err.message || "Unknown error"}`);
    }
  });

  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // /leaderboard (Scoped to current Group Chat if in a group, or global if in DM)
  // ---------------------------------------------------------------------------
  bot.command("leaderboard", async (ctx) => {
    ctx.sendChatAction("typing").catch(() => {});
    try {
      const isGroup = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
      const chatId = isGroup ? String(ctx.chat.id) : undefined;
      const chatTitle = (ctx.chat as any)?.title || "Community";

      // Group-scoped leaderboard if in a group; global if in private DM
      const topTraders = await getLeaderboard(10, chatId, "telegram");

      if (topTraders.length === 0) {
        const emptyMsg = isGroup
          ? `🏆 <b>${chatTitle} Leaderboard</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `No bets recorded in this group yet!\n\n` +
            `Tap YES or NO on any market card or type /market to place the first bet and claim #1 on this leaderboard!`
          : `🏆 <b>PantaChat Community Leaderboard</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `No trades recorded yet! Be the first to place a prediction in this chat!`;

        return sendSafeReply(ctx, emptyMsg, { parse_mode: "HTML" });
      }

      const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
      const headerTitle = isGroup ? `${chatTitle} Leaderboard` : "Top Community Predictors (by Volume)";
      let text = `🏆 <b>${headerTitle}</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      topTraders.forEach((entry, idx) => {
        const medal = medals[idx] || "•";
        const rawTag = entry.platformUserId?.startsWith("@")
          ? entry.platformUserId
          : `@${entry.platformUserId || "anonymous"}`;
        const safeUserTag = rawTag.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        text += `${medal} <b>${safeUserTag}</b> — <b>${formatUsdc(entry.totalVolumeUsdc)}</b> (${entry.totalTrades} trade${entry.totalTrades === 1 ? "" : "s"})\n`;
      });

      text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚡ <b>Powered by Panta • Non-Custodial</b>`;

      return sendSafeReply(ctx, text, { parse_mode: "HTML" });
    } catch (err: any) {
      console.error("[Telegram /leaderboard Error]:", err);
      return sendSafeReply(ctx, `⚠️ Failed to load leaderboard: ${err.message || "Unknown error"}`);
    }
  });

  // ---------------------------------------------------------------------------
  // /trending & /hot (Top 3 highest volume markets)
  // ---------------------------------------------------------------------------
  const handleTrendingCommand = async (ctx: Context) => {
    ctx.sendChatAction("typing").catch(() => {});
    try {
      const topMarkets = await getTrendingMarkets(3);

      if (!topMarkets || topMarkets.length === 0) {
        return sendSafeReply(
          ctx,
          `🔥 *TOP TRENDING MARKETS ON PANTA*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `No active markets found yet! Type \`/market <question>\` to draft the first market in this chat!`,
          { parse_mode: "Markdown" }
        );
      }

      const card = buildTelegramTrendingCard(topMarkets);

      return sendSafeReply(ctx, card.text, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: card.buttons as any },
      });
    } catch (err: any) {
      console.error("[Telegram /trending error]:", err);
      return sendSafeReply(ctx, `⚠️ Failed to load trending markets: ${err.message || "Unknown error"}`);
    }
  };

  bot.command(["trending", "hot"], handleTrendingCommand);

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
      const recipientAddress = pubkey.toBase58();

      const airdropMsg = await ctx.reply("⏳ *Checking eligibility & requesting 0.25 Devnet SOL...*", {
        parse_mode: "Markdown",
      });

      // 1. Try central API faucet (enforces strict 24-hour rate limit and treasury wallet)
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
          return ctx.reply(
            `⏳ *Daily Limit Reached*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `This wallet address has already claimed demo funds today.\n\n` +
            `• *Wallet:* \`${recipientAddress}\`\n` +
            `• *Next Claim Available:* *${apiResult.formattedWait || "after 24 hours"}*\n\n` +
            `_Rate limit: Each wallet address can only request once every 24 hours._`,
            { parse_mode: "Markdown" }
          );
        }

        if (res.ok && apiResult.success) {
          apiSuccess = true;
        }
      } catch {
        // Fallback to direct RPC if webapp is starting up or offline
      }

      let signature = "";
      let amount = 0.25;

      if (apiSuccess && apiResult) {
        signature = apiResult.signature;
        amount = apiResult.amount || 0.25;
      } else {
        // 2. Direct RPC Fallback
        const airdropSig = await solanaConnection.requestAirdrop(
          pubkey,
          Math.round(0.25 * LAMPORTS_PER_SOL)
        );
        await waitForConfirmation(airdropSig, 20000);
        signature = airdropSig;
      }

      // Fetch updated on-chain balance
      let currentBal: number | null = null;
      try {
        const lamports = await solanaConnection.getBalance(pubkey);
        currentBal = Number(lamports) / Number(LAMPORTS_PER_SOL);
      } catch { }

      const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

      const confirmationLines = [
        `💧 *Devnet Faucet Confirmation*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `✅ *Status:* Demo funds delivered on-chain!`,
        `💰 *Amount Credited:* *+${amount} SOL*`,
        `👤 *Recipient Wallet:* \`${recipientAddress}\``,
        currentBal !== null ? `💳 *Current Balance:* \`${currentBal.toFixed(3)} SOL\`` : null,
        `⏳ *Daily Limit:* Strictly 1 request per 24 hours`,
        ``,
        `⛓️ [View On-Chain Tx on Solana Explorer](${explorerUrl})`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👇 *Use your test funds to start predicting:*`,
      ].filter(Boolean).join("\n");

      return ctx.reply(confirmationLines, {
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
    } catch (err: any) {
      return ctx.reply(
        `⚠️ *Faucet Request Failed:*\n${err.message || "Invalid address or RPC faucet rate limit"}\n\n` +
        `👉 *Instant No-GitHub Options:*\n` +
        `1. Claim in our WebApp: [PantaChat Faucet](${config.WEBAPP_URL}/?faucet=true)\n` +
        `2. Alternative Web Faucet: [solfaucet.com](https://solfaucet.com)`,
        { parse_mode: "Markdown" }
      );
    }
  });

  // ---------------------------------------------------------------------------
  // 9. /dispute <market_id> <reason> - Challenge Proposed Outcome
  // ---------------------------------------------------------------------------
  bot.command("dispute", async (ctx) => {
    const rawText = (ctx.message as any)?.text || "";
    const parts = rawText.replace(/^\/dispute(@\w+)?\s*/i, "").trim().split(/\s+/);
    const marketId = parts[0];
    const reason = parts.slice(1).join(" ") || "Community dispute challenge";

    if (!marketId) {
      return sendSafeReply(
        ctx,
        `ℹ️ *Usage:* \`/dispute <market_id> <reason>\`\nExample: \`/dispute sol-100 Criteria resolves YES if Arsenal wins\``
      );
    }

    try {
      const market = await getMarketById(marketId).catch(() => null);
      if (!market) {
        return sendSafeReply(ctx, `❌ Market \`${marketId}\` not found.`);
      }

      if (market.resolutionStatus === "disputed") {
        return sendSafeReply(
          ctx,
          `⚠️ Market "*${market.title}*" is already in disputed status. Auto-finalization is currently halted.`
        );
      }

      if (market.resolutionStatus !== "proposed") {
        return sendSafeReply(
          ctx,
          `⚠️ Market "*${market.title}*" is currently *${(market.resolutionStatus || "open").toUpperCase()}* and is not inside the 2-hour challenge window.`
        );
      }

      const userTag = ctx.from?.username ? `@${ctx.from.username}` : (ctx.from?.first_name || "Trader");
      const updated = await disputeMarketOutcome(market.id, `${userTag}: ${reason}`);

      const alertText = [
        `⚠️ *RESOLUTION CHALLENGED!*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Trader *${userTag}* has disputed the proposed outcome for:`,
        `*${market.title}*`,
        ``,
        `📝 *Reason:* ${reason}`,
        `⚠️ *Total Disputes:* ${updated?.disputeCount || 1}`,
        `🛑 *Auto-finalization has been halted for human verification / consensus review.*`,
      ].join("\n");

      return sendSafeReply(ctx, alertText);
    } catch (err: any) {
      return sendSafeReply(ctx, `❌ Failed to record dispute: ${err.message}`);
    }
  });

  // ---------------------------------------------------------------------------
  // 10. /oracle <market_id> - Inspect AI Oracle Verification Log
  // ---------------------------------------------------------------------------
  bot.command("oracle", async (ctx) => {
    const rawText = (ctx.message as any)?.text || "";
    const parts = rawText.replace(/^\/oracle(@\w+)?\s*/i, "").trim().split(/\s+/);
    const marketId = parts[0];

    if (!marketId) {
      return sendSafeReply(
        ctx,
        `ℹ️ *Usage:* \`/oracle <market_id>\`\nExample: \`/oracle mkt_arsenal_chelsea_1790951354\``
      );
    }

    try {
      const market = await getMarketById(marketId).catch(() => null);
      if (!market) {
        return sendSafeReply(ctx, `❌ Market \`${marketId}\` not found.`);
      }

      const confPct =
        market.confidenceScore !== undefined && market.confidenceScore !== null
          ? `${Math.round(Number(market.confidenceScore) * 100)}%`
          : "Pending (Eval at Cutoff)";

      const disputeStr = market.disputeUntil
        ? `${new Date(
            market.disputeUntil < 10000000000
              ? market.disputeUntil * 1000
              : market.disputeUntil
          ).toISOString()}`
        : "Not triggered";

      const cutoffStr = market.cutoffAt
        ? new Date(
            typeof market.cutoffAt === "number" && market.cutoffAt < 10000000000
              ? market.cutoffAt * 1000
              : market.cutoffAt
          ).toISOString()
        : "N/A";

      const lines = [
        `🔮 *PANTACHAT AI ORACLE VERIFICATION LOG*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🎯 *${market.title}*`,
        `🆔 \`${market.id}\``,
        ``,
        `📊 *Lifecycle Status:* *${(market.resolutionStatus || "open").toUpperCase()}*`,
        market.proposedOutcome ? `⏳ *Proposed Winner:* *${market.proposedOutcome.toUpperCase()}*` : null,
        market.resolvedOutcome ? `🏆 *Final Settled Outcome:* *${market.resolvedOutcome.toUpperCase()}*` : null,
        ``,
        `🧠 *AI Confidence Score:* *${confPct}* (Deterministic temp 0.0)`,
        `🔍 *Factual Evidence Snippet:*`,
        `_${market.evidenceSummary || "Awaiting cutoff timestamp & official consensus verification."}_`,
        ``,
        `🔗 *Official Authority Source:*`,
        market.evidenceUrl ? `[Click to Open Evidence Source](${market.evidenceUrl})` : `_No URL registered yet_`,
        ``,
        `⏱️ *Timestamps:*`,
        `• Cutoff: \`${cutoffStr}\``,
        `• Challenge Deadline: \`${disputeStr}\``,
        `• Total Disputes: *${market.disputeCount || 0}*`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🛡️ *Decentralized & Tamper-Proof AI Resolution Engine*`,
      ].filter(Boolean);

      const buttons: any[] = [];
      if (market.evidenceUrl) {
        buttons.push([{ text: "🔍 Open Source Evidence", url: market.evidenceUrl }]);
      }
      if (market.resolutionStatus === "proposed") {
        buttons.push([{ text: "⚠️ Dispute Resolution", callback_data: `dispute_${market.id}` }]);
      }

      return sendSafeReply(ctx, lines.join("\n"), {
        parse_mode: "Markdown",
        reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined,
      });
    } catch (err: any) {
      return sendSafeReply(ctx, `❌ Error retrieving Oracle verification log: ${err.message}`);
    }
  });

  // ---------------------------------------------------------------------------
  // Natural Language Conversational Handler
  // Allows users in direct messages or replying to the bot to draft markets or ask questions
  // ---------------------------------------------------------------------------
  bot.on("text", async (ctx, next) => {
    const text = (ctx.message as any)?.text?.trim() || "";
    // Pass slash commands to their registered command handlers
    if (text.startsWith("/")) {
      return next();
    }

    const isPrivate = ctx.chat?.type === "private";
    const isReplyToBot = (ctx.message as any)?.reply_to_message?.from?.id === ctx.botInfo?.id;

    if (isPrivate || isReplyToBot) {
      ctx.sendChatAction("typing").catch(() => {});
      // If substantive text or question, draft a market from it
      if (text.length >= 10 || text.includes("?") || /will|sol|btc|crypto|eth|win|hit|reach/i.test(text)) {
        return handleMarketDraft(ctx);
      }

      // Friendly greeting & guide
      return sendSafeReply(
        ctx,
        `👋 *Hi there! I'm PantaChat.*\n\n` +
        `The conversational prediction market bot on Solana.\n\n` +
        `• *Draft a market:* Send me any prediction question (e.g. _"Will Solana reach $300 by end of month?"_)\n` +
        `• *Top markets:* Tap /trending to see active action\n` +
        `• *Your portfolio:* Check /positions\n` +
        `• *Royalties:* Check /earnings\n` +
        `• *Test funds:* Request free SOL with /faucet <wallet>`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔥 Trending Markets", callback_data: "refresh_trending" },
                { text: "🌐 Open WebApp", url: config.WEBAPP_URL },
              ],
            ],
          },
        }
      );
    }

    return next();
  });
}
