const STAGING_URL = "https://staging-api.panta.market/api/v1";

async function probeQuoteParams() {
  const reg = await (await fetch(`${STAGING_URL}/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `t_${Date.now()}@ex.com`, password: "Password123!" }),
  })).json();

  const token = reg.access;
  const primaryMarketId = "dsaUrqmxNRtGeEhYZv4hPeWRKXQbVY6LcxgDrA6cUSe";
  const dummyWallet = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

  const variations = [
    { name: "amountUsdc number 5, side yes", body: { wallet: dummyWallet, marketId: primaryMarketId, side: "yes", amountUsdc: 5 } },
    { name: "amountUsdc string '5', side yes", body: { wallet: dummyWallet, marketId: primaryMarketId, side: "yes", amountUsdc: "5" } },
    { name: "amountUsdc string '5.00', side YES", body: { wallet: dummyWallet, marketId: primaryMarketId, side: "YES", amountUsdc: "5.00" } },
    { name: "amountUsdc base units 5000000, side yes", body: { wallet: dummyWallet, marketId: primaryMarketId, side: "yes", amountUsdc: 5000000 } },
    { name: "amountUsdc base units '5000000', side yes", body: { wallet: dummyWallet, marketId: primaryMarketId, side: "yes", amountUsdc: "5000000" } },
  ];

  for (const v of variations) {
    const res = await fetch(`${STAGING_URL}/primaryorderquote/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(v.body),
    });
    console.log(`${v.name} -> Status: ${res.status}:`, await res.text());
  }
}

probeQuoteParams();
