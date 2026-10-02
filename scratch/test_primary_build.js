import { Connection } from "@solana/web3.js";

const STAGING_URL = "https://staging-api.panta.market/api/v1";
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

async function testPrimaryBuild() {
  // 1. Register & get fresh JWT
  const testEmail = `pantachat_build_${Date.now()}@example.com`;
  const testPassword = `PantaPass2026!_${Math.random().toString(36).substring(2, 8)}`;

  console.log(`Registering ${testEmail}...`);
  const regRes = await fetch(`${STAGING_URL}/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const authData = await regRes.json();
  const accessToken = authData.access;
  const userId = authData.userId;
  console.log(`Auth success. User ID: ${userId}`);

  // 2. Fetch single market details for primary market
  const primaryMarketId = "dsaUrqmxNRtGeEhYZv4hPeWRKXQbVY6LcxgDrA6cUSe";
  console.log(`\nFetching detail for primary market: ${primaryMarketId}...`);
  const mRes = await fetch(`${STAGING_URL}/markets/${primaryMarketId}/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  console.log(`Market detail status: ${mRes.status}`);
  const mData = await mRes.json();
  console.log(`Market detail:`, mData);

  // 3. Test primary order quote
  console.log(`\nTesting POST /primaryorderquote/...`);
  const qRes = await fetch(`${STAGING_URL}/primaryorderquote/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      marketId: primaryMarketId,
      outcome: "yes",
      spendUsdc: "10.00",
    }),
  });
  console.log(`Quote status: ${qRes.status}`);
  const qData = await qRes.json();
  console.log(`Quote response:`, qData);

  // 4. Test primary order build
  const dummyWallet = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
  console.log(`\nTesting POST /primaryorderbuild/...`);
  const bRes = await fetch(`${STAGING_URL}/primaryorderbuild/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      marketId: primaryMarketId,
      outcome: "yes",
      spendUsdc: "10.00",
      buyerWallet: dummyWallet,
      userId: userId,
      maxSlippageBps: 300,
    }),
  });
  console.log(`Build status: ${bRes.status}`);
  const bData = await bRes.json();
  console.log(`Build response:`, bData);

  if (bData.transaction) {
    console.log(`\n5. Deserializing VersionedTransaction and checking blockhash on Solana Devnet...`);
    const txBuf = Buffer.from(bData.transaction, "base64");
    // Check blockhash validity on devnet
    if (bData.recentBlockhash) {
      console.log(`Recent blockhash: ${bData.recentBlockhash}`);
      const isValid = await connection.isBlockhashValid(bData.recentBlockhash);
      console.log(`Is blockhash valid on Solana Devnet? ->`, isValid.value);
    }
  }
}

testPrimaryBuild();
