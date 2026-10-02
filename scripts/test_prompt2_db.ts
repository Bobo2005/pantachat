import { initTables } from "../src/db/index.js";
import {
  saveMarket,
  getMarketById,
  updateMarketOdds,
  updateMarketPhase,
  recordTrade,
  getRecentTradesForUser,
  getLeaderboard,
  createSession,
  getSessionById,
  updateSessionStatus,
} from "../src/db/queries.js";

async function main() {
  console.log("------------------------------------------------------------");
  console.log("🚀 Testing Prompt 2: Database Schema & Drizzle ORM Queries");
  console.log("------------------------------------------------------------");

  // Step 1: Initialize database tables
  console.log("1️⃣ Initializing SQLite tables...");
  await initTables();
  console.log("   ✅ Tables (markets, trades, sessions) verified/created successfully.");

  // Step 2: Insert a test market
  const testMarketId = `mkt_test_${Date.now()}`;
  console.log(`\n2️⃣ Inserting test market: ${testMarketId}...`);
  const createdMarket = await saveMarket({
    id: testMarketId,
    title: "Will Solana flip Ethereum market cap by end of 2026?",
    description: "Resolves YES if Solana market cap exceeds Ethereum according to CoinGecko.",
    category: "Crypto",
    creatorWallet: "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
    creatorPlatformId: "telegram_12345678",
    platform: "telegram",
    chatId: "-1001234567890",
    messageId: "msg_9999",
    phase: "primary",
    cutoffAt: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
    yesPrice: 0.5,
    noPrice: 0.5,
    volumeUsdc: 0.0,
    createdAt: Math.floor(Date.now() / 1000),
  });
  console.log("   ✅ Market created:", {
    id: createdMarket.id,
    title: createdMarket.title,
    phase: createdMarket.phase,
    yesPrice: createdMarket.yesPrice,
  });

  // Step 3: Fetch by ID
  console.log(`\n3️⃣ Retrieving market by ID...`);
  const fetched = await getMarketById(testMarketId);
  if (!fetched || fetched.id !== testMarketId) {
    throw new Error("❌ Failed to retrieve market by ID!");
  }
  console.log("   ✅ Market retrieved successfully from database.");

  // Step 4: Update odds & volume
  console.log(`\n4️⃣ Updating market odds (YES shifts to 0.65)...`);
  const updatedOdds = await updateMarketOdds(testMarketId, 0.65, 0.35, 25.0);
  console.log("   ✅ Odds updated:", {
    yesPrice: updatedOdds?.yesPrice,
    noPrice: updatedOdds?.noPrice,
    volumeUsdc: updatedOdds?.volumeUsdc,
  });

  // Step 5: Record a trade
  const testTx = `sig_test_${Date.now()}`;
  const testUser = "usr_alice_tg";
  console.log(`\n5️⃣ Recording trade for user '${testUser}' ($25 YES)...`);
  const trade = await recordTrade({
    id: `trd_${Date.now()}`,
    marketId: testMarketId,
    walletAddress: "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
    platformUserId: testUser,
    platform: "telegram",
    chatId: "-1001234567890",
    outcome: "yes",
    spendUsdc: 25.0,
    shares: 38.46,
    txSignature: testTx,
    reportedToPanta: 0,
    createdAt: Math.floor(Date.now() / 1000),
  });
  console.log("   ✅ Trade recorded:", {
    tradeId: trade.id,
    outcome: trade.outcome,
    spendUsdc: trade.spendUsdc,
    txSignature: trade.txSignature,
  });

  // Step 6: Verify user trade history & leaderboard
  console.log(`\n6️⃣ Fetching recent trades and leaderboard...`);
  const userTrades = await getRecentTradesForUser(testUser);
  console.log(`   ✅ User trades found: ${userTrades.length}`);

  const leaderboard = await getLeaderboard(5);
  console.log("   ✅ Top Leaderboard entry:", leaderboard[0]);

  // Step 7: Test Signing Sessions
  const sessionId = `sess_${Date.now()}`;
  console.log(`\n7️⃣ Creating signing session: ${sessionId}...`);
  const session = await createSession({
    id: sessionId,
    type: "buy",
    marketId: testMarketId,
    platformUserId: testUser,
    chatId: "-1001234567890",
    platform: "telegram",
    payloadJson: JSON.stringify({ amountUsdc: 25, outcome: "yes" }),
    status: "pending",
    createdAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + 600, // 10 min TTL
  });
  console.log("   ✅ Session created in state:", session.status);

  const updatedSession = await updateSessionStatus(sessionId, "signed");
  console.log("   ✅ Session updated to state:", updatedSession?.status);

  console.log("\n------------------------------------------------------------");
  console.log("🎉 ALL PROMPT 2 DATABASE TESTS COMPLETED SUCCESSFULLY!");
  console.log("------------------------------------------------------------\n");
}

main().catch((err) => {
  console.error("❌ Test failed with error:", err);
  process.exit(1);
});
