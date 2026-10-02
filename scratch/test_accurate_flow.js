import { Connection } from "@solana/web3.js";

const STAGING_URL = "https://staging-api.panta.market/api/v1";
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

async function testAccuratePrimaryFlow() {
  // 1. Fresh register
  const testEmail = `pantachat_real_${Date.now()}@example.com`;
  const testPassword = `PantaPass2026!_${Math.random().toString(36).substring(2, 8)}`;

  const regRes = await fetch(`${STAGING_URL}/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const authData = await regRes.json();
  const accessToken = authData.access;
  const dummyWallet = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
  const primaryMarketId = "dsaUrqmxNRtGeEhYZv4hPeWRKXQbVY6LcxgDrA6cUSe";

  console.log(`1. Requesting quote with { wallet, side: 'yes', amountUsdc: '5.00' }...`);
  const qRes = await fetch(`${STAGING_URL}/primaryorderquote/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      marketId: primaryMarketId,
      wallet: dummyWallet,
      side: "yes",
      amountUsdc: "5.00",
    }),
  });
  console.log(`Quote status: ${qRes.status}`);
  const qData = await qRes.json();
  console.log(`Quote data:`, JSON.stringify(qData, null, 2));

  if (qData.quoteId || qData.id) {
    const quoteId = qData.quoteId || qData.id;
    console.log(`\n2. Requesting build with quoteId: ${quoteId}...`);
    const bRes = await fetch(`${STAGING_URL}/primaryorderbuild/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        quoteId,
        wallet: dummyWallet,
      }),
    });
    console.log(`Build status: ${bRes.status}`);
    const bData = await bRes.json();
    console.log(`Build data:`, JSON.stringify(bData, null, 2));
  }
}

testAccuratePrimaryFlow();
