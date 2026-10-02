const LIVE_URL = "https://live-api.panta.market/api/v1";
const TEST_API_KEY = "pk_test_cb0HDUB7P_RnUJy0J_gZSaBMzDf3pjTveD6xZzLlUck";
const wallet = "B5Bm5BgduGniRKMjAPSnQwxk1JoJAWJFHYYTNq6bpa4h";

async function testLiveCreateBuild() {
  console.log("Calling POST /markets/create/build/ on LIVE API with sandbox createId...");
  const res = await fetch(`${LIVE_URL}/markets/create/build/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": TEST_API_KEY,
    },
    body: JSON.stringify({
      createId: "cr_sandbox_test",
      wallet,
    }),
  });

  console.log(`Create Build Status: ${res.status}`);
  const data = await res.json();
  console.log("Create Build Response:", JSON.stringify(data, null, 2));
}

testLiveCreateBuild();
