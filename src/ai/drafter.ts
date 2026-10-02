import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { config } from "../config.js";
import { MARKET_DRAFTER_SYSTEM_PROMPT, FEW_SHOT_EXAMPLES } from "./prompts.js";

// =============================================================================
// Zod Schema & Types
// =============================================================================

export const draftedMarketSchema = z.object({
  title: z
    .string()
    .min(1, "Title cannot be empty")
    .max(100, "Title must be 100 characters or less"),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less"),
  cutoffAt: z
    .string()
    .min(1, "cutoffAt cannot be empty"),
  category: z.enum([
    "Crypto",
    "Sports",
    "Tech",
    "Politics",
    "Culture",
    "Finance",
  ]),
  isAmbiguous: z.boolean(),
  clarificationPrompt: z.string().optional(),
});

export type DraftedMarket = z.infer<typeof draftedMarketSchema>;

// Initialize Anthropic SDK client
export const anthropic = new Anthropic({
  apiKey: config.ANTHROPIC_API_KEY,
});

/**
 * Converts conversational chat banter into a structured Panta prediction market.
 * Enforces Ambiguity Guard and minimum 30-minute cutoff rules.
 *
 * @param banterText The main message or reply being turned into a market
 * @param contextMessages Surrounding chat messages for additional conversational context
 */
export async function draftMarketFromText(
  banterText: string,
  contextMessages: string[] = []
): Promise<DraftedMarket> {
  const currentTimeIso = new Date().toISOString();

  let userPrompt = `Current Time: ${currentTimeIso}\nTarget Banter: "${banterText}"`;
  if (contextMessages.length > 0) {
    userPrompt += `\nSurrounding Chat Context:\n${contextMessages.map((m, i) => `${i + 1}. "${m}"`).join("\n")}`;
  }

  const messages: Anthropic.MessageParam[] = [
    ...FEW_SHOT_EXAMPLES.map((ex) => ({
      role: ex.role,
      content: ex.content,
    })),
    {
      role: "user",
      content: userPrompt,
    },
  ];

  const response = await anthropic.messages.create({
    model: config.ANTHROPIC_MODEL,
    max_tokens: 1024,
    system: MARKET_DRAFTER_SYSTEM_PROMPT,
    messages,
  });

  const rawContent = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  // Extract JSON object safely even if surrounded by commentary or markdown fences
  const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
  const cleanJson = jsonMatch ? jsonMatch[0] : rawContent;

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    throw new Error(`Failed to parse Claude market drafter response as JSON: ${rawContent}`);
  }

  const validated = draftedMarketSchema.parse(parsed);

  // Ambiguity Guard handling
  if (validated.isAmbiguous) {
    if (!validated.clarificationPrompt) {
      validated.clarificationPrompt =
        "This claim is a bit ambiguous or subjective! Could you specify an exact metric, outcome source, or target resolution date?";
    }
    return validated;
  }

  // Ensure cutoff is at least 30 minutes in the future (memory.md strict invariant)
  const minAllowedCutoffMs = Date.now() + 30 * 60 * 1000;
  const cutoffTimeMs = new Date(validated.cutoffAt).getTime();

  if (isNaN(cutoffTimeMs) || cutoffTimeMs < minAllowedCutoffMs) {
    // Fall back to 24 hours in the future if invalid or too close
    validated.cutoffAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }

  return validated;
}
