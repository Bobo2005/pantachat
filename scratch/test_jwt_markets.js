const STAGING_URL = "https://staging-api.panta.market/api/v1";

async function testWithJwt() {
  const testEmail = `pantachat_test_${Date.now()}@example.com`;
  const testPassword = `PantaPass2026!_${Math.random().toString(36).substring(2, 8)}`;

  console.log(`Registering ${testEmail}...`);
  const regRes = await fetch(`${STAGING_URL}/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail, password: testPassword }),
  });
  const data = await regRes.json();
  const accessToken = data.access;
  console.log(`Registered! Access token obtained.`);

  console.log("\n1. Testing GET /markets/ with JWT Bearer...");
  const mRes = await fetch(`${STAGING_URL}/markets/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  console.log(`GET /markets/ status: ${mRes.status}`);
  const markets = await mRes.json();
  console.log(`Markets count:`, Array.isArray(markets) ? markets.length : markets);

  if (Array.isArray(markets) && markets.length > 0) {
    console.log(`\nSample market:`, JSON.stringify(markets[0], null, 2));
  }
}

testWithJwt();
