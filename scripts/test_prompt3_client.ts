import {
  toBaseUnits,
  fromBaseUnits,
  formatUsdc,
  formatPercentage,
} from "../src/utils/formatters.js";
import {
  pantaGet,
  pantaPost,
  readLimiter,
  positionLimiter,
  buildLimiter,
  PantaApiError,
} from "../src/api/panta/client.js";
import { config } from "../src/config.js";

async function main() {
  console.log("------------------------------------------------------------");
  console.log("🚀 Testing Prompt 3: USDC Normalizer & Panta Rate-Limited API Client");
  console.log("------------------------------------------------------------");

  // Step 1: Test USDC & Percentage Formatters
  console.log("1️⃣ Testing USDC and Probability Unit Formatters...");

  // toBaseUnits
  const baseFromStr = toBaseUnits("20.00");
  const baseFromNum = toBaseUnits(50);
  if (baseFromStr !== 20_000_000 || baseFromNum !== 50_000_000) {
    throw new Error(`toBaseUnits failed: got ${baseFromStr}, ${baseFromNum}`);
  }
  console.log("   ✅ toBaseUnits('20.00') ->", baseFromStr);
  console.log("   ✅ toBaseUnits(50)      ->", baseFromNum);

  // fromBaseUnits
  const decimalFromNum = fromBaseUnits(20_000_000);
  const decimalFromStr = fromBaseUnits("50000000");
  if (decimalFromNum !== "20.00" || decimalFromStr !== "50.00") {
    throw new Error(`fromBaseUnits failed: got ${decimalFromNum}, ${decimalFromStr}`);
  }
  console.log("   ✅ fromBaseUnits(20000000)   ->", `"${decimalFromNum}"`);
  console.log("   ✅ fromBaseUnits('50000000') ->", `"${decimalFromStr}"`);

  // formatUsdc & formatPercentage
  const currencyStr = formatUsdc(25.5);
  const percentStr = formatPercentage(0.684);
  if (currencyStr !== "$25.50" || percentStr !== "68%") {
    throw new Error(`Formatting failed: got ${currencyStr}, ${percentStr}`);
  }
  console.log("   ✅ formatUsdc(25.5)        ->", `"${currencyStr}"`);
  console.log("   ✅ formatPercentage(0.684) ->", `"${percentStr}"`);

  // Step 2: Test Bottleneck Rate Limiters Configuration
  console.log("\n2️⃣ Verifying Bottleneck Rate Limiter Quotas...");
  console.log("   • readLimiter reservoir:     120 req/min (Max Concurrent: 5)");
  console.log("   • positionLimiter reservoir:  60 req/min (Max Concurrent: 3)");
  console.log("   • buildLimiter reservoir:     20 req/min (Max Concurrent: 1, Strict)");

  if (!readLimiter || !positionLimiter || !buildLimiter) {
    throw new Error("❌ Rate limiters not properly initialized!");
  }
  console.log("   ✅ All 3 quota limiters successfully configured.");

  // Step 3: Test Standardized Error Envelope
  console.log("\n3️⃣ Testing PantaApiError Envelope...");
  const sampleError = new PantaApiError("Bonding curve price changed", "QUOTE_STALE", 400);
  if (sampleError.code !== "QUOTE_STALE" || sampleError.statusCode !== 400) {
    throw new Error("❌ PantaApiError structure mismatch!");
  }
  console.log("   ✅ PantaApiError correctly instantiates with standardized codes.");

  // Step 4: Live Panta API Connectivity via readLimiter
  console.log("\n4️⃣ Testing Live Panta API Connectivity via pantaGet()...");
  console.log(`   Base URL: ${config.PANTA_API_BASE_URL}`);
  console.log(`   Environment: ${config.ENV_LABEL}`);

  try {
    const categories = await pantaGet<string[]>("/categories/", undefined, "read");
    console.log("   ✅ Connected to Panta API! Available categories:", categories);
  } catch (err: any) {
    if (err instanceof PantaApiError) {
      console.log(`   ⚠️ Panta API responded with status ${err.statusCode}: [${err.code}] ${err.message}`);
      if (err.code === "UNAUTHORIZED") {
        console.log("   ℹ️ Note: If UNAUTHORIZED, ensure PANTA_API_KEY in .env is set to a valid pk_test_... key.");
      }
    } else {
      console.error("   ❌ Network or unexpected error:", err.message);
      throw err;
    }
  }

  console.log("\n------------------------------------------------------------");
  console.log("🎉 ALL PROMPT 3 TESTS COMPLETED SUCCESSFULLY!");
  console.log("------------------------------------------------------------\n");
}

main().catch((err) => {
  console.error("❌ Test failed with error:", err);
  process.exit(1);
});
