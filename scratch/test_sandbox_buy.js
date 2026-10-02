const LIVE_URL = "https://live-api.panta.market/api/v1";
const TEST_API_KEY = "pk_test_cb0HDUB7P_RnUJy0J_gZSaBMzDf3pjTveD6xZzLlUck";
const wallet = "B5Bm5BgduGniRKMjAPSnQwxk1JoJAWJFHYYTNq6bpa4h";

async function testSandboxBuyFlow() {
  console.log("1. Calling POST /primaryorderquote/ with sandbox test key on LIVE API...");
  const qRes = await fetch(`${LIVE_URL}/primaryorderquote/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": TEST_API_KEY,
    },
    body: JSON.stringify({
      wallet,
      marketId: "TestMarket1111111111111111111111111111111",
      side: "yes",
      amountUsdc: "10.00",
    }),
  });
  console.log(`Quote Status: ${qRes.status}`);
  const qData = await qRes.json();
  console.log("Quote Response:", JSON.stringify(qData, null, 2));

  if (qData.quoteId) {
    console.log(`\n2. Calling POST /primaryorderbuild/ with quoteId: ${qData.quoteId}...`);
    const bRes = await fetch(`${LIVE_URL}/primaryorderbuild/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": TEST_API_KEY,
      },
      body: JSON.stringify({
        quoteId: qData.quoteId,
        wallet,
      }),
    });
    console.log(`Build Status: ${bRes.status}`);
    const bData = await bRes.json();
    console.log("Build Response:", JSON.stringify(bData, null, 2));
  }
}

testSandboxBuyFlow();
