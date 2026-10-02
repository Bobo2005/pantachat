import { registerDiscordApplicationCommands } from "../src/bot/discord/commands.js";
import { config } from "../src/config.js";

async function main() {
  console.log("⚡ [Discord] Registering application commands...");
  console.log(`🤖 Client ID: ${config.DISCORD_CLIENT_ID}`);

  try {
    await registerDiscordApplicationCommands();
    console.log("✅ [Discord] All slash commands and Message Context Menu commands registered successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ [Discord] Command registration failed:", error);
    process.exit(1);
  }
}

main();
