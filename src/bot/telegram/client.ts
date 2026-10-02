import { Telegraf, type Context } from "telegraf";
import { config } from "../../config.js";

// =============================================================================
// Telegraf Client Instance
// =============================================================================

export const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);

// Global Error Catch Handler
bot.catch((err: unknown, ctx: Context) => {
  const updateType = ctx.updateType;
  const fromUser = ctx.from?.username || ctx.from?.id || "unknown";
  console.error(`[Telegram Bot Error] User: ${fromUser} | Update: ${updateType}:`, err);

  ctx
    .reply(
      "⚠️ An unexpected error occurred while processing your request. Please try again in a moment."
    )
    .catch(() => {});
});
