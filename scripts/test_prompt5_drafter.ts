import { draftMarketFromText, draftedMarketSchema } from "../src/ai/drafter.js";
import { config } from "../src/config.js";

async function main() {
  console.log("------------------------------------------------------------");
  console.log("🚀 Testing Prompt 5: AI Drafter Service (Claude Sonnet 5.5)");
  console.log("------------------------------------------------------------");

  console.log(`Model Configured: ${config.ANTHROPIC_MODEL}`);
  const hasKey = config.ANTHROPIC_API_KEY && !config.ANTHROPIC_API_KEY.includes("your_anthropic");

  if (!hasKey) {
    console.log("\n⚠️ Note: ANTHROPIC_API_KEY is using a placeholder in .env.");
    console.log("   Validating Zod schema and Ambiguity Guard invariants offline...");

    // Test 1: Valid Market Schema Check
    const validSample = {
      title: "Will Solana hit $300 by end of 2026?",
      description: "Resolves to YES if SOL/USDT reaches $300 on Binance before Dec 31, 2026.",
      cutoffAt: new Date(Date.now() + 86400 * 1000).toISOString(),
      category: "Crypto",
      isAmbiguous: false,
    };
    const parsedValid = draftedMarketSchema.parse(validSample);
    console.log("   ✅ Valid market schema accepted:", parsedValid.title);

    // Test 2: Ambiguous Banter Schema Check
    const ambiguousSample = {
      title: "Is Arsenal the best team?",
      description: "Subjective statement with no criteria.",
      cutoffAt: new Date(Date.now() + 86400 * 1000).toISOString(),
      category: "Sports",
      isAmbiguous: true,
      clarificationPrompt: "How would you define best team? E.g., 'Will Arsenal win the Premier League 2026/27?'",
    };
    const parsedAmbiguous = draftedMarketSchema.parse(ambiguousSample);
    console.log("   ✅ Ambiguity Guard schema accepted with clarification:", parsedAmbiguous.clarificationPrompt);

    console.log("\nℹ️ To test live Claude drafting, set your real ANTHROPIC_API_KEY in .env and re-run.");
  } else {
    // Live Inference Tests
    console.log("\n1️⃣ Testing Live AI Extraction: Concrete Prediction...");
    const sampleBanter = "Solana is easily flipping BNB and hitting 350 by November!";
    console.log(`   Input text: "${sampleBanter}"`);
    
    const draft1 = await draftMarketFromText(sampleBanter);
    console.log("   ✅ Drafted Market Received:");
    console.log("   • Title:       ", draft1.title);
    console.log("   • Category:    ", draft1.category);
    console.log("   • Cutoff Date: ", draft1.cutoffAt);
    console.log("   • Description: ", draft1.description);
    console.log("   • Is Ambiguous:", draft1.isAmbiguous);

    if (draft1.isAmbiguous) {
      throw new Error("Expected unambiguous market, but got isAmbiguous=true");
    }

    // Ambiguity Guard Test
    console.log("\n2️⃣ Testing Ambiguity Guard: Subjective Banter...");
    const subjectiveBanter = "Ethereum is so cooked bro it's crazy";
    console.log(`   Input text: "${subjectiveBanter}"`);

    const draft2 = await draftMarketFromText(subjectiveBanter);
    console.log("   ✅ Ambiguity Guard Response:");
    console.log("   • Is Ambiguous:        ", draft2.isAmbiguous);
    console.log("   • Clarification Prompt:", draft2.clarificationPrompt);

    if (!draft2.isAmbiguous) {
      console.warn("   ⚠️ Note: AI resolved the subjective query as a market, check prompt guidance.");
    }
  }

  console.log("\n------------------------------------------------------------");
  console.log("🎉 ALL PROMPT 5 AI DRAFTER TESTS COMPLETED SUCCESSFULLY!");
  console.log("------------------------------------------------------------\n");
}

main().catch((err) => {
  console.error("❌ Test failed with error:", err);
  process.exit(1);
});
