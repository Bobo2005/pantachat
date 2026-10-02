import { Keypair } from "@solana/web3.js";

const STAGING_URL = "https://staging-api.panta.market/api/v1";
const LIVE_URL = "https://live-api.panta.market/api/v1";
const TEST_API_KEY = "pk_test_cb0HDUB7P_RnUJy0J_gZSaBMzDf3pjTveD6xZzLlUck";

async function diagnoseCreateQuote() {
  const kp = Keypair.generate();
  const wallet = kp.publicKey.toBase58();
  console.log(`Using valid base58 wallet: ${wallet}`);

  const now = Math.floor(Date.now() / 1000);
  const startTime = now + 4200; // 70 minutes ahead (generous margin > 3600)
  const endTime = startTime + 86400; // 24 hours duration
  const resolutionTime = endTime + 7200; // 2 hours after end

  // Test Payload 1: Standard Market
  const standardPayload = {
    wallet,
    question: `Will Bitcoin exceed $120,000 before December ${Date.now() % 10000}?`,
    resolutionRule: "Resolves to YES if BTC/USDT price exceeds $120,000 on Binance prior to resolutionTime. Resolves to NO otherwise.",
    sourcesOfTruth: ["https://www.binance.com", "https://www.coingecko.com"],
    category: "crypto",
    startTime,
    endTime,
    resolutionTime,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/46/Bitcoin.svg",
  };

  // Test Payload 2: Breaking Market with eventInProgress
  const breakingPayload = {
    wallet,
    question: `Will Team Alpha win the championship match ${Date.now() % 10000}?`,
    resolutionRule: "Resolves to YES if Team Alpha wins the match officially. Resolves to NO otherwise.",
    sourcesOfTruth: ["https://www.espn.com"],
    category: "sports",
    marketType: "breaking",
    eventInProgress: true,
    startTime: now - 300, // started 5 mins ago
    endTime: now + 7200,   // ends in 2 hours
    resolutionTime: now + 10800,
    imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/46/Bitcoin.svg",
  };

  console.log("\n=======================================================");
  console.log("1. Testing against LIVE API (live-api.panta.market) with X-Api-Key");
  console.log("=======================================================");
  try {
    const res = await fetch(`${LIVE_URL}/markets/create/quote/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": TEST_API_KEY,
      },
      body: JSON.stringify(standardPayload),
    });
    console.log(`LIVE Standard Quote Status: ${res.status}`);
    const data = await res.json();
    console.log(`LIVE Standard Quote Response:`, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("LIVE Error:", e.message);
  }

  console.log("\n=======================================================");
  console.log("2. Testing against STAGING API (staging-api.panta.market) with X-Api-Key");
  console.log("=======================================================");
  try {
    const res = await fetch(`${STAGING_URL}/markets/create/quote/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": TEST_API_KEY,
      },
      body: JSON.stringify(standardPayload),
    });
    console.log(`STAGING Standard Quote Status: ${res.status}`);
    const data = await res.json();
    console.log(`STAGING Standard Quote Response:`, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("STAGING Error:", e.message);
  }

  console.log("\n=======================================================");
  console.log("3. Testing BREAKING Market (eventInProgress) on STAGING");
  console.log("=======================================================");
  try {
    const res = await fetch(`${STAGING_URL}/markets/create/quote/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": TEST_API_KEY,
      },
      body: JSON.stringify(breakingPayload),
    });
    console.log(`STAGING Breaking Quote Status: ${res.status}`);
    const data = await res.json();
    console.log(`STAGING Breaking Quote Response:`, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("STAGING Breaking Error:", e.message);
  }
}

diagnoseCreateQuote();
