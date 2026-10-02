const STAGING_URL = "https://staging-api.panta.market/api/v1";

async function probeCreateMarket() {
  const reg = await (await fetch(`${STAGING_URL}/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `t_${Date.now()}@ex.com`, password: "Password123!" }),
  })).json();

  const token = reg.access;
  const dummyWallet = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

  // Check required fields for POST /markets/create/quote/
  console.log("1. Probing POST /markets/create/quote/ fields...");
  const quoteFieldsRes = await fetch(`${STAGING_URL}/markets/create/quote/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  console.log("Create Quote required fields:", await quoteFieldsRes.text());

  // Check required fields for POST /markets/create/build/
  console.log("\n2. Probing POST /markets/create/build/ fields...");
  const buildFieldsRes = await fetch(`${STAGING_URL}/markets/create/build/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  console.log("Create Build required fields:", await buildFieldsRes.text());
}

probeCreateMarket();
