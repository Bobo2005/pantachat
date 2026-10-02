const STAGING_URL = "https://staging-api.panta.market/api/v1";

async function testFullCreateQuote() {
  const reg = await (await fetch(`${STAGING_URL}/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `t_${Date.now()}@ex.com`, password: "Password123!" }),
  })).json();

  const token = reg.access;
  const dummyWallet = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

  const now = Math.floor(Date.now() / 1000);
  const startTime = now + 3700; // 3700s ahead of now (minimum 3600s)
  const endTime = startTime + 86400; // 24 hours after start
  const resolutionTime = endTime + 3600;

  const quotePayload = {
    wallet: dummyWallet,
    question: `Will Solana hit $300 before November ${Date.now() % 10000}?`,
    resolutionRule: "Resolves to YES if SOL/USDT reaches $300 on Binance before resolutionTime. NO otherwise.",
    sourcesOfTruth: ["https://coingecko.com", "https://binance.com"],
    category: "crypto",
    startTime,
    endTime,
    resolutionTime,
    imageUrl: "https://cryptologos.cc/logos/solana-sol-logo.png",
  };

  console.log("Submitting Create Quote with payload:", JSON.stringify(quotePayload, null, 2));
  const res = await fetch(`${STAGING_URL}/markets/create/quote/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(quotePayload),
  });

  console.log(`Create Quote Status: ${res.status}`);
  const data = await res.json();
  console.log("Create Quote Response:", JSON.stringify(data, null, 2));

  if (data.createId || data.id) {
    const createId = data.createId || data.id;
    console.log(`\nTesting POST /markets/create/build/ with createId: ${createId}...`);
    const buildRes = await fetch(`${STAGING_URL}/markets/create/build/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ createId, wallet: dummyWallet }),
    });
    console.log(`Create Build Status: ${buildRes.status}`);
    const buildData = await buildRes.json();
    console.log("Create Build Response Keys:", Object.keys(buildData));
    if (buildData.transaction) {
      console.log("Returned VersionedTransaction length:", buildData.transaction.length);
      console.log("Recent blockhash:", buildData.recentBlockhash);
    } else {
      console.log("Create Build Data:", buildData);
    }
  }
}

testFullCreateQuote();
