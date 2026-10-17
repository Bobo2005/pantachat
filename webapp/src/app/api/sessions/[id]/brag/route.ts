import { NextRequest, NextResponse } from "next/server";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// Global in-memory set to guard against repeated brag clicks within lambda instance lifecycle
const braggedMap = new Set<string>();

function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await req.json();

    const {
      platform = "telegram",
      chatId,
      userHandle,
      user,
      creatorPlatformId,
      marketTitle = "Prediction Market",
      marketId,
      category = "Crypto",
      type,
      outcome = "yes",
      amount = 20,
    } = body;

    if (!chatId) {
      return NextResponse.json(
        { error: "chatId is required to share in chat." },
        { status: 400 }
      );
    }

    if (braggedMap.has(sessionId)) {
      return NextResponse.json({
        success: true,
        message: "Already shared in chat.",
        alreadyBragged: true,
      });
    }

    const isCreate =
      type === "create" || sessionId.startsWith("sess_create_");
    const traderDisplay = userHandle || user || creatorPlatformId || "Community Predictor";
    const displayTag = traderDisplay.startsWith("@") ? traderDisplay : `@${traderDisplay}`;

    // 1. Telegram Dispatch
    if (platform === "telegram" && TELEGRAM_BOT_TOKEN) {
      try {
        let messageHtml = "";
        let inlineKeyboard: any[] = [];

        if (isCreate) {
          // Market creation share card
          messageHtml = [
            `🚀 <b>NEW PREDICTION MARKET SHARED!</b>`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `🎯 <b>"${escapeHtml(marketTitle)}"</b>`,
            ``,
            `👤 <b>Created &amp; Shared by:</b> ${escapeHtml(displayTag)}`,
            `🏷️ <b>Category:</b> ${escapeHtml(category)}`,
            `📊 <b>Initial Odds:</b> YES 50% • 50% NO`,
            `💰 <b>Initial Liquidity:</b> $50 USDC (Devnet)`,
            ``,
            `<i>Be the first to predict on this market:</i>`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `👇 <b>Start trading right now inside chat:</b>`,
          ].join("\n");

          inlineKeyboard = marketId
            ? [
                [
                  { text: "🟢 Buy YES $5", callback_data: `buy_${marketId}_yes_5` },
                  { text: "🟢 Buy YES $20", callback_data: `buy_${marketId}_yes_20` },
                ],
                [
                  { text: "🔴 Buy NO $5", callback_data: `buy_${marketId}_no_5` },
                  { text: "🔴 Buy NO $20", callback_data: `buy_${marketId}_no_20` },
                ],
                [
                  { text: "📊 Open on PantaChat", url: `https://pantachat.vercel.app/?market=${marketId}` },
                ],
              ]
            : [
                [{ text: "🌐 Open on PantaChat", url: "https://pantachat.vercel.app" }],
              ];
        } else {
          // Trade position brag card
          const outcomeUpper = String(outcome || "yes").toUpperCase();
          const isYes = outcomeUpper === "YES";
          const counterOutcome = isYes ? "no" : "yes";
          const counterUpper = isYes ? "NO" : "YES";
          const counterEmoji = isYes ? "🔴" : "🟢";

          messageHtml = [
            `🔥 <b>PREDICTION BET PLACED IN CHAT!</b>`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `<b>${escapeHtml(displayTag)}</b> just locked in <b>$${Number(amount || 20).toFixed(2)} USDC</b> on <b>${outcomeUpper}</b> ${isYes ? "🟢" : "🔴"}!`,
            ``,
            `🎯 <b>"${escapeHtml(marketTitle)}"</b>`,
            ``,
            `<i>Think they're wrong? Fade them right now:</i>`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          ].join("\n");

          inlineKeyboard = marketId
            ? [
                [
                  { text: `${counterEmoji} Fade: Bet ${counterUpper} $5`, callback_data: `buy_${marketId}_${counterOutcome}_5` },
                  { text: `${counterEmoji} Fade: Bet ${counterUpper} $20`, callback_data: `buy_${marketId}_${counterOutcome}_20` },
                ],
                [
                  { text: "📊 Market Details", callback_data: `details_${marketId}` },
                  { text: "🌐 Open on PantaChat", url: `https://pantachat.vercel.app/?market=${marketId}` },
                ],
              ]
            : [
                [{ text: "🌐 Trade on PantaChat", url: "https://pantachat.vercel.app" }],
              ];
        }

        const tgRes = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: messageHtml,
              parse_mode: "HTML",
              reply_markup: { inline_keyboard: inlineKeyboard },
            }),
          }
        );

        const tgData = await tgRes.json();
        if (!tgData.ok) {
          console.error("[Vercel API] Telegram sendMessage error:", tgData);
          throw new Error(tgData.description || "Telegram API rejected message");
        }
        console.log(`[Vercel API] Shared successfully to Telegram chat ${chatId}: msgId ${tgData.result?.message_id}`);
      } catch (tgErr: any) {
        console.error("[Vercel API] Telegram brag dispatch error:", tgErr.message);
        return NextResponse.json(
          { error: `Telegram dispatch failed: ${tgErr.message}` },
          { status: 502 }
        );
      }
    }

    // 2. Dispatch to Discord
    if (platform === "discord" && DISCORD_BOT_TOKEN) {
      try {
        const discordTag = traderDisplay.startsWith("<@")
          ? traderDisplay
          : traderDisplay.startsWith("@")
          ? traderDisplay
          : `@${traderDisplay}`;

        let embed: any;
        let components: any[] = [];

        if (isCreate) {
          embed = {
            title: "🚀 New Prediction Market Created!",
            description:
              `**${discordTag}** just launched a new prediction market:\n\n` +
              `🎯 **"${marketTitle}"**\n\n` +
              `📊 **Initial Odds:** YES 50% • 50% NO\n` +
              `🏷️ **Category:** ${category}\n\n` +
              `*Trade on this market right now:*`,
            color: 0x38bdf8,
            footer: { text: "PantaChat • Non-Custodial Social Betting" },
          };

          if (marketId) {
            components.push({
              type: 1,
              components: [
                {
                  type: 2,
                  style: 3, // Success
                  label: "Buy YES $5",
                  custom_id: `buy_${marketId}_yes_5`,
                },
                {
                  type: 2,
                  style: 4, // Danger
                  label: "Buy NO $5",
                  custom_id: `buy_${marketId}_no_5`,
                },
              ],
            });
          }
        } else {
          const outcomeUpper = String(outcome || "yes").toUpperCase();
          const isYes = outcomeUpper === "YES";
          const counterOutcome = isYes ? "no" : "yes";
          const counterUpper = isYes ? "NO" : "YES";

          embed = {
            title: "🔥 Prediction Bet Placed in the Channel!",
            description:
              `**${discordTag}** just locked in **$${Number(amount || 20).toFixed(2)} USDC** on **${outcomeUpper}** ${isYes ? "🟢" : "🔴"}!\n\n` +
              `🎯 **"${marketTitle}"**\n\n` +
              `*Think they're wrong? Take the opposite side right now:*`,
            color: isYes ? 0x10b981 : 0xef4444,
            footer: { text: "PantaChat • Non-Custodial Social Betting" },
          };

          if (marketId) {
            components.push({
              type: 1,
              components: [
                {
                  type: 2,
                  style: isYes ? 4 : 3,
                  label: `Fade: Bet ${counterUpper} $5`,
                  custom_id: `buy_${marketId}_${counterOutcome}_5`,
                },
                {
                  type: 2,
                  style: isYes ? 4 : 3,
                  label: `Fade: Bet ${counterUpper} $20`,
                  custom_id: `buy_${marketId}_${counterOutcome}_20`,
                },
              ],
            });
          }
        }

        components.push({
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: "🌐 Open on PantaChat",
              url: marketId
                ? `https://pantachat.vercel.app/?market=${marketId}`
                : "https://pantachat.vercel.app",
            },
          ],
        });

        await fetch(`https://discord.com/api/v10/channels/${chatId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            embeds: [embed],
            components,
          }),
        });
      } catch (discordErr: any) {
        console.warn("[Vercel API] Discord brag dispatch error:", discordErr.message);
      }
    }

    braggedMap.add(sessionId);

    return NextResponse.json({
      success: true,
      message: isCreate ? "Market shared to chat!" : "Flex posted to chat!",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
