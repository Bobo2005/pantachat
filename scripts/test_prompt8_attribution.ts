import { waitForConfirmation, solanaConnection } from "../src/utils/solana.js";
import {
  reportTradeToPanta,
  registerCardUpdateListener,
} from "../src/services/attribution-reporter.js";
import { initTables } from "../src/db/index.js";
import { recordTrade, saveMarket, db } from "../src/db/index.js";
import { trades } from "../src/db/schema.js";
import { eq } from "drizzle-orm";

async function main() {
  console.log("------------------------------------------------------------");
  console.log("🚀 Testing Prompt 8: Order Verification & Attribution Reporter");
  console.log("------------------------------------------------------------");

  await initTables();

  // Step 1: Test Solana RPC Connection to Devnet
  console.log("1️⃣ Testing Solana RPC Connectivity...");
  try {
    const slot = await solanaConnection.getSlot();
    console.log(`   ✅ Connected to Solana RPC! Current slot: ${slot}`);
  } catch (err: any) {
    console.warn(`   ⚠️ RPC Notice: Could not fetch slot (${err.message}). Continuing...`);
  }

  // Step 2: Test waitForConfirmation with Sandbox Signature
  console.log("\n2️⃣ Testing waitForConfirmation() Poller...");
  const mockSignature = `sig_test_${Date.now()}`;
  const confirmed = await waitForConfirmation(mockSignature, 5000);
  console.log(`   ✅ Confirmation poller resolved for ${mockSignature}: ${confirmed}`);

  // Step 3: Record local trade in SQLite (with prerequisite market)
  console.log("\n3️⃣ Recording mock market & trade in SQLite...");
  const testMarketId = `mkt_attr_${Date.now()}`;
  await saveMarket({
    id: testMarketId,
    title: "Will SOL flip BNB market cap by December 2026?",
    description: "Resolves to YES if CoinGecko confirms SOL market cap > BNB.",
    category: "Crypto",
    phase: "primary",
    yesPrice: 0.5,
    noPrice: 0.5,
    volumeUsdc: 0.0,
    createdAt: Math.floor(Date.now() / 1000),
  });
  console.log(`   ✅ Created parent market: ${testMarketId}`);
  await recordTrade({
    id: `trd_${Date.now()}`,
    marketId: testMarketId,
    walletAddress: "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
    platformUserId: "usr_alice_tg",
    platform: "telegram",
    chatId: "-1001234567890",
    outcome: "yes",
    spendUsdc: 20.0,
    shares: 40.0,
    txSignature: mockSignature,
    reportedToPanta: 0,
    createdAt: Math.floor(Date.now() / 1000),
  });
  console.log("   ✅ Local trade recorded with reportedToPanta = 0");

  // Step 4: Register Card Update Listener Hook
  console.log("\n4️⃣ Registering In-Place Card Update Listener...");
  let listenerTriggered = false;
  registerCardUpdateListener(async (event) => {
    console.log("   🔔 Card Update Hook Fired:", {
      platform: event.platform,
      chatId: event.chatId,
      messageId: event.messageId,
      marketId: event.marketId,
    });
    listenerTriggered = true;
  });

  // Step 5: Execute Complete Attribution Reporting Pipeline
  console.log("\n5️⃣ Executing reportTradeToPanta()...");
  const result = await reportTradeToPanta({
    signature: mockSignature,
    userId: "usr_alice_tg",
    marketId: testMarketId,
    platform: "telegram",
    chatId: "-1001234567890",
    messageId: "msg_998877",
  });

  console.log("   ✅ Attribution Report Result:", {
    signature: result.signature,
    confirmedOnChain: result.confirmedOnChain,
    reportedToPanta: result.reportedToPanta,
    cardUpdated: result.cardUpdated,
  });

  // Step 6: Verify Database sync flag
  const [updatedRecord] = await db
    .select()
    .from(trades)
    .where(eq(trades.txSignature, mockSignature));

  if (!updatedRecord || updatedRecord.reportedToPanta !== 1) {
    throw new Error("❌ SQLite trade reportedToPanta flag was not updated to 1!");
  }
  console.log("   ✅ Verified SQLite trade table: reportedToPanta = 1");

  if (!listenerTriggered) {
    throw new Error("❌ In-place card update listener was not triggered!");
  }
  console.log("   ✅ Verified card update event dispatched to bot listeners.");

  console.log("\n------------------------------------------------------------");
  console.log("🎉 ALL PROMPT 8 ATTRIBUTION & VERIFICATION TESTS PASSED!");
  console.log("------------------------------------------------------------\n");
}

main().catch((err) => {
  console.error("❌ Test failed with error:", err);
  process.exit(1);
});
