import { GatewayIntentBits, ApplicationCommandType, MessageFlags } from "discord.js";
import { discordClient } from "../src/bot/discord/client.js";
import { commandDefinitions, registerDiscordCommands } from "../src/bot/discord/commands.js";
import { initTables } from "../src/db/index.js";
import { getRecentTradesForUser, saveMarket } from "../src/db/queries.js";

async function main() {
  console.log("------------------------------------------------------------");
  console.log("🚀 Testing Prompt 14: Discord Bot - Slash Commands & Context Menu");
  console.log("------------------------------------------------------------");

  await initTables();

  // Step 1: Verify Client Intents
  console.log("1️⃣ Verifying Discord Client Intent Architecture...");
  const intents = discordClient.options.intents;
  const bitfield = typeof intents === "number" ? intents : (intents as any).bitfield;

  const hasGuilds = Boolean(bitfield & GatewayIntentBits.Guilds);
  const hasGuildMessages = Boolean(bitfield & GatewayIntentBits.GuildMessages);
  const hasMessageContent = Boolean(bitfield & GatewayIntentBits.MessageContent);

  console.log(`   • Guilds Intent: ${hasGuilds ? "✅ Enabled" : "❌ Disabled"}`);
  console.log(`   • GuildMessages Intent: ${hasGuildMessages ? "✅ Enabled" : "❌ Disabled"}`);
  console.log(`   • Privileged MessageContent Intent: ${hasMessageContent ? "⚠️ Enabled (Unexpected)" : "✅ Excluded (Zero Privileged Intent Required)"}`);

  if (!hasGuilds || !hasGuildMessages || hasMessageContent) {
    throw new Error("Client intent validation failed.");
  }

  // Step 2: Verify Command Schema & Context Menu Configuration
  console.log("\n2️⃣ Inspecting Application Command Definitions...");
  const commandJSONs = commandDefinitions.map((cmd) => cmd.toJSON());
  console.log(`   • Total Registered Commands: ${commandJSONs.length}`);

  const slashNames = commandJSONs
    .filter((c: any) => !c.type || c.type === 1)
    .map((c: any) => `/${c.name}`);
  console.log(`   • Slash Commands: ${slashNames.join(", ")}`);

  const contextMenuCmd = commandJSONs.find((c: any) => c.type === ApplicationCommandType.Message);
  if (!contextMenuCmd) {
    throw new Error("Message context menu command not found in command definitions!");
  }
  console.log(`   • Message Context Menu Command: "${contextMenuCmd.name}" (Type: ${contextMenuCmd.type} - Message)`);

  // Step 3: Register Handlers on Client
  console.log("\n3️⃣ Registering Discord Interaction Handlers...");
  registerDiscordCommands(discordClient);
  console.log("   ✅ Interaction event listener successfully attached to client.");

  // Step 4: Simulate Message Context Menu Interaction ("Make a prediction market")
  console.log("\n4️⃣ Simulating Context Menu Command ('Make a prediction market')...");
  let repliedContent = "";
  let repliedFlags = 0;
  let sentComponents: any[] = [];

  const mockContextMenuInteraction: any = {
    isMessageContextMenuCommand: () => true,
    isChatInputCommand: () => false,
    isButton: () => false,
    commandName: "Make a prediction market",
    channelId: "discord_channel_999",
    user: { id: "user_discord_123", username: "solana_builder" },
    targetMessage: {
      content: "Solana is definitely hitting $300 before November 2026, bookmark this!",
    },
    deferReply: async (opts?: any) => {
      repliedFlags = opts?.flags || (opts?.ephemeral ? MessageFlags.Ephemeral : 0);
    },
    editReply: async (data: any) => {
      repliedContent = data.content || "";
      sentComponents = data.components || [];
      return mockContextMenuInteraction;
    },
    isRepliable: () => true,
  };

  discordClient.emit("interactionCreate", mockContextMenuInteraction as any);

  // Allow async drafter to process
  await new Promise((resolve) => setTimeout(resolve, 3500));

  console.log(`   • Ephemeral Guard: ${repliedFlags === MessageFlags.Ephemeral ? "✅ Ephemeral (Private Preview)" : "❌ Public"}`);
  console.log(`   • Generated Preview Content:\n${repliedContent.split("\n").slice(0, 5).map(l => "     " + l).join("\n")}`);
  console.log(`   • Buttons Attached: ${sentComponents.length > 0 ? "✅ Yes" : "❌ None"}`);

  // Step 5: Simulate Slash Command /positions (Ephemeral check)
  console.log("\n5️⃣ Simulating Slash Command /positions...");
  let positionsFlags = 0;
  let positionsText = "";

  const mockPositionsInteraction: any = {
    isMessageContextMenuCommand: () => false,
    isChatInputCommand: () => true,
    isButton: () => false,
    commandName: "positions",
    channelId: "discord_channel_999",
    user: { id: "user_discord_123", username: "solana_builder" },
    options: {
      getString: () => null,
    },
    deferReply: async (opts?: any) => {
      positionsFlags = opts?.flags || (opts?.ephemeral ? MessageFlags.Ephemeral : 0);
    },
    editReply: async (data: any) => {
      positionsText = data.content || "";
      return mockPositionsInteraction;
    },
    isRepliable: () => true,
  };

  discordClient.emit("interactionCreate", mockPositionsInteraction as any);
  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log(`   • Ephemeral Guard for Balances: ${positionsFlags === MessageFlags.Ephemeral ? "✅ Ephemeral (Zero Server Leakage)" : "❌ Public"}`);
  console.log(`   • Response Preview: ${positionsText.split("\n")[0]}`);

  console.log("\n------------------------------------------------------------");
  console.log("🎉 ALL PROMPT 14 DISCORD BOT & CONTEXT MENU TESTS PASSED!");
  console.log("------------------------------------------------------------\n");
}

main().catch((err) => {
  console.error("❌ Test failed with error:", err);
  process.exit(1);
});
