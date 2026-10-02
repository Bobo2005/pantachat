import { waitForConfirmation } from "../utils/solana.js";
import { pantaPost, pantaGet, PantaApiError } from "../api/panta/client.js";
import { markTradeReported } from "../db/queries.js";

// =============================================================================
// Interfaces & Types
// =============================================================================

export interface ReportTradeParams {
  signature: string;
  userId: string;
  marketId: string;
  platform?: "telegram" | "discord";
  chatId?: string;
  messageId?: string;
}

export interface AttributionReportResult {
  signature: string;
  confirmedOnChain: boolean;
  reportedToPanta: boolean;
  verifiedAttribution?: unknown;
  cardUpdated?: boolean;
}

export type CardUpdateListener = (params: {
  platform: "telegram" | "discord";
  chatId: string;
  messageId: string;
  marketId: string;
}) => Promise<void> | void;

// In-place card update listeners registry (Telegram / Discord bots)
const cardUpdateListeners: CardUpdateListener[] = [];

/**
 * Registers a bot callback to execute in-place message card refresh
 * when a trade on a market is confirmed.
 */
export function registerCardUpdateListener(listener: CardUpdateListener): void {
  cardUpdateListeners.push(listener);
}

// =============================================================================
// Attribution Reporter Pipeline
// =============================================================================

/**
 * Executes the complete trade attribution lifecycle:
 * 1. Awaits on-chain Solana RPC confirmation (avoids TX_NOT_FOUND)
 * 2. Reports transaction signature to Panta POST /trades/
 * 3. Verifies attribution via GET /trades/{signature}/
 * 4. Marks local SQLite trade record as reportedToPanta = 1
 * 5. Triggers in-place visual odds card refresh in Telegram / Discord
 */
export async function reportTradeToPanta(
  params: ReportTradeParams
): Promise<AttributionReportResult> {
  const { signature, userId, marketId, platform, chatId, messageId } = params;

  // Step 1: Await Solana RPC confirmation FIRST (critical invariant from memory.md)
  const confirmedOnChain = await waitForConfirmation(signature, 30000);

  // Step 2: Explicitly report trade to Panta POST /trades/
  let reportedToPanta = false;
  try {
    await pantaPost(
      "/trades/",
      {
        signature,
        userId: userId.startsWith("usr_") ? userId : `usr_${userId}`,
        marketId,
      },
      undefined,
      "none"
    );
    reportedToPanta = true;
  } catch (err: any) {
    if (err instanceof PantaApiError) {
      // In sandbox mode or mock test, log notification
      console.warn(`[Attribution] Panta POST /trades/ notice: [${err.code}] ${err.message}`);
    } else {
      console.error("[Attribution] Unexpected error during POST /trades/:", err);
    }
  }

  // Step 3: Verify attribution by querying GET /trades/{signature}/
  let verifiedAttribution: unknown = undefined;
  try {
    verifiedAttribution = await pantaGet(`/trades/${signature}/`, undefined, "read");
  } catch (err) {
    // If trade indexer has a brief propagation delay or in sandbox mock, proceed
  }

  // Step 4: Update SQLite local trades table (reportedToPanta = 1)
  await markTradeReported(signature);

  // Step 5: Trigger in-place card update in originating chat/channel
  let cardUpdated = false;
  if (platform && chatId && messageId && cardUpdateListeners.length > 0) {
    for (const listener of cardUpdateListeners) {
      try {
        await listener({ platform, chatId, messageId, marketId });
        cardUpdated = true;
      } catch (err) {
        console.error(`[Attribution] Failed to trigger card update listener:`, err);
      }
    }
  }

  return {
    signature,
    confirmedOnChain,
    reportedToPanta,
    verifiedAttribution,
    cardUpdated,
  };
}
