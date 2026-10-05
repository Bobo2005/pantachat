import { registerDiscordApplicationCommands } from "../src/bot/discord/commands.js";
import { config } from "../src/config.js";

async function main() {
  const guildId = process.argv[2] || config.DISCORD_GUILD_ID;

  console.log("============================================================");
  console.log("⚡ [Discord] Registering Application Slash Commands");
  console.log("============================================================");
  console.log(`🤖 Client ID:  ${config.DISCORD_CLIENT_ID}`);
  if (guildId) {
    console.log(`🏠 Guild Mode: ${guildId} (Instant propagation)`);
  } else {
    console.log(`🌐 Global Mode: All guilds (Takes ~5-15m for Discord CDN)`);
  }
  console.log("------------------------------------------------------------");

  try {
    await registerDiscordApplicationCommands(guildId);
    console.log("✅ [Discord] All slash commands & Context Menu registered successfully!");
    process.exit(0);
  } catch (error: any) {
    console.error("❌ [Discord] Command registration failed:", error?.message || error);
    process.exit(1);
  }
}

main();
