const STAGING_URL = "https://staging-api.panta.market/api/v1";
const API_KEY = "pk_test_cb0HDUB7P_RnUJy0J_gZSaBMzDf3pjTveD6xZzLlUck";

async function probeApiKeyHeaders() {
  const variations = [
    { name: "Bearer", headers: { Authorization: `Bearer ${API_KEY}` } },
    { name: "Token", headers: { Authorization: `Token ${API_KEY}` } },
    { name: "ApiKey", headers: { Authorization: `ApiKey ${API_KEY}` } },
    { name: "Raw", headers: { Authorization: API_KEY } },
    { name: "X-API-Key", headers: { "X-API-Key": API_KEY } },
    { name: "x-api-key", headers: { "x-api-key": API_KEY } },
    { name: "Panta-Api-Key", headers: { "Panta-Api-Key": API_KEY } },
    { name: "panta-key", headers: { "panta-key": API_KEY } },
  ];

  for (const v of variations) {
    const res = await fetch(`${STAGING_URL}/markets/`, { headers: v.headers });
    const text = await res.text();
    console.log(`${v.name} -> Status ${res.status}:`, text.slice(0, 150));
    if (res.status === 200) {
      console.log(`\n🎉 SUCCESSFUL HEADER: ${v.name}`);
      break;
    }
  }
}

probeApiKeyHeaders();
