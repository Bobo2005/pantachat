import {
  getCreateQuote,
  getCreateBuild,
  initiateMarketCreationSession,
} from "../src/api/panta/create.js";
import { getSessionById } from "../src/db/queries.js";
import { initTables } from "../src/db/index.js";
import { PantaApiError } from "../src/api/panta/client.js";

async function main() {
  console.log("------------------------------------------------------------");
  console.log("🚀 Testing Prompt 6: Market Creation Pipeline & Sessions");
  console.log("------------------------------------------------------------");

  await initTables();

  // Step 1: Test Signing Session Initialization & SQLite Storage
  console.log("1️⃣ Testing initiateMarketCreationSession() & DB Persistence...");
  const session = await initiateMarketCreationSession({
    platformUserId: "usr_alice_tg",
    platform: "telegram",
    chatId: "-1001234567890",
    title: "Will SOL flip BNB market cap by December 2026?",
    description: "Resolves to YES if CoinGecko confirms SOL market cap > BNB.",
    category: "Crypto",
    cutoffAt: new Date(Date.now() + 86400 * 30 * 1000).toISOString(),
    creatorWallet: "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
  });

  console.log("   ✅ Created Session:", {
    sessionId: session.sessionId,
    signUrl: session.signUrl,
    expiresAt: new Date(session.expiresAt * 1000).toISOString(),
  });

  const storedSession = await getSessionById(session.sessionId);
  if (!storedSession || storedSession.status !== "pending") {
    throw new Error("❌ Session was not properly retrieved from SQLite database!");
  }
  console.log("   ✅ Verified session in SQLite database (Status: pending).");

  // Step 2: Test Panta Create Quote (POST /markets/create/quote/)
  console.log("\n2️⃣ Testing getCreateQuote() against Panta Protocol API...");
  try {
    const quote = await getCreateQuote({
      title: "Will SOL flip BNB market cap by December 2026?",
      category: "Crypto",
      cutoffAt: new Date(Date.now() + 86400 * 30 * 1000).toISOString(),
      description: "Resolves to YES if CoinGecko confirms SOL market cap > BNB.",
    });

    console.log("   ✅ Received Create Quote from Panta:");
    console.log("   • Create ID:        ", quote.createId);
    console.log("   • Expected Event PDA:", quote.expectedEventPda);
    console.log("   • Creation Fee:     ", `${quote.feeBaseUnits / 1_000_000} USDC (${quote.feeBaseUnits} base units)`);

    // Step 3: Test Panta Create Build if quote succeeded
    if (quote.createId) {
      console.log("\n3️⃣ Testing getCreateBuild() using buildLimiter (20 req/min)...");
      const build = await getCreateBuild({
        createId: quote.createId,
        title: "Will SOL flip BNB market cap by December 2026?",
        description: "Resolves to YES if CoinGecko confirms SOL market cap > BNB.",
        category: "Crypto",
        cutoffAt: new Date(Date.now() + 86400 * 30 * 1000).toISOString(),
        creatorWallet: "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
      });

      console.log("   ✅ Create Build Successful:");
      console.log("   • Tx Length (base64):", build.transaction?.length || 0);
      console.log("   • Event PDA:        ", build.eventPda || quote.expectedEventPda);
    }
  } catch (err: any) {
    if (err instanceof PantaApiError) {
      console.log(`   ⚠️ Panta API Notice (${err.statusCode}): [${err.code}] ${err.message}`);
    } else {
      console.error("   ❌ Unexpected error:", err);
      throw err;
    }
  }

  console.log("\n------------------------------------------------------------");
  console.log("🎉 ALL PROMPT 6 CREATION PIPELINE TESTS COMPLETED!");
  console.log("------------------------------------------------------------\n");
}

main().catch((err) => {
  console.error("❌ Test failed with error:", err);
  process.exit(1);
});
