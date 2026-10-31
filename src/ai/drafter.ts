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
    .transform((t) => t.slice(0, 100)),
  description: z
    .string()
    .optional()
    .transform((d) => (d || "").slice(0, 500)),
  cutoffAt: z
    .string()
    .optional()
    .default(""),
  category: z.preprocess((val) => {
    if (typeof val === "string") {
      const formatted = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
      if (["Crypto", "Sports", "Tech", "Politics", "Culture", "Finance"].includes(formatted)) {
        return formatted;
      }
    }
    return "Crypto";
  }, z.enum([
    "Crypto",
    "Sports",
    "Tech",
    "Politics",
    "Culture",
    "Finance",
  ])),
  isAmbiguous: z.boolean().optional().default(false),
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

  const createParams: any = {
    model: config.ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: MARKET_DRAFTER_SYSTEM_PROMPT,
    messages,
    thinking: { type: "between_tools" },
  };

  let response: any;
  try {
    response = await anthropic.messages.create(createParams);
  } catch (err: any) {
    if (err?.message?.includes("thinking")) {
      delete createParams.thinking;
      response = await anthropic.messages.create(createParams);
    } else {
      throw err;
    }
  }

  const rawContent = (response.content as any[])
    .filter((block: any): block is Anthropic.TextBlock => block.type === "text")
    .map((block: any) => block.text)
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
