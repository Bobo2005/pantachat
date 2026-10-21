import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import axios from "axios";
import { config } from "../config.js";

// =============================================================================
// Zod Schema & Interfaces
// =============================================================================

export const oracleVerificationResultSchema = z.object({
  outcome: z.enum(["yes", "no", "void", "unresolved"]),
  confidence: z.number().min(0).max(1),
  evidenceUrl: z.string().min(1),
  evidenceSummary: z.string().min(1),
  isOfficialFinished: z.boolean(),
  reasoning: z.string().min(1),
});

export type OracleVerificationResult = z.infer<typeof oracleVerificationResultSchema>;

export interface MarketForResolution {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  cutoffAt?: string | number | null;
}

// =============================================================================
// Helper: Extract Source URL / API from Description
// =============================================================================

function extractUrlFromText(text?: string | null): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s)"]+/);
  return match ? match[0] : null;
}

/**
 * Attempts to query live crypto spot price if market is a crypto metric.
 */
async function fetchCryptoReferenceData(title: string): Promise<string | null> {
  try {
    const lower = title.toLowerCase();
    let coinId: string | null = null;
    if (lower.includes("sol") || lower.includes("solana")) coinId = "solana";
    else if (lower.includes("btc") || lower.includes("bitcoin")) coinId = "bitcoin";
    else if (lower.includes("eth") || lower.includes("ethereum")) coinId = "ethereum";

    if (!coinId) return null;

    const res = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      { timeout: 4000 }
    );
    const price = res.data?.[coinId]?.usd;
    if (typeof price === "number") {
      return `CoinGecko live spot price for ${coinId.toUpperCase()}: $${price.toLocaleString()} USD (https://www.coingecko.com/en/coins/${coinId})`;
    }
  } catch (err: any) {
    // Non-blocking fallback
  }
  return null;
}

// =============================================================================
// System Prompt for Deterministic Fact Verification
// =============================================================================

const ORACLE_SYSTEM_PROMPT = `You are the PantaChat Autonomous AI Resolution Oracle.
Your mission is to objectively, impartially, and deterministically determine the real-world outcome of a prediction market.

CRITICAL RULES:
1. EVIDENCE-FIRST: You must base your determination STRICTLY on factual, verifiable outcomes from official authorities (official match reports, government/regulatory filings, CoinGecko/CoinMarketCap for crypto, official organization announcements).
2. NEVER GUESS OR HALLUCINATE: If the event has not yet completely concluded, or if official results are not yet posted or confirmed, "isOfficialFinished" MUST be false and "outcome" MUST be "unresolved".
3. MINIMUM 95% CONFIDENCE: You can ONLY resolve "yes" or "no" if you are at least 95% certain (confidence >= 0.95) based on indisputable evidence.
4. VOID / REFUND: If the event was canceled, postponed indefinitely, permanently abandoned, or the question was impossible to evaluate per official rules, output "void".
5. OUTPUT FORMAT: Respond ONLY with a valid JSON object matching the exact schema. No markdown formatting, no code blocks, no backticks, no extra text.

JSON Schema:
{
  "outcome": "yes" | "no" | "void" | "unresolved",
  "confidence": 0.98,
  "evidenceUrl": "https://...",
  "evidenceSummary": "Concise proof snippet (e.g., Final score Arsenal 2 - 1 Chelsea, Premier League official match sheet)",
  "isOfficialFinished": true,
  "reasoning": "Step-by-step logic explaining why outcome matches resolution criteria"
}`;

// =============================================================================
// AI Oracle Verification Core Engine
// =============================================================================

export async function verifyMarketOutcome(
  market: MarketForResolution
): Promise<OracleVerificationResult> {
  const cutoffIso = market.cutoffAt
    ? typeof market.cutoffAt === "number"
      ? new Date(market.cutoffAt < 10000000000 ? market.cutoffAt * 1000 : market.cutoffAt).toISOString()
      : new Date(market.cutoffAt).toISOString()
    : "Not specified";

  const currentIso = new Date().toISOString();
  const directUrl = extractUrlFromText(market.description);
  const cryptoContext = await fetchCryptoReferenceData(market.title);

  const promptContent = [
    `Current Timestamp: ${currentIso}`,
    `Market ID: ${market.id}`,
    `Market Title: "${market.title}"`,
    `Category: ${market.category || "General"}`,
    `Cutoff / End Time: ${cutoffIso}`,
    `Resolution Rules & Description:\n${market.description || "Resolves according to official consensus rules."}`,
    directUrl ? `Reference Source URL in description: ${directUrl}` : null,
    cryptoContext ? `Live Reference Data: ${cryptoContext}` : null,
    `\nDetermine whether this market has officially concluded and what the true outcome is ("yes", "no", "void", or "unresolved"). Remember: confidence < 0.95 or unfinished events MUST be "unresolved".`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const client = new Anthropic({
      apiKey: config.ANTHROPIC_API_KEY,
    });

    let response;
    try {
      response = await client.messages.create({
        model: config.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        temperature: 0.0, // Strictly deterministic facts
        max_tokens: 600,
        system: ORACLE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: promptContent }],
      });
    } catch (createErr: any) {
      if (createErr.message?.includes("temperature")) {
        response = await client.messages.create({
          model: config.ANTHROPIC_MODEL || "claude-sonnet-5-5",
          max_tokens: 600,
          system: ORACLE_SYSTEM_PROMPT,
          messages: [{ role: "user", content: promptContent }],
        });
      } else {
        throw createErr;
      }
    }

    const rawBlock = response.content?.[0];
    const rawText = rawBlock && "text" in rawBlock ? rawBlock.text.trim() : "";
    const cleanJson = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

    const parsed = JSON.parse(cleanJson);
    const validated = oracleVerificationResultSchema.parse(parsed);

    // Enforce strict Guardrail
    if (validated.confidence < 0.95 || !validated.isOfficialFinished) {
      return {
        outcome: "unresolved",
        confidence: validated.confidence,
        evidenceUrl: validated.evidenceUrl || directUrl || "https://pantachat.market",
        evidenceSummary: validated.evidenceSummary || "Event has not concluded or lacks official confirmation.",
        isOfficialFinished: false,
        reasoning: validated.reasoning || "Outcome remains unresolved awaiting official confirmation.",
      };
    }

    return validated;
  } catch (err: any) {
    console.warn(`[AI Oracle] Verification skipped or fallback for market ${market.id}:`, err.message);

    // Fallback safe evaluation if Anthropic or network fails
    return {
      outcome: "unresolved",
      confidence: 0,
      evidenceUrl: directUrl || "https://pantachat.market",
      evidenceSummary: "Automated oracle could not confirm authoritative result.",
      isOfficialFinished: false,
      reasoning: `Resolution check paused due to verification service status: ${err.message}`,
    };
  }
}
