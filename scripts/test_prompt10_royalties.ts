import { getCreatorFeeClaimBuild } from "../src/api/panta/claims.js";
import {
  getUserEarnings,
  registerGraduationListener,
  type GraduationNotification,
} from "../src/services/graduation-poller.js";
import { initTables } from "../src/db/index.js";
import { saveMarket, updateMarketPhase } from "../src/db/queries.js";
import { PantaApiError } from "../src/api/panta/client.js";

async function main() {
  console.log("------------------------------------------------------------");
  console.log("🚀 Testing Prompt 10: Creator Royalties, Graduation & /earnings");
  console.log("------------------------------------------------------------");

  await initTables();

  const testCreator = "alice_creator";
  const testWallet = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";

  // Step 1: Test Pre-Graduation Quota Protection
  console.log("1️⃣ Testing Pre-Graduation Quota Protection (MARKET_NOT_GRADUATED)...");
  const primaryMarketId = `mkt_prim_${Date.now()}`;
  await saveMarket({
    id: primaryMarketId,
    title: "Will SOL break $300 before graduation?",
    category: "Crypto",
    phase: "primary", // Still on bonding curve!
    creatorPlatformId: testCreator,
    creatorWallet: testWallet,
    volumeUsdc: 250.0,
    yesPrice: 0.5,
    noPrice: 0.5,
    createdAt: Math.floor(Date.now() / 1000),
  });

  try {
    await getCreatorFeeClaimBuild({
      marketId: primaryMarketId,
      creatorWallet: testWallet,
      currentPhase: "primary",
    });
    throw new Error("❌ Should have blocked claim on ungraduated market!");
  } catch (err: any) {
    if (err instanceof PantaApiError && err.code === "MARKET_NOT_GRADUATED") {
      console.log(`   ✅ Successfully intercepted: [${err.code}] ${err.message}`);
    } else {
      throw err;
    }
  }

  // Step 2: Test Market Graduation Listener
  console.log("\n2️⃣ Testing Market Graduation Listener...");
  const graduatedMarketId = `mkt_grad_${Date.now()}`;
  await saveMarket({
    id: graduatedMarketId,
    title: "Will Solana flip Ethereum in DEX Volume?",
    category: "Crypto",
    phase: "secondary", // Successfully graduated!
    creatorPlatformId: testCreator,
    creatorWallet: testWallet,
    volumeUsdc: 5000.0,
    yesPrice: 0.75,
    noPrice: 0.25,
    createdAt: Math.floor(Date.now() / 1000),
  });

  let graduationReceived = false;
  registerGraduationListener(async (notif: GraduationNotification) => {
    graduationReceived = true;
    console.log("   🚀 Graduation Listener Triggered for:", notif.title);
    console.log(`   🔗 Claim URL: ${notif.claimUrl}`);
  });

  // Step 3: Test /earnings Aggregator & Formatter
  console.log("\n3️⃣ Testing getUserEarnings() Aggregator...");
  const earnings = await getUserEarnings(testCreator, "telegram", "-1001234567890");

  console.log("   ✅ User Earnings Summary:");
  console.log("   • Total Markets Created:", earnings.totalMarketsCreated);
  console.log("   • Graduated Markets:    ", earnings.graduatedMarketsCount);
  console.log("   • Total Volume:         ", `$${earnings.totalVolumeUsdc.toFixed(2)} USDC`);
  console.log("   • Claimable Markets:    ", earnings.claimableMarkets.length);

  if (earnings.claimableMarkets.length > 0) {
    console.log("   • Claim Link:           ", earnings.claimableMarkets[0].claimUrl);
  }

  console.log("\n   📝 Formatted Message Output:");
  console.log("   " + earnings.formattedMessage.replace(/\n/g, "\n   "));

  // Verifications
  if (earnings.totalMarketsCreated < 2) {
    throw new Error(`Expected at least 2 markets created, got ${earnings.totalMarketsCreated}`);
  }
  if (earnings.graduatedMarketsCount < 1) {
    throw new Error(`Expected at least 1 graduated market, got ${earnings.graduatedMarketsCount}`);
  }
  if (earnings.claimableMarkets.length === 0) {
    throw new Error("Expected at least 1 claimable market for creator royalties!");
  }

  console.log("\n------------------------------------------------------------");
  console.log("🎉 ALL PROMPT 10 CREATOR ROYALTIES TESTS COMPLETED!");
  console.log("------------------------------------------------------------\n");
}

main().catch((err) => {
  console.error("❌ Test failed with error:", err);
  process.exit(1);
});
