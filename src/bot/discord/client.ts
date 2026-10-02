import { Client, GatewayIntentBits } from "discord.js";
import { config } from "../../config.js";

// =============================================================================
// Discord Client Instance (discord.js v14)
// Required Intents: Guilds, GuildMessages (MessageContent NOT required)
// =============================================================================

export const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

// Bot Lifecycle Event Handlers
discordClient.on("ready", () => {
  console.log(`🤖 [Discord Bot] Logged in as ${discordClient.user?.tag}!`);
});

discordClient.on("error", (error) => {
  console.error("❌ [Discord Bot Error]:", error);
});
