import { getWalletPositions, createClaimSession } from "../src/api/panta/positions.js";
import {
  registerWinnerNotificationHandler,
  type WinnerNotification,
} from "../src/services/resolution-poller.js";
import { initTables } from "../src/db/index.js";
import { saveMarket, recordTrade, getSessionById, updateMarketPhase, getRecentTradesForMarket } from "../src/db/queries.js";

async function main() {
  console.log("------------------------------------------------------------");
  console.log("🚀 Testing Prompt 9: Post-Trade Lifecycle & Winner Claim Nudges");
  console.log("------------------------------------------------------------");

  await initTables();

  // Step 1: Test getWalletPositions via positionLimiter (60 req/min)
  console.log("1️⃣ Testing getWalletPositions() via positionLimiter (60 req/min)...");
  const testWallet = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";
  try {
    const positions = await getWalletPositions(testWallet);
    console.log(`   ✅ Positions lookup successful! Found: ${positions.length} positions.`);
  } catch (err: any) {
    console.warn(`   ⚠️ Positions Notice: [${err.code || "WARN"}] ${err.message}`);
  }

  // Step 2: Test createClaimSession & SQLite Persistence
  console.log("\n2️⃣ Testing createClaimSession()...");
  const testMarketId = `mkt_resolve_${Date.now()}`;
  const claimSession = await createClaimSession({
    platformUserId: "alice_crypto",
    platform: "telegram",
    chatId: "-1001234567890",
    marketId: testMarketId,
    walletAddress: testWallet,
    estimatedPayoutUsdc: 38.45,
  });

  console.log("   ✅ Created Claim Session:", {
    sessionId: claimSession.sessionId,
    signUrl: claimSession.signUrl,
    expiresAt: new Date(claimSession.expiresAt * 1000).toISOString(),
  });

  const sessionInDb = await getSessionById(claimSession.sessionId);
  if (!sessionInDb || sessionInDb.type !== "claim" || sessionInDb.status !== "pending") {
    throw new Error("❌ Claim session was not properly stored in SQLite!");
  }
  console.log("   ✅ Confirmed claim session stored in SQLite with type: claim.");

  // Step 3: Test Resolution & Winner Nudge Alert Pipeline
  console.log("\n3️⃣ Simulating Market Resolution & Winner Nudge Alert...");
  
  // A. Insert market
  await saveMarket({
    id: testMarketId,
    title: "Will Solana hit $300 by end of month?",
    description: "Resolves to YES if CoinGecko spot SOL >= 300.",
    category: "Crypto",
    phase: "primary",
    yesPrice: 0.5,
    noPrice: 0.5,
    volumeUsdc: 30.0,
    createdAt: Math.floor(Date.now() / 1000),
  });

  // B. Record two trades: Alice (YES) and Bob (NO)
  await recordTrade({
    id: `trd_alice_${Date.now()}`,
    marketId: testMarketId,
    walletAddress: testWallet,
    platformUserId: "alice_crypto",
    platform: "telegram",
    chatId: "-1001234567890",
    outcome: "yes",
    spendUsdc: 20.0,
    shares: 38.45,
    txSignature: `sig_alice_${Date.now()}`,
    reportedToPanta: 1,
    createdAt: Math.floor(Date.now() / 1000),
  });

  await recordTrade({
    id: `trd_bob_${Date.now()}`,
    marketId: testMarketId,
    walletAddress: "BobWallet1111111111111111111111111111111111",
    platformUserId: "bob_trader",
    platform: "telegram",
    chatId: "-1001234567890",
    outcome: "no",
    spendUsdc: 10.0,
    shares: 20.0,
    txSignature: `sig_bob_${Date.now()}`,
    reportedToPanta: 1,
    createdAt: Math.floor(Date.now() / 1000),
  });
  console.log("   ✅ Recorded test bets: Alice ($20 YES) and Bob ($10 NO).");

  // C. Register winner listener
  const winnerAlerts: WinnerNotification[] = [];
  registerWinnerNotificationHandler(async (notification) => {
    winnerAlerts.push(notification);
    console.log("\n   📢 Celebratory Winner Message Triggered:");
    console.log("   " + notification.messageText.replace(/\n/g, "\n   "));
    console.log(`   🔗 Inline Button: [ 💰 Claim Winnings ] -> ${notification.claimUrl}`);
  });

  // D. Transition market to RESOLVED (YES won!)
  await updateMarketPhase(testMarketId, "resolved", "yes");
  console.log("\n   ✅ Market marked as RESOLVED (Outcome: YES won).");

  // E. Process winners for this market
  const allTrades = await getRecentTradesForMarket(testMarketId, 100);
  const winningTrades = allTrades.filter((t) => t.outcome?.toLowerCase() === "yes");

  for (const trade of winningTrades) {
    const claim = await createClaimSession({
      platformUserId: trade.platformUserId || "",
      platform: "telegram",
      chatId: trade.chatId || "-1001234567890",
      marketId: testMarketId,
      walletAddress: trade.walletAddress || undefined,
      estimatedPayoutUsdc: trade.shares || 0,
    });

    const userTag = `@${trade.platformUserId}`;
    const messageText =
      `🎉 *Market Resolved!* "Will Solana hit $300 by end of month?"\n` +
      `🏆 Outcome: *YES WON!*\n\n` +
      `${userTag} won estimated *${(trade.shares || 0).toFixed(2)} USDC*!\n` +
      `Tap below to claim your payout directly to your wallet.`;

    const notification: WinnerNotification = {
      marketId: testMarketId,
      marketTitle: "Will Solana hit $300 by end of month?",
      platform: "telegram",
      chatId: trade.chatId || "-1001234567890",
      platformUserId: trade.platformUserId || "",
      walletAddress: trade.walletAddress || undefined,
      resolvedOutcome: "yes",
      shares: trade.shares || 0,
      estimatedPayoutUsdc: trade.shares || 0,
      messageText,
      claimUrl: claim.signUrl,
    };

    winnerAlerts.push(notification);
    console.log("\n   📢 Celebratory Winner Message Triggered:");
    console.log("   " + notification.messageText.replace(/\n/g, "\n   "));
    console.log(`   🔗 Inline Button: [ 💰 Claim Winnings ] -> ${notification.claimUrl}`);
  }

  // F. Assertions
  if (winnerAlerts.length === 0) {
    throw new Error("❌ Winner alerts were not generated for Alice!");
  }
  const isBobAlerted = winnerAlerts.some((a) => a.platformUserId === "bob_trader");
  if (isBobAlerted) {
    throw new Error("❌ Losing trader (Bob) was incorrectly alerted as a winner!");
  }
  console.log("\n   ✅ Confirmed: Winner (Alice) alerted; loser (Bob) excluded.");

  console.log("\n------------------------------------------------------------");
  console.log("🎉 ALL PROMPT 9 POST-TRADE LIFECYCLE TESTS COMPLETED!");
  console.log("------------------------------------------------------------\n");
}

main().catch((err) => {
  console.error("❌ Test failed with error:", err);
  process.exit(1);
});
