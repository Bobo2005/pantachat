import { type Telegraf, type Context } from "telegraf";
import type { InlineQueryResultArticle } from "telegraf/types";
import { getMarketById, getMarkets, getTrendingMarkets } from "../../api/panta/markets.js";
import { generateProgressBar } from "../common/card-builder.js";
import { formatUsdc } from "../../utils/formatters.js";
import { config } from "../../config.js";

// =============================================================================
// Telegram Inline Query Handler
// =============================================================================

/**
 * Handles inline queries triggered when users type `@pantachat_bot <query>`
 * in any Telegram group, channel, or direct message.
 */
export async function handleInlineQuery(ctx: Context): Promise<void> {
  const query = (ctx.inlineQuery?.query || "").trim();
  const results: InlineQueryResultArticle[] = [];
  let isPersonal = false;

  try {
    // -------------------------------------------------------------------------
    // 1. Position Share Query: share_pos_<marketId>_<outcome>_<spend>
    // -------------------------------------------------------------------------
    if (query.startsWith("share_pos_")) {
      isPersonal = true;
      const match = query.match(/^share_pos_([^_]+)_(yes|no)_(\d+)/i);

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
            const odds = outcome === "yes" ? yesPct : noPct;
            const progressBar = generateProgressBar(yesPct, 10);
            const outcomeEmoji = outcome === "yes" ? "🟢" : "🔴";
            const userHandle = ctx.from?.username
              ? `@${ctx.from.username}`
              : ctx.from?.first_name || "Trader";

            const messageText = [
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
              ],
            ];

            results.push({
              type: "article",
              id: `share_pos_${market.id}_${outcome}_${spend}`,
              title: `🎯 Share Position: ${outcome.toUpperCase()} on ${market.title}`,
              description: `Spent $${spend} USDC • Odds: ${odds}% • Tap to send to this chat`,
              input_message_content: {
                message_text: messageText,
                parse_mode: "Markdown",
              },
              reply_markup: {
                inline_keyboard: buttons,
              },
            });
          }
        } catch (err: any) {
          console.warn(`[Inline Query] Failed loading market for position share ${marketId}:`, err.message);
        }
      }
    }

    // -------------------------------------------------------------------------
    // 2. Market Share Query: share_mkt_<marketId>
    // -------------------------------------------------------------------------
    else if (query.startsWith("share_mkt_")) {
      const match = query.match(/^share_mkt_([^_]+)/i);

      if (match) {
        const marketId = match[1];
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

            const messageText = [
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

            const buttons = [
              [
                { text: "🟢 Buy YES $5", callback_data: `buy_${market.id}_yes_5` },
                { text: "🔴 Buy NO $5", callback_data: `buy_${market.id}_no_5` },
              ],
              [
                {
                  text: "🚀 Open in Mini App",
                  url: `https://t.me/${config.TELEGRAM_BOT_USERNAME}?startapp=mkt_${market.id}`,
                },
                { text: "🔄 Refresh Odds", callback_data: `refresh_${market.id}` },
              ],
            ];

            results.push({
              type: "article",
              id: `share_mkt_${market.id}`,
              title: `🔥 Share Market: ${market.title}`,
              description: `YES ${yesPct}% • NO ${noPct}% • Vol: ${volumeStr} • Tap to share`,
              input_message_content: {
                message_text: messageText,
                parse_mode: "Markdown",
              },
              reply_markup: {
                inline_keyboard: buttons,
              },
            });
          }
        } catch (err: any) {
          console.warn(`[Inline Query] Failed loading market ${marketId}:`, err.message);
        }
      }
    }

    // -------------------------------------------------------------------------
    // 3. Trending Markets or Search Query (Empty / "trending" / keyword)
    // -------------------------------------------------------------------------
    if (results.length === 0) {
      let candidateMarkets: any[] = [];

      if (!query || query.toLowerCase() === "trending") {
        candidateMarkets = await getTrendingMarkets(5);
      } else {
        // Keyword Search across catalog
        try {
          const all = await getMarkets({ limit: 30 });
          const q = query.toLowerCase();
          const filtered = all.filter(
            (m) =>
              m.title.toLowerCase().includes(q) ||
              (m.category && m.category.toLowerCase().includes(q))
          );
          candidateMarkets = filtered.length > 0 ? filtered.slice(0, 5) : await getTrendingMarkets(5);
        } catch {
          candidateMarkets = await getTrendingMarkets(5);
        }
      }

      for (const m of candidateMarkets) {
        const yesPrice = Number(m.yesPrice) || 0.5;
        const noPrice = Number(m.noPrice) || 0.5;
        const total = yesPrice + noPrice;
        const yesPct = Math.round((total > 0 ? yesPrice / total : 0.5) * 100);
        const noPct = 100 - yesPct;
        const progressBar = generateProgressBar(yesPct, 10);
        const volumeStr = formatUsdc(m.volumeUsdc || 0);

        const cardText = [
          `🔥 *${(m.category || "CRYPTO").toUpperCase()} PREDICTION MARKET*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `*"${m.title}"*`,
          ``,
          `📊 Current Sentiment:`,
          `🟢 YES ${yesPct}%  ${progressBar}  ${noPct}% NO 🔴`,
          ``,
          `📈 Volume: *${volumeStr}* • Status: *${m.phase === "secondary" ? "🟣 Secondary" : "🟢 Primary Curve"}*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `⚡ *Powered by Panta • Non-Custodial*`,
        ].join("\n");

        results.push({
          type: "article",
          id: `trending_${m.id}`,
          title: `🔥 [${m.category || "Crypto"}] ${m.title}`,
          description: `YES ${yesPct}% • NO ${noPct}% • Vol: ${volumeStr} • Tap to share`,
          input_message_content: {
            message_text: cardText,
            parse_mode: "Markdown",
          },
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🟢 Buy YES $5", callback_data: `buy_${m.id}_yes_5` },
                { text: "🔴 Buy NO $5", callback_data: `buy_${m.id}_no_5` },
              ],
              [
                {
                  text: "🚀 Open in Mini App",
                  url: `https://t.me/${config.TELEGRAM_BOT_USERNAME}?startapp=mkt_${m.id}`,
                },
                { text: "🔄 Refresh Odds", callback_data: `refresh_${m.id}` },
              ],
            ],
          },
        });
      }
    }

    await ctx.answerInlineQuery(results, {
      cache_time: isPersonal ? 2 : 10,
      is_personal: isPersonal,
    });
  } catch (err: any) {
    console.error("[Inline Query Handler Error]:", err.message);
    await ctx.answerInlineQuery([], { cache_time: 1 }).catch(() => {});
  }
}

/**
 * Registers inline query handler with Telegraf bot instance.
 */
export function registerTelegramInline(bot: Telegraf): void {
  bot.on("inline_query", handleInlineQuery);
}
