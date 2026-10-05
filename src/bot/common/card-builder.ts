import { formatUsdc } from "../../utils/formatters.js";
import { config } from "../../config.js";

// =============================================================================
// Interfaces & Types
// =============================================================================

export interface MarketData {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  phase?: "primary" | "secondary" | "resolved" | string;
  yesPrice: number;
  noPrice: number;
  volumeUsdc?: number;
  liquidityUsdc?: number;
  cutoffAt?: string | number | null;
  tradersCount?: number;
  creatorPlatformId?: string | null;
  resolvedOutcome?: "yes" | "no" | null;
}

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

// =============================================================================
// Unicode Progress Bar Generator
// =============================================================================

/**
 * Generates high-contrast visual Unicode odds bar (🟩 YES vs 🟥 NO).
 * Example: 64% YES -> "[🟩🟩🟩🟩🟩🟩🟥🟥🟥🟥]"
 *
 * @param yesPercent Number from 0 to 100
 * @param totalBlocks Total block count (default: 10)
 */
export function generateProgressBar(yesPercent: number, totalBlocks = 10): string {
  const clamped = Math.max(0, Math.min(100, Math.round(yesPercent)));
  const greenCount = Math.round((clamped / 100) * totalBlocks);
  const redCount = totalBlocks - greenCount;
  return `[${"🟩".repeat(greenCount)}${"🟥".repeat(redCount)}]`;
}

// =============================================================================
// Time Remaining Formatter
// =============================================================================

export function formatTimeRemaining(cutoffAt?: string | number | null): string {
  if (!cutoffAt) return "Open";

  const cutoffMs =
    typeof cutoffAt === "number"
      ? cutoffAt < 10000000000
        ? cutoffAt * 1000
        : cutoffAt
      : new Date(cutoffAt).getTime();

  const diffMs = cutoffMs - Date.now();
  if (diffMs <= 0) return "Closed";

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// =============================================================================
// Market Card Text Builder
// =============================================================================

/**
 * Builds slick, rich visual prediction market card text for Telegram and Discord.
 * Adheres strictly to design-system.md Section 3 layout.
 */
export function buildMarketCardText(market: MarketData): string {
  const categoryHeader = (market.category || "CRYPTO").toUpperCase();
  const yesPrice = Number(market.yesPrice) || 0.5;
  const noPrice = Number(market.noPrice) || 0.5;

  const total = yesPrice + noPrice;
  const yesProb = total > 0 ? yesPrice / total : 0.5;
  const noProb = total > 0 ? noPrice / total : 0.5;

  const yesPercent = Math.round(yesProb * 100);
  const noPercent = 100 - yesPercent;

  const progressBar = generateProgressBar(yesPercent, 10);

  // Multipliers & Potential Gains
  const yesMultiplier = yesPrice > 0 ? (1 / yesPrice).toFixed(2) : "0.00";
  const noMultiplier = noPrice > 0 ? (1 / noPrice).toFixed(2) : "0.00";
  const yesGain = yesPrice > 0 ? Math.max(0, Math.round(((1 / yesPrice) - 1) * 100)) : 0;
  const noGain = noPrice > 0 ? Math.max(0, Math.round(((1 / noPrice) - 1) * 100)) : 0;

  // Status Badge
  let statusBadge = "🟢 Live Primary Curve";
  if (market.phase === "secondary") {
    statusBadge = "🟣 Graduated Secondary";
  } else if (market.phase === "resolved") {
    statusBadge = `⚪ Resolved (${(market.resolvedOutcome || "FINAL").toUpperCase()})`;
  }

  const volumeStr = formatUsdc(market.volumeUsdc || 0);
  const endsStr = formatTimeRemaining(market.cutoffAt);
  const tradersCount = market.tradersCount ?? 1;

  const creatorStr = market.creatorPlatformId
    ? market.creatorPlatformId.startsWith("@")
      ? market.creatorPlatformId
      : `@${market.creatorPlatformId}`
    : "Community";

  const modeBadge = config.IS_TEST ? "🧪 Test Sandbox (Devnet)" : "Live Mainnet";

  return [
    `🔥 *${categoryHeader} PREDICTION MARKET*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `*${market.title}*`,
    ``,
    `📊 *Current Sentiment:*`,
    `🟢 YES ${yesPercent}%  \`${progressBar}\`  ${noPercent}% NO 🔴`,
    ``,
    `💰 *Est. Win Multipliers (Mark-to-Market):*`,
    `• YES: *${yesMultiplier}x* (+${yesGain}%) (Spot: $${yesPrice.toFixed(2)})`,
    `• NO:  *${noMultiplier}x* (+${noGain}%) (Spot: $${noPrice.toFixed(2)})`,
    ``,
    `📈 *Market Stats:*`,
    `Volume: *${volumeStr}* • Traders: *${tradersCount}* • Ends: *${endsStr}*`,
    `Creator: *${creatorStr}* • Status: *${statusBadge}*`,
    `Mode: *${modeBadge}*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `⚡ *Powered by Panta • Non-Custodial*`,
  ].join("\n");
}

// =============================================================================
// Preset Button Payloads
// =============================================================================

/**
 * Returns cross-platform button rows for market cards.
 * If market has graduated to secondary trading, displays link to Panta secondary.
 *
 * @param marketId Market ID
 * @param phase Market phase ("primary" | "secondary" | "resolved")
 */
export function getPresetBuyButtons(
  marketId: string,
  phase: "primary" | "secondary" | "resolved" | string = "primary"
): InlineButton[][] {
  // If graduated to secondary, return link out (memory.md invariant)
  if (phase === "secondary") {
    return [
      [
        {
          text: "🌐 Trade on Panta Secondary",
          url: `https://panta.market/market/${marketId}`,
        },
      ],
      [
        { text: "🔄 Refresh Odds", callback_data: `refresh_${marketId}` },
        { text: "📊 Details", callback_data: `details_${marketId}` },
      ],
    ];
  }

  // If resolved, return Claim button
  if (phase === "resolved") {
    return [
      [
        {
          text: "💰 Claim Winnings",
          url: `${config.WEBAPP_URL}/positions`,
        },
      ],
      [
        { text: "🔄 Refresh Card", callback_data: `refresh_${marketId}` },
        { text: "📊 Details", callback_data: `details_${marketId}` },
      ],
    ];
  }

  // Standard Primary Bonding Curve Preset Buttons
  return [
    [
      { text: "🟢 Buy YES $5", callback_data: `buy_${marketId}_yes_5` },
      { text: "🟢 Buy YES $20", callback_data: `buy_${marketId}_yes_20` },
    ],
    [
      { text: "🔴 Buy NO $5", callback_data: `buy_${marketId}_no_5` },
      { text: "🔴 Buy NO $20", callback_data: `buy_${marketId}_no_20` },
    ],
    [
      { text: "⚙️ Custom Amount", callback_data: `buy_${marketId}_custom` },
      { text: "🔄 Refresh Odds", callback_data: `refresh_${marketId}` },
    ],
    [
      { text: "📊 Market Details", callback_data: `details_${marketId}` },
      { text: "💧 Get Demo Funds", url: `${config.WEBAPP_URL}/?faucet=true` },
    ],
  ];
}
