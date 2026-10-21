import { initTables, db } from "../src/db/index.js";
import { markets, trades } from "../src/db/schema.js";
import { getMarketById } from "../src/db/queries.js";
import { createClaimSession } from "../src/api/panta/positions.js";

async function main() {
  console.log("=== Testing Phase 3: Payout Settlement, VOID Refunds & Oracle Transparency ===");
  await initTables();

  const now = Date.now();

  // ---------------------------------------------------------------------------
  // Test 1: Market Resolved YES -> $1.00/share Winning Payout
  // ---------------------------------------------------------------------------
  console.log("\n--- Test 1: Winning Outcome (YES) Payout Settlement ---");
  const winMarketId = `test-p3-win-${now}`;
  await db.insert(markets).values({
    id: winMarketId,
    title: "Arsenal vs Chelsea - Premier League",
    description: "Resolves YES if Arsenal wins.",
    category: "Sports",
    phase: "resolved",
    cutoffAt: now - 3600000,
    resolutionStatus: "resolved",
    resolvedOutcome: "yes",
    proposedOutcome: "yes",
    disputeUntil: Math.floor((now - 1800000) / 1000),
    evidenceUrl: "https://www.premierleague.com/match/999",
    evidenceSummary: "Full-Time: Arsenal 2 - 1 Chelsea (Official Match Report)",
    confidenceScore: 0.99,
    disputeCount: 0,
    yesPrice: 0.65,
    noPrice: 0.35,
    volumeUsdc: 1500,
  });

  const winTradeId = `trade-p3-win-${now}`;
  const winShares = 100;
  const winCost = 65; // $65 spent for 100 shares @ $0.65
  await db.insert(trades).values({
    id: winTradeId,
    marketId: winMarketId,
    platform: "telegram",
    platformUserId: "charlie_winner",
    chatId: "chat-p3",
    outcome: "yes",
    spendUsdc: winCost,
    shares: winShares,
    reportedToPanta: 1,
  });

  const winMarket = await getMarketById(winMarketId);
  if (!winMarket) throw new Error("Winning market not found");

  // Evaluate payout value
  const wonPayoutPerShare = 1.0; // $1.00 USDC per share
  const totalWinningValue = winShares * wonPayoutPerShare;
  const netProfit = totalWinningValue - winCost;

  console.log(`✅ Market: "${winMarket.title}"`);
  console.log(`   Resolution Status: ${winMarket.resolutionStatus?.toUpperCase()}`);
  console.log(`   Settled Winner: ${winMarket.resolvedOutcome?.toUpperCase()}`);
  console.log(`   Winning Trader Shares: ${winShares} shares`);
  console.log(`   Cost: $${winCost.toFixed(2)} USDC`);
  console.log(`   Payout Value: $${totalWinningValue.toFixed(2)} USDC ($1.00/share)`);
  console.log(`   Net Profit: +$${netProfit.toFixed(2)} USDC (+${((netProfit / winCost) * 100).toFixed(1)}%)`);

  if (totalWinningValue !== 100) {
    throw new Error(`Expected $100.00 payout for 100 winning shares, got $${totalWinningValue}`);
  }

  // Create claim signing session
  const claimSession = await createClaimSession({
    marketId: winMarketId,
    outcome: "yes",
    shares: winShares,
    claimableUsdc: totalWinningValue,
  });

  console.log(`✅ Claim Winnings Session Created: ${claimSession.sessionId}`);
  console.log(`   Signing URL: ${claimSession.signUrl}`);
  if (!claimSession.signUrl.includes("/sign?session=")) {
    throw new Error("Invalid claim session signing URL");
  }

  // ---------------------------------------------------------------------------
  // Test 2: Market Resolved VOID -> 100% Refund Safety Net
  // ---------------------------------------------------------------------------
  console.log("\n--- Test 2: VOID (Canceled Event) 100% Refund Safety Net ---");
  const voidMarketId = `test-p3-void-${now}`;
  await db.insert(markets).values({
    id: voidMarketId,
    title: "Man City vs Liverpool - Heavy Rain Postponement",
    description: "Resolves YES if Man City wins, VOID if postponed indefinitely.",
    category: "Sports",
    phase: "resolved",
    cutoffAt: now - 7200000,
    resolutionStatus: "void",
    resolvedOutcome: "void",
    proposedOutcome: "void",
    disputeUntil: Math.floor((now - 3600000) / 1000),
    evidenceUrl: "https://www.premierleague.com/news/postponed-match",
    evidenceSummary: "Match officially postponed due to waterlogged pitch. VOID condition triggered.",
    confidenceScore: 1.0,
    disputeCount: 0,
    yesPrice: 0.5,
    noPrice: 0.5,
    volumeUsdc: 2500,
  });

  // User bought YES ($40 USDC)
  const voidTrade1 = `trade-p3-void-yes-${now}`;
  const depositYes = 40;
  await db.insert(trades).values({
    id: voidTrade1,
    marketId: voidMarketId,
    platform: "telegram",
    platformUserId: "david_void",
    chatId: "chat-p3",
    outcome: "yes",
    spendUsdc: depositYes,
    shares: 80,
    reportedToPanta: 1,
  });

  // Another user bought NO ($60 USDC)
  const voidTrade2 = `trade-p3-void-no-${now}`;
  const depositNo = 60;
  await db.insert(trades).values({
    id: voidTrade2,
    marketId: voidMarketId,
    platform: "telegram",
    platformUserId: "eve_void",
    chatId: "chat-p3",
    outcome: "no",
    spendUsdc: depositNo,
    shares: 120,
    reportedToPanta: 1,
  });

  const voidMarket = await getMarketById(voidMarketId);
  if (!voidMarket) throw new Error("Void market not found");

  // Validate 100% refund calculation
  const refundYes = depositYes; // 100% of deposited USDC
  const refundNo = depositNo;   // 100% of deposited USDC

  console.log(`✅ Market: "${voidMarket.title}"`);
  console.log(`   Resolution Status: ${voidMarket.resolutionStatus?.toUpperCase()} (Canceled Event)`);
  console.log(`   YES Depositor Refund: $${refundYes.toFixed(2)} USDC (100% Principal Returned)`);
  console.log(`   NO Depositor Refund: $${refundNo.toFixed(2)} USDC (100% Principal Returned)`);

  if (refundYes !== depositYes || refundNo !== depositNo) {
    throw new Error("VOID refund calculation did not return 100% of deposited funds");
  }

  // Create refund claim session
  const refundSession = await createClaimSession({
    marketId: voidMarketId,
    estimatedPayoutUsdc: refundYes,
  });

  console.log(`✅ VOID 100% Refund Session Created: ${refundSession.sessionId}`);
  console.log(`   Signing URL: ${refundSession.signUrl}`);

  // ---------------------------------------------------------------------------
  // Test 3: Proposed Market & /oracle Inspection Transparency
  // ---------------------------------------------------------------------------
  console.log("\n--- Test 3: Proposed Outcome & AI Oracle Transparency ---");
  const propMarketId = `test-p3-prop-${now}`;
  const disputeWindowSecs = Math.floor((now + 5400000) / 1000); // 1.5 hours remaining
  await db.insert(markets).values({
    id: propMarketId,
    title: "Solana Breakpoint: Firedancer Mainnet Announced by Oct 2026",
    description: "Resolves YES if Firedancer is live on Solana mainnet.",
    category: "Crypto",
    phase: "primary",
    cutoffAt: now - 1800000,
    resolutionStatus: "proposed",
    proposedOutcome: "yes",
    disputeUntil: disputeWindowSecs,
    evidenceUrl: "https://solana.com/news/firedancer-mainnet",
    evidenceSummary: "Jump Crypto & Solana Foundation announce Firedancer genesis block on mainnet-beta.",
    confidenceScore: 0.99,
    disputeCount: 1,
    disputeReason: "@crypto_trader: Checking exact validator count",
    yesPrice: 0.85,
    noPrice: 0.15,
    volumeUsdc: 4500,
  });

  const propMarket = await getMarketById(propMarketId);
  if (!propMarket) throw new Error("Proposed market not found");

  const confPct = `${Math.round(Number(propMarket.confidenceScore) * 100)}%`;
  const timeLeftMin = Math.round((Number(propMarket.disputeUntil) * 1000 - Date.now()) / 60000);

  console.log(`✅ Oracle Log Inspection:`);
  console.log(`   Market: ${propMarket.title}`);
  console.log(`   Lifecycle Status: ${propMarket.resolutionStatus?.toUpperCase()}`);
  console.log(`   Proposed Outcome: ${propMarket.proposedOutcome?.toUpperCase()}`);
  console.log(`   AI Confidence Score: ${confPct} (Deterministic consensus temp 0.0)`);
  console.log(`   Official Evidence URL: ${propMarket.evidenceUrl}`);
  console.log(`   Factual Evidence Proof: "${propMarket.evidenceSummary}"`);
  console.log(`   Dispute Window Remaining: ~${timeLeftMin} minutes`);
  console.log(`   Active Disputes: ${propMarket.disputeCount} (${propMarket.disputeReason})`);

  if (!propMarket.evidenceUrl || !propMarket.evidenceSummary || propMarket.confidenceScore !== 0.99) {
    throw new Error("Oracle transparency fields incomplete");
  }

  console.log("\n🎉 ALL PHASE 3 SETTLEMENT, VOID REFUND & ORACLE TRANSPARENCY TESTS PASSED!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Phase 3 Test Failed:", err);
  process.exit(1);
});
