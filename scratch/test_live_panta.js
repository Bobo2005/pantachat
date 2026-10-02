import { Connection, PublicKey } from "@solana/web3.js";

const STAGING_URL = "https://staging-api.panta.market/api/v1";
const API_KEY = "pk_test_cb0HDUB7P_RnUJy0J_gZSaBMzDf3pjTveD6xZzLlUck";
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

async function runLiveVerification() {
  console.log("==================================================");
  console.log("PANTA STAGING & DEVNET LIVE INTEGRATION TEST");
  console.log("==================================================");

  // 1. Query /markets/ with API Key
  console.log("\n1. Fetching markets from GET /markets/ with pk_test_ key...");
  const mRes = await fetch(`${STAGING_URL}/markets/`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  console.log(`GET /markets/ status: ${mRes.status}`);
  const markets = await mRes.json();
  console.log(`Total markets found:`, Array.isArray(markets) ? markets.length : markets);

  if (!Array.isArray(markets) || markets.length === 0) {
    console.log("No markets found in catalog! Response:", markets);
    return;
  }

  // Print summary of first 3 markets
  markets.slice(0, 3).forEach((m, idx) => {
    console.log(`\nMarket [${idx + 1}]:`);
    console.log(`- ID: ${m.id}`);
    console.log(`- Title: ${m.title || m.question}`);
    console.log(`- Phase: ${m.phase || m.status}`);
    console.log(`- Prices: YES=${m.yesPrice}, NO=${m.noPrice}`);
    console.log(`- Event PDA: ${m.eventPda}`);
  });

  // Pick first market in 'primary' phase (or fallback to markets[0])
  const targetMarket = markets.find(m => m.phase === "primary") || markets[0];
  const marketId = targetMarket.id;
  console.log(`\nSelected market for testing: ${marketId} (Phase: ${targetMarket.phase})`);

  // 2. Run primary order quote
  console.log(`\n2. Running POST /primaryorderquote/ on market ${marketId}...`);
  const quoteRes = await fetch(`${STAGING_URL}/primaryorderquote/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      marketId,
      outcome: "yes",
      spendUsdc: "5.00",
    }),
  });
  console.log(`Quote status: ${quoteRes.status}`);
  const quoteData = await quoteRes.json();
  console.log("Quote response:", quoteData);

  // 3. Run primary order build with a dummy Devnet wallet
  const dummyBuyerWallet = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
  console.log(`\n3. Running POST /primaryorderbuild/ with dummy wallet: ${dummyBuyerWallet}...`);
  const buildRes = await fetch(`${STAGING_URL}/primaryorderbuild/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      marketId,
      outcome: "yes",
      spendUsdc: "5.00",
      buyerWallet: dummyBuyerWallet,
      userId: "usr_iDy6dX1Hi7J1TtJXWDIglg",
      maxSlippageBps: 300,
    }),
  });
  console.log(`Build status: ${buildRes.status}`);
  const buildData = await buildRes.json();
  console.log("Build response keys:", Object.keys(buildData));
  if (buildData.transaction) {
    console.log("Transaction (base64 length):", buildData.transaction.length);
  } else {
    console.log("Build Data:", buildData);
  }

  // 4. Test Devnet RPC blockhash and account lookups
  console.log("\n4. Checking Devnet RPC...");
  try {
    const epochInfo = await connection.getEpochInfo();
    console.log(`Connected to Solana Devnet! Epoch: ${epochInfo.epoch}`);
  } catch (err) {
    console.error("Solana Devnet connection error:", err.message);
  }
}

runLiveVerification();
