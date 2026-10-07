import { NextRequest, NextResponse } from "next/server";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// Global in-memory set to guard against repeated brag clicks within lambda instance lifecycle
const braggedMap = new Set<string>();

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
      outcome = "yes",
      amount = 20,
    } = body;

    if (!chatId) {
      return NextResponse.json(
        { error: "chatId is required to flex in chat." },
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

    const outcomeUpper = String(outcome || "yes").toUpperCase();
    const isYes = outcomeUpper === "YES";
    const counterOutcome = isYes ? "no" : "yes";
    const counterUpper = isYes ? "NO" : "YES";
    const counterEmoji = isYes ? "🔴" : "🟢";
    const traderDisplay = userHandle || user || creatorPlatformId || "Trader";
    const displayTag = traderDisplay.startsWith("@") ? traderDisplay : `@${traderDisplay}`;

    // 1. Telegram Dispatch
    if (platform === "telegram" && TELEGRAM_BOT_TOKEN) {
      try {
        const bragText = [
          `🔥 *BET PLACED IN THE CHAT!*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `*${displayTag}* just put *$${Number(amount || 20).toFixed(2)} USDC* on *${outcomeUpper}* ${isYes ? "🟢" : "🔴"}!`,
          ``,
          `🎯 *"${marketTitle}"*`,
          ``,
          `_Think they're wrong? Fade them right now:_`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ].join("\n");

        const replyMarkup = {
          inline_keyboard: marketId
            ? [
                [
                  { text: `${counterEmoji} Fade: Bet ${counterUpper} $5`, callback_data: `buy_${marketId}_${counterOutcome}_5` },
                  { text: `${counterEmoji} Fade: Bet ${counterUpper} $20`, callback_data: `buy_${marketId}_${counterOutcome}_20` },
                ],
                [
                  { text: "📊 Market Details", callback_data: `details_${marketId}` },
                  { text: "🌐 Open on PantaChat", url: "https://pantachat.vercel.app" },
                ],
              ]
            : [
                [{ text: "🌐 Trade on PantaChat", url: "https://pantachat.vercel.app" }],
              ],
        };

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: bragText,
            parse_mode: "Markdown",
            reply_markup: replyMarkup,
          }),
        });
      } catch (tgErr: any) {
        console.warn("[Vercel API] Telegram brag dispatch error:", tgErr.message);
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

        const embed = {
          title: "🔥 Prediction Bet Placed in the Channel!",
          description:
            `**${discordTag}** just locked in **$${Number(amount || 20).toFixed(2)} USDC** on **${outcomeUpper}** ${isYes ? "🟢" : "🔴"}!\n\n` +
            `🎯 **"${marketTitle}"**\n\n` +
            `*Think they're wrong? Take the opposite side right now:*`,
          color: isYes ? 0x10b981 : 0xef4444,
          footer: { text: "PantaChat • Non-Custodial Social Betting" },
        };

        const components: any[] = [];
        if (marketId) {
          components.push({
            type: 1, // ActionRow
            components: [
              {
                type: 2, // Button
                style: isYes ? 4 : 3, // Danger (Red) vs Success (Green)
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
        components.push({
          type: 1,
          components: [
            {
              type: 2,
              style: 5, // Link
              label: "🌐 Open on PantaChat",
              url: "https://pantachat.vercel.app",
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
      message: "Brag card posted to chat!",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
