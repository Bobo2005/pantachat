import { config } from "./config.js";
import { initTables } from "./db/index.js";
import { startServer } from "./api/server.js";
import { bot } from "./bot/telegram/client.js";
import { registerTelegramCommands } from "./bot/telegram/commands.js";
import { registerTelegramCallbacks } from "./bot/telegram/callbacks.js";
import { discordClient } from "./bot/discord/client.js";
import { registerDiscordCommands, registerDiscordApplicationCommands } from "./bot/discord/commands.js";
import { startResolutionPoller, registerWinnerNotificationHandler } from "./services/resolution-poller.js";
import { startGraduationPoller } from "./services/graduation-poller.js";

// =============================================================================
// Main Service Bootstrapper
// =============================================================================

async function bootstrap() {
  console.log("============================================================");
  console.log("🚀 BOOTING PANTACHAT MULTI-PLATFORM RUNTIME");
  console.log("============================================================");
  console.log(`• Environment:  ${config.ENV_LABEL}`);
  console.log(`• Solana RPC:   ${config.SOLANA_RPC_URL} (${config.SOLANA_NETWORK})`);
  console.log(`• Panta API:    ${config.PANTA_API_BASE_URL}`);
  console.log(`• Express Port: ${config.PORT}`);
  console.log(`• WebApp URL:   ${config.WEBAPP_URL}`);

  // 1. Initialize SQLite Database Schema
  await initTables();
  console.log("✅ [Database] SQLite tables initialized with Drizzle ORM.");

  // 2. Start Express API Server
  const server = startServer(config.PORT);

  // 3. Register Telegram Bot Routing & Action Callbacks
  registerTelegramCommands(bot);
  registerTelegramCallbacks(bot);

  // 4. Register Discord Bot Commands, Context Menu & Button Interactions
  registerDiscordCommands(discordClient);

  // 5. Connect Winner Resolution Broadcaster
  registerWinnerNotificationHandler(async (notification) => {
    if (notification.platform === "telegram" && notification.chatId) {
      await bot.telegram
        .sendMessage(notification.chatId, notification.messageText, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: "💰 Claim Payout", url: notification.claimUrl }]],
          },
        })
        .catch((err) => console.warn("[Notify] Telegram winner alert notice:", err.message));
    } else if (notification.platform === "discord" && notification.chatId) {
      try {
        const channel = await discordClient.channels.fetch(notification.chatId);
        if (channel && channel.isTextBased()) {
          await (channel as any).send({
            content: `${notification.messageText}\n\n👉 **Claim Winnings:** ${notification.claimUrl}`,
          });
        }
      } catch (err: any) {
        console.warn("[Notify] Discord winner alert notice:", err.message);
      }
    }
  });

  // 6. Launch Telegram Bot (Safe Long Polling)
  if (config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_BOT_TOKEN !== "dummy_telegram_token") {
    bot
      .launch({ dropPendingUpdates: true })
      .then(() => {
        console.log(`🤖 [Telegram] Bot active & listening as @${config.TELEGRAM_BOT_USERNAME}!`);
      })
      .catch((err) => {
        console.warn(`⚠️ [Telegram] Launch error (check token in .env):`, err.message);
      });
  } else {
    console.log("ℹ️ [Telegram] Placeholder token detected. Skipping live polling launch.");
  }

  // 7. Login Discord Bot Client
  if (config.DISCORD_BOT_TOKEN && config.DISCORD_BOT_TOKEN !== "dummy_discord_token") {
    discordClient
      .login(config.DISCORD_BOT_TOKEN)
      .then(async () => {
        console.log("🤖 [Discord] Bot successfully connected to Gateway!");
        try {
          await registerDiscordApplicationCommands(config.DISCORD_GUILD_ID);
        } catch (regErr: any) {
          console.warn("⚠️ [Discord] Slash commands registration notice:", regErr?.message || regErr);
        }
      })
      .catch((err) => {
        console.warn(`⚠️ [Discord] Login error (check token in .env):`, err.message);
      });
  } else {
    console.log("ℹ️ [Discord] Placeholder token detected. Skipping live gateway login.");
  }

  // 8. Start Background Polling Services (Resolution & Graduation Watchers)
  const stopResolution = startResolutionPoller(60000);
  const stopGraduation = startGraduationPoller(60000);
  console.log("⏱️ [Pollers] Resolution & Creator Graduation pollers active (60s cycle).");

  console.log("============================================================");
  console.log("✨ ALL SYSTEMS OPERATIONAL — PANTACHAT IS LIVE!");
  console.log("============================================================\n");

  // Graceful Shutdown Coordinator
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 [Shutdown] Received ${signal}. Gracefully stopping PantaChat...`);
    stopResolution();
    stopGraduation();
    server.close();
    try {
      bot.stop(signal);
    } catch {}
    try {
      discordClient.destroy();
    } catch {}
    console.log("👋 [Shutdown] All processes closed. Goodbye!");
    process.exit(0);
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
  console.error("❌ Fatal error bootstrapping PantaChat:", err);
  process.exit(1);
});
