import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { type MarketData, generateProgressBar } from "../common/card-builder.js";
import { formatUsdc, isCutoffExpired } from "../../utils/formatters.js";
import { config } from "../../config.js";

// =============================================================================
// Color & Icon Helpers
// =============================================================================

/**
 * Maps market phase to high-contrast brand color tokens:
 * - Green (#10B981): Primary Bonding Curve
 * - Purple (#9945FF): Graduated Secondary Market
 * - Grey/Slate (#64748B): Resolved
 */
export function getMarketEmbedColor(phase?: string | null, isExpired?: boolean): number {
  if (phase === "secondary") return 0x9945FF;
  if (phase === "resolved") return 0x64748B;
  if (isExpired) return 0xF59E0B; // Amber for expired / awaiting resolution
  return 0x10B981;
}

/**
 * Returns a thematic emoji icon based on market category.
 */
export function getCategoryIcon(category?: string | null): string {
  const cat = (category || "").toLowerCase();
  if (cat.includes("crypto") || cat.includes("solana") || cat.includes("btc")) return "⚡";
  if (cat.includes("sport") || cat.includes("football") || cat.includes("soccer")) return "⚽";
  if (cat.includes("game") || cat.includes("esport")) return "🎮";
  if (cat.includes("politic") || cat.includes("election")) return "🗳️";
  if (cat.includes("finance") || cat.includes("stock") || cat.includes("market")) return "📈";
  if (cat.includes("tech") || cat.includes("ai")) return "🤖";
  if (cat.includes("pop") || cat.includes("culture") || cat.includes("music")) return "🎭";
  return "🔥";
}

// =============================================================================
// Build Discord Market Embed & Action Rows
// =============================================================================

export interface DiscordMarketCardResult {
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
}

export function buildDiscordMarketCard(market: MarketData): DiscordMarketCardResult {
  const icon = getCategoryIcon(market.category);
  const isExpired = !market.resolvedOutcome && market.phase !== "resolved" && isCutoffExpired(market.cutoffAt);
  const color = getMarketEmbedColor(market.phase, isExpired);

  const yesPrice = Number(market.yesPrice) || 0.5;
  const noPrice = Number(market.noPrice) || 0.5;
  const total = yesPrice + noPrice;
  const yesProb = total > 0 ? yesPrice / total : 0.5;
  const yesPercent = Math.round(yesProb * 100);
  const noPercent = 100 - yesPercent;

  const progressBar = generateProgressBar(yesPercent, 10);

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
  } else if (isExpired) {
    statusBadge = "⏳ Trading Closed (Awaiting Resolution)";
  }

  // Relative Timestamp formatting
  let cutoffTimestamp = "Open";
  if (market.cutoffAt) {
    const cutoffMs =
      typeof market.cutoffAt === "number"
        ? market.cutoffAt < 10000000000
          ? market.cutoffAt * 1000
          : market.cutoffAt
        : new Date(market.cutoffAt).getTime();
    const cutoffUnix = Math.floor(cutoffMs / 1000);
    cutoffTimestamp = `<t:${cutoffUnix}:R> (<t:${cutoffUnix}:f>)`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${icon} ${market.title}`)
    .setColor(color)
    .setFooter({ text: "⚡ Powered by Panta • Non-Custodial" })
    .setTimestamp();

  if (market.description) {
    embed.setDescription(market.description);
  }

  embed.addFields(
    {
      name: "📊 Sentiment & Odds",
      value: `\`${progressBar}\`\n🟢 **YES ${yesPercent}%** ($${yesPrice.toFixed(2)}) • 🔴 **${noPercent}% NO** ($${noPrice.toFixed(2)})`,
      inline: false,
    },
    {
      name: "💰 Est. Win Multipliers",
      value: `• YES: **${yesMultiplier}x** (+${yesGain}%)\n• NO:  **${noMultiplier}x** (+${noGain}%)`,
      inline: true,
    },
    {
      name: "📈 Volume",
      value: `**${formatUsdc(market.volumeUsdc || 0)}**`,
      inline: true,
    },
    {
      name: "📌 Status",
      value: `**${statusBadge}**`,
      inline: true,
    },
    {
      name: "⏳ Resolution Cutoff",
      value: cutoffTimestamp,
      inline: false,
    }
  );

  // Build Action Rows
  const components: ActionRowBuilder<ButtonBuilder>[] = [];

  // Row 1: Preset Buy Buttons or Closed Status
  if (market.phase === "secondary") {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("🔄 Trade on Secondary (Panta DEX)")
        .setStyle(ButtonStyle.Link)
        .setURL(`${config.WEBAPP_URL}/market/${market.id}`)
    );
    components.push(row1);
  } else if (market.phase === "resolved") {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("💰 Claim Winnings")
        .setStyle(ButtonStyle.Link)
        .setURL(`${config.WEBAPP_URL}/positions`),
      new ButtonBuilder()
        .setCustomId(`refresh_${market.id}`)
        .setLabel("🔄 Refresh")
        .setStyle(ButtonStyle.Secondary)
    );
    components.push(row1);
  } else if (isExpired) {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`closed_${market.id}`)
        .setLabel("⏳ Trading Closed")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`details_${market.id}`)
        .setLabel("📊 Details")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`refresh_${market.id}`)
        .setLabel("🔄 Refresh")
        .setStyle(ButtonStyle.Secondary)
    );
    components.push(row1);
  } else {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`buy_${market.id}_yes_5`)
        .setLabel("🟢 YES $5")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`buy_${market.id}_yes_20`)
        .setLabel("🟢 YES $20")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`buy_${market.id}_no_5`)
        .setLabel("🔴 NO $5")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`buy_${market.id}_no_20`)
        .setLabel("🔴 NO $20")
        .setStyle(ButtonStyle.Danger)
    );
    components.push(row1);
  }

  // Row 2: In-place Refresh, Details, Custom Bet, Share & WebApp (only for active live curve)
  if (!isExpired && market.phase !== "resolved") {
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`refresh_${market.id}`)
        .setLabel("🔄 Refresh")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`details_${market.id}`)
        .setLabel("📊 Details")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`custom_${market.id}`)
        .setLabel("⚙️ Custom Bet")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`share_mkt_btn_${market.id}`)
        .setLabel("🔗 Share")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel("🌐 WebApp")
        .setStyle(ButtonStyle.Link)
        .setURL(`${config.WEBAPP_URL}/?market=${market.id}`)
    );
    components.push(row2);
  }

  return { embed, components };
}

/**
 * Builds cohesive Discord trending embed with color #38bdf8,
 * Rank #1 quick-bet buttons, refresh button, and link button.
 */
export function buildDiscordTrendingCard(topMarkets: MarketData[]): {
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const medals = ["1️⃣", "2️⃣", "3️⃣"];
  const embed = new EmbedBuilder()
    .setTitle("🔥 Top Trending Markets on Panta")
    .setColor(0x38bdf8)
    .setDescription("Here is where the volume and debate are right now:\n")
    .setFooter({ text: "PantaChat • Non-Custodial Social Betting" })
    .setTimestamp();

  topMarkets.forEach((m: any, idx: number) => {
    const medal = medals[idx] || "•";
    const yesPct = Math.round((Number(m.yesPrice) || 0.5) * 100);
    const noPct = 100 - yesPct;
    const progressBar = generateProgressBar(yesPct, 8);
    const volumeDisplay = formatUsdc(Number(m.volumeUsdc) || 0);

    embed.addFields({
      name: `${medal} 🎯 ${m.title}`,
      value: `📊 ${volumeDisplay} USDC • **YES** ${yesPct}% ${progressBar} ${noPct}% **NO**`,
      inline: false,
    });
  });

  const row = new ActionRowBuilder<ButtonBuilder>();
  const topMarket = topMarkets[0];
  if (topMarket) {
    if (isCutoffExpired(topMarket.cutoffAt)) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`closed_${topMarket.id}`)
          .setLabel("⏳ Trading Closed (#1)")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
    } else {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`buy_${topMarket.id}_yes_5`)
          .setLabel("🟢 Buy YES $5 (#1)")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`buy_${topMarket.id}_no_5`)
          .setLabel("🔴 Buy NO $5 (#1)")
          .setStyle(ButtonStyle.Danger)
      );
    }
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId("refresh_trending")
      .setLabel("🔄 Refresh")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel("🌐 Open Full Hub")
      .setStyle(ButtonStyle.Link)
      .setURL(config.WEBAPP_URL)
  );

  return { embed, components: [row] };
}

