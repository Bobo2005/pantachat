import {
  generateProgressBar,
  buildMarketCardText,
  getPresetBuyButtons,
} from "../src/bot/common/card-builder.js";

async function main() {
  console.log("------------------------------------------------------------");
  console.log("🚀 Testing Prompt 11: Shared Card Builder & Odds Bar Generator");
  console.log("------------------------------------------------------------");

  // Step 1: Test Unicode Progress Bar Across Sentiment Spectrums
  console.log("1️⃣ Testing Unicode Progress Bar Generation...");
  const p0 = generateProgressBar(0);
  const p30 = generateProgressBar(30);
  const p68 = generateProgressBar(68);
  const p100 = generateProgressBar(100);

  console.log("   •   0% YES:", p0);
  console.log("   •  30% YES:", p30);
  console.log("   •  68% YES:", p68);
  console.log("   • 100% YES:", p100);

  if (p68 !== "[🟩🟩🟩🟩🟩🟩🟩🟥🟥🟥]") {
    throw new Error(`ProgressBar mismatch for 68%: got ${p68}`);
  }
  console.log("   ✅ Progress bar block calculations verified.");

  // Step 2: Test Market Card Text Layout
  console.log("\n2️⃣ Testing buildMarketCardText() Layout & Aesthetics...");
  const sampleMarket = {
    id: "mkt_sol_eth_flip",
    title: "Will Solana flip Ethereum in market cap before 2027?",
    category: "Crypto",
    phase: "primary",
    yesPrice: 0.68,
    noPrice: 0.32,
    volumeUsdc: 12450.0,
    cutoffAt: Date.now() + (28 * 24 + 14) * 3600 * 1000, // 28d 14h
    tradersCount: 42,
    creatorPlatformId: "solana_alpha",
  };

  const cardText = buildMarketCardText(sampleMarket);
  console.log("\n--- [ RENDERED TELEGRAM / DISCORD CARD PREVIEW ] ---");
  console.log(cardText);
  console.log("----------------------------------------------------");

  if (
    !cardText.includes("CRYPTO PREDICTION MARKET") ||
    !cardText.includes("🟢 YES 68%") ||
    !cardText.includes("• YES: *1.47x*") ||
    !cardText.includes("Non-Custodial")
  ) {
    throw new Error("❌ Card layout missing required section tokens!");
  }
  console.log("   ✅ Card text layout conforms to design-system.md specs.");

  // Step 3: Test Preset Buttons for Primary vs Secondary vs Resolved
  console.log("\n3️⃣ Testing Button Grid Generation Across Market Phases...");

  // Primary Phase
  const primaryButtons = getPresetBuyButtons("mkt_1", "primary");
  console.log("   • Primary Phase Button Rows:", primaryButtons.length);
  console.log("     Row 1:", primaryButtons[0].map((b) => b.text).join(" | "));
  console.log("     Row 2:", primaryButtons[1].map((b) => b.text).join(" | "));
  console.log("     Row 3:", primaryButtons[2].map((b) => b.text).join(" | "));

  if (primaryButtons[0][0].text !== "🟢 Buy YES $5" || primaryButtons[0][1].text !== "🟢 Buy YES $20") {
    throw new Error("❌ Primary buttons mismatch!");
  }

  // Secondary Phase (Graduated)
  const secondaryButtons = getPresetBuyButtons("mkt_1", "secondary");
  console.log("\n   • Secondary Phase Button Rows:", secondaryButtons.length);
  console.log("     Row 1:", secondaryButtons[0].map((b) => b.text).join(" | "));
  if (!secondaryButtons[0][0].text.includes("Trade on Panta Secondary")) {
    throw new Error("❌ Secondary market must display link-out to Panta Secondary!");
  }

  // Resolved Phase
  const resolvedButtons = getPresetBuyButtons("mkt_1", "resolved");
  console.log("\n   • Resolved Phase Button Rows:", resolvedButtons.length);
  console.log("     Row 1:", resolvedButtons[0].map((b) => b.text).join(" | "));
  if (!resolvedButtons[0][0].text.includes("Claim Winnings")) {
    throw new Error("❌ Resolved market must display Claim button!");
  }

  console.log("\n------------------------------------------------------------");
  console.log("🎉 ALL PROMPT 11 CARD BUILDER TESTS COMPLETED!");
  console.log("------------------------------------------------------------\n");
}

main().catch((err) => {
  console.error("❌ Test failed with error:", err);
  process.exit(1);
});
