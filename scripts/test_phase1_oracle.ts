import { initTables, db } from "../src/db/index.js";
import { markets } from "../src/db/schema.js";
import { eq } from "drizzle-orm";
import {
  verifyMarketOutcome,
  oracleVerificationResultSchema,
} from "../src/services/ai-oracle.js";
import {
  proposeMarketOutcome,
  disputeMarketOutcome,
  resolveMarketFinal,
  getMarketById,
} from "../src/db/queries.js";

async function main() {
  console.log("=== Testing Phase 1: Database Schema & Lifecycle Columns ===");
  await initTables();

  const testMarketId = "test-oracle-market-" + Date.now();

  // Insert test market with lifecycle columns
  await db.insert(markets).values({
    id: testMarketId,
    title: "Arsenal vs Chelsea Premier League 2026",
    description: "Resolves YES if Arsenal wins. Source: Premier League official report.",
    category: "Sports",
    phase: "primary",
    cutoffAt: Date.now() - 3600000, // 1 hour ago
    resolutionStatus: "open",
    yesPrice: 0.5,
    noPrice: 0.5,
    volumeUsdc: 150,
  });

  console.log("✓ Market inserted with default lifecycle status 'open'");

  // Test proposeMarketOutcome
  const disputeUntil = Date.now() + 2 * 3600 * 1000;
  await proposeMarketOutcome(testMarketId, {
    proposedOutcome: "yes",
    disputeUntil,
    evidenceUrl: "https://www.premierleague.com/match/12345",
    evidenceSummary: "Full-time: Arsenal 2 - 1 Chelsea",
    confidenceScore: 0.98,
  });

  let updated = await getMarketById(testMarketId);
  console.log("✓ Market proposed outcome:", {
    resolutionStatus: updated?.resolutionStatus,
    proposedOutcome: updated?.proposedOutcome,
    disputeUntil: updated?.disputeUntil,
    confidenceScore: updated?.confidenceScore,
    evidenceUrl: updated?.evidenceUrl,
    evidenceSummary: updated?.evidenceSummary,
  });

  if (
    updated?.resolutionStatus !== "proposed" ||
    updated?.proposedOutcome !== "yes" ||
    updated?.confidenceScore !== 0.98
  ) {
    throw new Error("Lifecycle proposal fields mismatch!");
  }

  // Test disputeMarketOutcome
  await disputeMarketOutcome(testMarketId, "Disputing score evidence");
  updated = await getMarketById(testMarketId);
  console.log("✓ Market disputed:", {
    resolutionStatus: updated?.resolutionStatus,
    disputeCount: updated?.disputeCount,
  });

  if (updated?.resolutionStatus !== "disputed" || updated?.disputeCount !== 1) {
    throw new Error("Dispute count or status mismatch!");
  }

  // Test resolveMarketFinal
  await resolveMarketFinal(testMarketId, "yes");
  updated = await getMarketById(testMarketId);
  console.log("✓ Market final resolution:", {
    phase: updated?.phase,
    resolutionStatus: updated?.resolutionStatus,
    resolvedOutcome: updated?.resolvedOutcome,
  });

  if (
    updated?.phase !== "resolved" ||
    updated?.resolutionStatus !== "resolved" ||
    updated?.resolvedOutcome !== "yes"
  ) {
    throw new Error("Final resolution status mismatch!");
  }

  console.log("\n=== Testing AI Oracle Schema & Guardrails ===");
  // Verify strict schema validation
  const validMock = {
    outcome: "yes",
    confidence: 0.98,
    evidenceUrl: "https://premierleague.com/match/123",
    evidenceSummary: "Arsenal won 2-1",
    isOfficialFinished: true,
    reasoning: "Arsenal won in regulation.",
  };
  const parsed = oracleVerificationResultSchema.parse(validMock);
  console.log("✓ Zod schema validates correct structured JSON:", parsed.outcome);

  // Test verifyMarketOutcome execution
  console.log("✓ Testing verifyMarketOutcome guardrails...");
  const oracleResult = await verifyMarketOutcome({
    id: "sample-market",
    title: "Will Solana hit $500 before end of 2026?",
    description: "Resolves according to CoinGecko live price.",
    category: "Crypto",
    cutoffAt: Date.now() + 10000000,
  });
  console.log("✓ verifyMarketOutcome result:", oracleResult);
  if (oracleResult.outcome !== "unresolved") {
    throw new Error("Unfinished event should resolve to 'unresolved'!");
  }

  // Clean up test market
  await db.delete(markets).where(eq(markets.id, testMarketId));
  console.log("✓ Cleaned up test market");

  console.log("\n🎉 Phase 1 Database & Oracle Verification Engine verification SUCCESSFUL!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
