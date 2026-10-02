import { Keypair } from "@solana/web3.js";

async function testLiveApiCreateQuote() {
  const LIVE_URL = "https://live-api.panta.market/api/v1";
  
  // Register on live
  const email = `pantachat_live_${Date.now()}@example.com`;
  const password = `PantaLive2026!_${Math.random().toString(36).substring(2, 8)}`;
  
  console.log(`1. Registering on LIVE api: ${email}...`);
  const regRes = await fetch(`${LIVE_URL}/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  console.log(`Live register status: ${regRes.status}`);
  const regData = await regRes.json();
  const token = regData.access;

  const kp = Keypair.generate();
  const walletPubkey = kp.publicKey.toBase58();

  const now = Math.floor(Date.now() / 1000);
  const startTime = now + 3700;
  const endTime = startTime + 86400;
  const resolutionTime = endTime + 3600;

  const payload = {
    wallet: walletPubkey,
    question: `Will Solana hit $400 by end of next quarter test ${Date.now()}?`,
    resolutionRule: "Resolves to YES if SOL/USDT reaches $400 on Binance before resolutionTime. NO otherwise.",
    sourcesOfTruth: ["https://coingecko.com"],
    category: "crypto",
    startTime,
    endTime,
    resolutionTime,
    imageUrl: "https://cryptologos.cc/logos/solana-sol-logo.png",
  };

  console.log("2. Submitting create quote to LIVE api...");
  const res = await fetch(`${LIVE_URL}/markets/create/quote/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  console.log(`Live Create Quote Status: ${res.status}`);
  const data = await res.json();
  console.log("Live Create Quote Response:", JSON.stringify(data, null, 2));
}

testLiveApiCreateQuote();
