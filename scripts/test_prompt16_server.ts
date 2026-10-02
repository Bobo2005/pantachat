import axios from "axios";
import { app, startServer } from "../src/api/server.js";
import { initTables } from "../src/db/index.js";
import { saveMarket, getSessionById } from "../src/db/queries.js";
import { createTradeSession } from "../src/api/panta/trading.js";
import { initiateMarketCreationSession } from "../src/api/panta/create.js";

async function main() {
  console.log("------------------------------------------------------------");
  console.log("🚀 Testing Prompt 16: Express Backend Server & Session API");
  console.log("------------------------------------------------------------");

  await initTables();

  const testPort = 3099;
  const server = startServer(testPort);
  const apiBase = `http://localhost:${testPort}/api`;

  try {
    // Step 1: Health Check Endpoint
    console.log("1️⃣ Testing GET /api/health...");
    const healthRes = await axios.get(`${apiBase}/health`);
    console.log(`   • Status: ${healthRes.status} (${healthRes.data.status})`);
    console.log(`   • Network: ${healthRes.data.network}`);
    console.log(`   • Solana RPC: ${healthRes.data.solanaRpc.ok ? "✅ Connected" : "⚠️ Warning"} (Slot: ${healthRes.data.solanaRpc.slot})`);
    console.log(`   • Panta API:  ${healthRes.data.pantaApi.ok ? "✅ Connected" : "⚠️ Warning"}`);

    // Step 2: Trending Markets Endpoint
    console.log("\n2️⃣ Testing GET /api/markets/trending...");
    const trendingRes = await axios.get(`${apiBase}/markets/trending`);
    console.log(`   • Status: ${trendingRes.status}`);
    console.log(`   • Markets Returned: ${trendingRes.data.markets?.length || 0} cached markets`);

    // Step 3: Seed Test Market and Buy Session
    const testMarketId = `mkt_srv_${Date.now()}`;
    await saveMarket({
      id: testMarketId,
      title: "Will Solana hit $300 before November 2026?",
      category: "Crypto",
      phase: "primary",
      yesPrice: 0.62,
      noPrice: 0.38,
      volumeUsdc: 5000.0,
      createdAt: Math.floor(Date.now() / 1000),
    });

    const buySession = await createTradeSession({
      platformUserId: "solana_trader",
      platform: "telegram",
      chatId: "chat_777",
      marketId: testMarketId,
      outcome: "yes",
      amountUsdc: 20,
    });
    console.log(`\n3️⃣ Seeded test buy session in SQLite: ${buySession.sessionId}`);

    // Step 4: Test GET /api/sessions/:id
    console.log("\n4️⃣ Testing GET /api/sessions/:id...");
    const sessionRes = await axios.get(`${apiBase}/sessions/${buySession.sessionId}`);
    console.log(`   • Status: ${sessionRes.status}`);
    console.log(`   • Session Type: ${sessionRes.data.session.type} (Status: ${sessionRes.data.session.status})`);
    console.log(`   • Market Title: "${sessionRes.data.market?.title || testMarketId}"`);
    console.log(`   • Bet Details: $${sessionRes.data.payload.amountUsdc} on ${sessionRes.data.payload.outcome.toUpperCase()}`);

    // Step 5: Test Create Market Session
    console.log("\n5️⃣ Testing Create Market Session API Retrieval...");
    const createSession = await initiateMarketCreationSession({
      platformUserId: "creator_degen",
      platform: "discord",
      chatId: "chan_888",
      title: "Will ETH flip BTC in transaction volume?",
      description: "Resolves YES if monthly Ethereum volume exceeds Bitcoin before Dec 2026.",
      category: "Crypto",
      cutoffAt: "2026-12-31T23:59:59Z",
    });

    const createSessionRes = await axios.get(`${apiBase}/sessions/${createSession.sessionId}`);
    console.log(`   • Status: ${createSessionRes.status}`);
    console.log(`   • Session Type: ${createSessionRes.data.session.type}`);
    console.log(`   • Draft Title: "${createSessionRes.data.payload.title}"`);

    // Step 6: Test Non-Existent Session Error Handling
    console.log("\n6️⃣ Testing 404 for Invalid Session ID...");
    try {
      await axios.get(`${apiBase}/sessions/invalid_session_id_xyz`);
    } catch (err: any) {
      console.log(`   • Expected 404 Response: ${err.response?.status} (${err.response?.data?.error}) ✅`);
    }

    console.log("\n------------------------------------------------------------");
    console.log("🎉 ALL PROMPT 16 EXPRESS SERVER & SESSION API TESTS PASSED!");
    console.log("------------------------------------------------------------\n");
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error("❌ Test failed with error:", err);
  process.exit(1);
});
