import { type Telegraf, type Context } from "telegraf";
import { getMarketById, getMarketStats } from "../../api/panta/markets.js";
import { createTradeSession } from "../../api/panta/trading.js";
import { getSessionById } from "../../db/queries.js";
import { buildMarketCardText, getPresetBuyButtons } from "../common/card-builder.js";
import { registerCardUpdateListener } from "../../services/attribution-reporter.js";
import { config } from "../../config.js";

// =============================================================================
// Register Callback Handlers
// =============================================================================

export function registerTelegramCallbacks(bot: Telegraf): void {
  // ---------------------------------------------------------------------------
  // 1. Refresh Odds (In-Place Update with Zero Chat Spam)
  // Matches "refresh_odds:<marketId>" or "refresh_<marketId>"
  // ---------------------------------------------------------------------------
  bot.action(/^(refresh_odds:|refresh_)(.+)$/, async (ctx) => {
    const marketId = ctx.match[2];

    try {
      const market = await getMarketById(marketId);
      const newCardText = buildMarketCardText(market);
      const buttons = getPresetBuyButtons(market.id, market.phase);

      // Memory.md invariant: Visual odds bar lives in message text, so call editMessageText
      await ctx.editMessageText(newCardText, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: buttons as any },
      });

      await ctx.answerCbQuery("⚡ Odds and sentiment bar updated!").catch(() => {});
    } catch (err: any) {
      console.warn(`[Telegram Callback] Failed refreshing odds for ${marketId}:`, err.message);
      await ctx.answerCbQuery("⚠️ Odds are currently up to date.").catch(() => {});
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Buy Preset Buttons ($5, $20 YES / NO)
  // Matches "buy_preset:<marketId>:<outcome>:<amount>" or "buy_<marketId>_<outcome>_<amount>"
  // ---------------------------------------------------------------------------
  bot.action(/^(buy_preset:|buy_)(.+?)[_:](yes|no)[_:](\d+)$/i, async (ctx) => {
    const marketId = ctx.match[2];
    const outcome = ctx.match[3].toLowerCase() as "yes" | "no";
    const amount = Number(ctx.match[4]);

    const platformUserId = ctx.from?.username || String(ctx.from?.id || "unknown");
    const chatId = String(ctx.chat?.id || "");

    try {
      // Create ephemeral trade session in DB
      const session = await createTradeSession({
        platformUserId,
        platform: "telegram",
        chatId,
        marketId,
        outcome,
        amountUsdc: amount,
      });

      await ctx.answerCbQuery(`Opening $${amount} ${outcome.toUpperCase()} signing sheet...`).catch(() => {});

      // Reply with Telegram Mini App (TMA) web_app button + external fallback
      await ctx.reply(
        `🎯 *Ready to place bet:* $${amount} on *${outcome.toUpperCase()}*\n` +
          `Tap below to sign non-custodially in Phantom without leaving Telegram:`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: `⚡ Sign $${amount} ${outcome.toUpperCase()} (Mini App)`,
                  web_app: { url: session.signUrl },
                },
              ],
              [
                {
                  text: "🌐 Open in External Browser",
                  url: session.signUrl,
                },
              ],
            ],
          },
        }
      );
    } catch (err: any) {
      console.error("[Telegram Callback] Buy preset error:", err);
      await ctx.answerCbQuery("❌ Failed to initiate order session.").catch(() => {});
    }
  });

  // ---------------------------------------------------------------------------
  // 3. Custom Amount Modal
  // Matches "custom_amount:<marketId>" or "buy_<marketId>_custom"
  // ---------------------------------------------------------------------------
  bot.action(/^(custom_amount:|buy_)(.+?)_custom$/i, async (ctx) => {
    const marketId = ctx.match[2];
    const platformUserId = ctx.from?.username || String(ctx.from?.id || "unknown");
    const chatId = String(ctx.chat?.id || "");

    try {
      // Create session with default $10 custom starter
      const session = await createTradeSession({
        platformUserId,
        platform: "telegram",
        chatId,
        marketId,
        outcome: "yes",
        amountUsdc: 10,
      });

      await ctx.answerCbQuery("Opening custom order slider...").catch(() => {});

      await ctx.reply(
        `⚙️ *Custom Bet Slider*\n` +
          `Adjust your bet size, choose YES or NO, and review slippage tolerance inside the Mini App:`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "⚡ Open Custom Bet Sheet",
                  web_app: { url: `${config.WEBAPP_URL}/sign?session=${session.sessionId}&custom=true` },
                },
              ],
            ],
          },
        }
      );
    } catch (err: any) {
      await ctx.answerCbQuery("❌ Failed to open custom order modal.").catch(() => {});
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Confirm Market Creation
  // Matches "create_confirm:<sessionId>" or "confirm_create_<sessionId>"
  // ---------------------------------------------------------------------------
  bot.action(/^(create_confirm:|confirm_create_)(.+)$/i, async (ctx) => {
    const sessionId = ctx.match[2];

    try {
      const session = await getSessionById(sessionId);
      if (!session) {
        await ctx.answerCbQuery("⚠️ Session expired or not found. Please re-draft.").catch(() => {});
        return;
      }

      const signUrl = `${config.WEBAPP_URL}/sign?session=${session.id}`;
      await ctx.answerCbQuery("Opening market creation signing sheet...").catch(() => {});

      await ctx.reply(
        `🚀 *Confirm Market Creation (50 USDC Fee)*\n` +
          `Review market rules and sign on Solana Devnet:`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "⚡ Sign Creation in Phantom",
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
      await ctx.answerCbQuery("❌ Error loading creation session.").catch(() => {});
    }
  });

  // ---------------------------------------------------------------------------
  // 5. Market Details Pop-up
  // Matches "details_<marketId>" or "details:<marketId>"
  // ---------------------------------------------------------------------------
  bot.action(/^(details_|details:)(.+)$/i, async (ctx) => {
    const marketId = ctx.match[2];
    try {
      const stats = await getMarketStats(marketId);
      const text =
        `📊 *Market Details:*\n` +
        `• YES Prob: ${stats.yesProbPercent} (Multiplier: ${stats.yesPayout}x)\n` +
        `• NO Prob:  ${stats.noProbPercent} (Multiplier: ${stats.noPayout}x)\n` +
        `• Time Left: ${stats.timeRemaining}\n` +
        `• Phase: ${stats.phase.toUpperCase()}`;

      await ctx.answerCbQuery().catch(() => {});
      await ctx.reply(text, { parse_mode: "Markdown" });
    } catch (err: any) {
      await ctx.answerCbQuery("ℹ️ Details currently unavailable.").catch(() => {});
    }
  });

  // ---------------------------------------------------------------------------
  // 6. Connect Attribution Auto-Refresh Hook (Prompt 8 integration)
  // ---------------------------------------------------------------------------
  registerCardUpdateListener(async ({ platform, chatId, messageId, marketId }) => {
    if (platform !== "telegram" || !chatId || !messageId) return;

    try {
      const market = await getMarketById(marketId);
      const updatedText = buildMarketCardText(market);
      const buttons = getPresetBuyButtons(market.id, market.phase);

      await bot.telegram.editMessageText(chatId, Number(messageId), undefined, updatedText, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: buttons as any },
      });
    } catch (err: any) {
      console.warn(`[Auto-Refresh] In-place card edit skipped for ${messageId}:`, err.message);
    }
  });
}
