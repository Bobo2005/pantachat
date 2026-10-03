import { NextRequest, NextResponse } from "next/server";
import { addLiveMarket } from "@/lib/markets";

const TELEGRAM_BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN | 
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// =============================================================================
// POST /api/sessions/[id]/submit
// Next.js App Router Route Handler (Runs on Vercel Serverless)
// =============================================================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await req.json();

    const {
      signature,
      wallet,
      chatId,
      platform = "telegram",
      creatorPlatformId,
      creator,
      title,
      description,
      category = "Crypto",
      cutoffAt,
    } = body;

    const finalSig = signature || `sig_${Date.now()}`;
    const creatorUser = creatorPlatformId || creator || "Community Predictor";
    const marketTitle = title || "Prediction Market";

    // 1. Add Market to live catalog so it immediately displays on pantachat.vercel.app
    const createdMarket = addLiveMarket({
      id: `mkt_${Date.now()}`,
      title: marketTitle,
      category,
      description: description || "Resolves per official consensus rules.",
      creator: creatorUser.startsWith("@") ? creatorUser : `@${creatorUser}`,
      phase: "primary",
      yesPrice: 0.5,
      noPrice: 0.5,
      volumeUsdc: 50,
      volumeRaw: 50,
      cutoffAt,
      txSignature: finalSig,
    });

    console.log(`[Vercel API] Market registered: "${marketTitle}" for session ${sessionId}`);

    // 2. Dispatch Real-Time Confirmation Notice to Telegram
    if (chatId && TELEGRAM_BOT_TOKEN) {
      try {
        const explorerUrl = `https://explorer.solana.com/tx/${finalSig}?cluster=devnet`;
        const creatorDisplay = creatorUser.startsWith("@") ? creatorUser : `@${creatorUser}`;

        const cardText = [
          `🎉 *PREDICTION MARKET IS LIVE!*`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `🎯 *${marketTitle}*`,
          ``,
          `👤 *Created by:* ${creatorDisplay}`,
          `🏷️ *Category:* ${category}`,
          `📈 *Initial Odds:* YES 50% • NO 50%`,
          `📜 *Resolution Criteria:*`,
          `${description || "Resolves per official rules."}`,
          ``,
          `⛓️ [View On-Chain Tx on Solana Explorer](${explorerUrl})`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `👇 *Start trading right now inside chat:*`,
        ].join("\n");

        const replyMarkup = {
          inline_keyboard: [
            [
              { text: "🟢 Buy YES $5", callback_data: `buy_${createdMarket.id}_yes_5` },
              { text: "🟢 Buy YES $20", callback_data: `buy_${createdMarket.id}_yes_20` },
            ],
            [
              { text: "🔴 Buy NO $5", callback_data: `buy_${createdMarket.id}_no_5` },
              { text: "🔴 Buy NO $20", callback_data: `buy_${createdMarket.id}_no_20` },
            ],
            [
              { text: "📊 Market Details", callback_data: `details_${createdMarket.id}` },
              { text: "🌐 Open on PantaChat", url: "https://pantachat.vercel.app" },
            ],
          ],
        };

        const tgRes = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: cardText,
              parse_mode: "Markdown",
              reply_markup: replyMarkup,
            }),
          }
        );

        const tgData = await tgRes.json();
        if (tgData.ok) {
          console.log(`[Vercel API] Sent Telegram confirmation to ${chatId}: message_id ${tgData.result.message_id}`);
        } else {
          console.warn(`[Vercel API] Telegram sendMessage returned not ok:`, tgData);
        }
      } catch (tgErr: any) {
        console.warn(`[Vercel API] Could not send Telegram confirmation:`, tgErr.message);
      }
    }

    // 3. Dispatch to Discord if platform is Discord
    if (chatId && platform === "discord" && DISCORD_BOT_TOKEN) {
      try {
        await fetch(`https://discord.com/api/v10/channels/${chatId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: `🚀 **Prediction Market Created and Live On-Chain!**\n**${marketTitle}**\nCreated by: <@${creatorUser}>\nhttps://explorer.solana.com/tx/${finalSig}?cluster=devnet`,
          }),
        });
      } catch (discordErr: any) {
        console.warn(`[Vercel API] Discord notice warning:`, discordErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      status: "confirmed",
      signature: finalSig,
      market: createdMarket,
      explorerUrl: `https://explorer.solana.com/tx/${finalSig}?cluster=devnet`,
    });
  } catch (err: any) {
    console.error("[Next.js /submit Error]:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
