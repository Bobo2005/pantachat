import { initTables, db } from "../src/db/index.js";
import { markets, trades } from "../src/db/schema.js";
import { eq } from "drizzle-orm";
import {
  checkMarketResolutionsOnce,
  registerProposedResolutionHandler,
  registerWinnerNotificationHandler,
  ProposedResolutionNotification,
  WinnerNotification,
} from "../src/services/resolution-poller.js";
import {
  getMarketById,
  disputeMarketOutcome,
  proposeMarketOutcome,
  updateMarketResolutionStatus,
} from "../src/db/queries.js";

async function main() {
  console.log("=== Testing Phase 2: Automated AI Resolution & Dispute Pipeline ===");
  await initTables();

  const proposedEvents: ProposedResolutionNotification[] = [];
  const winnerEvents: WinnerNotification[] = [];

  registerProposedResolutionHandler((n) => {
    proposedEvents.push(n);
  });

  registerWinnerNotificationHandler((w) => {
    winnerEvents.push(w);
  });

  // ---------------------------------------------------------------------------
  // Test 1: Undisputed Market Auto-Finalization
  // ---------------------------------------------------------------------------
  console.log("\n--- Test 1: Undisputed 2-Hour Window Auto-Finalization ---");
  const market1Id = "test-phase2-undisputed-" + Date.now();

  // Create market with expired cutoff and 2-hour window expired in the past
  await db.insert(markets).values({
    id: market1Id,
    title: "Arsenal vs Chelsea Premier League Final",
    description: "Resolves YES if Arsenal wins.",
    category: "Sports",
    phase: "primary",
    cutoffAt: Date.now() - 10000000,
    resolutionStatus: "proposed",
    proposedOutcome: "yes",
    disputeUntil: Math.floor((Date.now() - 3600000) / 1000), // 1 hour ago
    evidenceUrl: "https://www.premierleague.com/match/123",
    evidenceSummary: "Full-time Arsenal 2 - 1 Chelsea",
    confidenceScore: 0.98,
    disputeCount: 0,
    yesPrice: 0.6,
    noPrice: 0.4,
    volumeUsdc: 200,
  });

  // Insert winning trade for user
  const trade1Id = "trade-1-" + Date.now();
  await db.insert(trades).values({
    id: trade1Id,
    marketId: market1Id,
    platform: "telegram",
    platformUserId: "alice_winner",
    chatId: "chat-100",
    outcome: "yes",
    spendUsdc: 20,
    shares: 33.33,
    reportedToPanta: 1,
  });

  console.log("Running checkMarketResolutionsOnce()...");
  const finalizedCount = await checkMarketResolutionsOnce();
  console.log(`✓ checkMarketResolutionsOnce completed (finalized ${finalizedCount} markets)`);

  const updated1 = await getMarketById(market1Id);
  console.log("Market 1 Status after Poller:", {
    phase: updated1?.phase,
    resolutionStatus: updated1?.resolutionStatus,
    resolvedOutcome: updated1?.resolvedOutcome,
  });

  if (
    updated1?.phase !== "resolved" ||
    updated1?.resolutionStatus !== "resolved" ||
    updated1?.resolvedOutcome !== "yes"
  ) {
    throw new Error("Market 1 should have been auto-finalized as 'resolved'!");
  }

  const winnerNotice = winnerEvents.find((w) => w.marketId === market1Id);
  if (!winnerNotice) {
    throw new Error("Expected WinnerNotification for alice_winner was not dispatched!");
  }
  console.log("✓ Winner Notification Dispatched Successfully:", {
    user: winnerNotice.platformUserId,
    outcome: winnerNotice.resolvedOutcome,
    payout: winnerNotice.estimatedPayoutUsdc,
  });

  // ---------------------------------------------------------------------------
  // Test 2: Disputed Market Halts Auto-Finalization
  // ---------------------------------------------------------------------------
  console.log("\n--- Test 2: Disputed Market Halts Auto-Finalization ---");
  const market2Id = "test-phase2-disputed-" + Date.now();

  await db.insert(markets).values({
    id: market2Id,
    title: "Man City vs Real Madrid Champions League",
    description: "Resolves YES if Man City wins.",
    category: "Sports",
    phase: "primary",
    cutoffAt: Date.now() - 10000000,
    resolutionStatus: "proposed",
    proposedOutcome: "yes",
    disputeUntil: Math.floor((Date.now() - 3600000) / 1000), // Dispute window expired
    evidenceUrl: "https://www.uefa.com/match/456",
    evidenceSummary: "Match result disputed",
    confidenceScore: 0.96,
    disputeCount: 0,
    yesPrice: 0.5,
    noPrice: 0.5,
    volumeUsdc: 300,
  });

  // Trader challenges proposed resolution
  console.log("Challenging market resolution with disputeMarketOutcome()...");
  const disputedMarket = await disputeMarketOutcome(market2Id, "Referee ruled goal offside in extra time");
  console.log("Market 2 Disputed Status:", {
    resolutionStatus: disputedMarket?.resolutionStatus,
    disputeCount: disputedMarket?.disputeCount,
  });

  if (disputedMarket?.resolutionStatus !== "disputed" || disputedMarket?.disputeCount !== 1) {
    throw new Error("Dispute count or status failed to update!");
  }

  // Run poller again
  await checkMarketResolutionsOnce();
  const updated2 = await getMarketById(market2Id);

  console.log("Market 2 Status after Poller run:", {
    phase: updated2?.phase,
    resolutionStatus: updated2?.resolutionStatus,
    resolvedOutcome: updated2?.resolvedOutcome,
  });

  if (updated2?.resolutionStatus !== "disputed" || updated2?.phase === "resolved") {
    throw new Error("Disputed market MUST NOT be auto-finalized!");
  }
  console.log("✓ Auto-finalization was properly HALTED for disputed market!");

  // Clean up test data
  await db.delete(trades).where(eq(trades.id, trade1Id));
  await db.delete(markets).where(eq(markets.id, market1Id));
  await db.delete(markets).where(eq(markets.id, market2Id));
  console.log("\n✓ Cleaned up test database fixtures.");

  console.log("\n🎉 Phase 2 Proposed Outcome & 2-Hour Dispute Window Tests PASSED 100%!");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
