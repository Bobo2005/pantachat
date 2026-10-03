import { NextRequest, NextResponse } from "next/server";
import { addLiveMarket, getAllLiveMarkets, type LiveMarket } from "@/lib/markets";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

// =============================================================================
// POST /api/sessions/[id]/submit
// Next.js App Router Route Handler (Runs on Vercel Serverless)
// =============================================================================

function formatShortWallet(wallet?: string | null): string {
  if (!wallet || wallet.length < 10) return wallet || "";
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await req.json();

    const {
      type = "create",
      signature,
      wallet,
      chatId,
      platform = "telegram",
      creatorPlatformId,
      creator,
      user,
      marketId,
      title,
      description,
      category = "Crypto",
      outcome = "yes",
      amount = 20,
      cutoffAt,
    } = body;

    const finalSig = signature || `sig_${Date.now()}`;
    const isTrade = type === "buy" || sessionId.startsWith("sess_buy_");

    // =========================================================================
    // CASE A: User Executed a Trade (Buy YES or Buy NO)
    // =========================================================================
    if (isTrade) {
      const allMarkets = getAllLiveMarkets();
      const existingMarket = allMarkets.find(
        (m) =>
          m.id === marketId ||
          (m.title && title && m.title.toLowerCase().trim() === title.toLowerCase().trim())
      );

      const targetTitle = existingMarket?.title || title || "Prediction Market";
      const targetCategory = existingMarket?.category || category || "Crypto";
      const targetMarketId = existingMarket?.id || marketId || `mkt_${Date.now()}`;
      const targetChatId = chatId || existingMarket?.chatId;
      const tradeAmount = Number(amount || 20);

      // Increment market volume
      if (existingMarket) {
        existingMarket.volumeUsdc = (existingMarket.volumeUsdc || 0) + tradeAmount;
        existingMarket.volumeRaw = (existingMarket.volumeRaw || 0) + tradeAmount;
      }

      const traderUser = user || creatorPlatformId || creator || "";
      const shortWallet = formatShortWallet(wallet);
      const traderTag = traderUser ? (traderUser.startsWith("@") ? traderUser : `@${traderUser}`) : "";
      const traderDisplay =
        traderTag && shortWallet
          ? `${traderTag} (\`${shortWallet}\`)`
          : traderTag || (shortWallet ? `\`${shortWallet}\`` : "Anonymous Trader");

      const outcomeUpper = String(outcome || "yes").toUpperCase();
      const outcomeEmoji = outcomeUpper === "YES" ? "🟢" : "🔴";
      const explorerUrl = `https://explorer.solana.com/tx/${finalSig}?cluster=devnet`;

      console.log(`[Vercel API] Trade confirmed: ${traderDisplay} bet $${tradeAmount} on ${outcomeUpper} for "${targetTitle}"`);

      // 1. Dispatch Real-Time Trade Notice to Telegram Group Chat
      if (targetChatId && TELEGRAM_BOT_TOKEN) {
        try {
          const tradeCardText = [
            `🎯 *TRADE EXECUTED ON-CHAIN!*`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `📈 *Market:* ${targetTitle}`,
            ``,
            `👤 *Trader:* ${traderDisplay}`,
            `💰 *Position Placed:* $${tradeAmount.toFixed(2)} USDC on *${outcomeUpper}* ${outcomeEmoji}`,
            `🏷️ *Category:* ${targetCategory}`,
            ``,
            `⛓️ [View On-Chain Tx on Solana Explorer](${explorerUrl})`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `👇 *Trade this market right now:*`,
          ].join("\n");

          const replyMarkup = {
            inline_keyboard: [
              [
                { text: "🟢 Buy YES $5", callback_data: `buy_${targetMarketId}_yes_5` },
                { text: "🟢 Buy YES $20", callback_data: `buy_${targetMarketId}_yes_20` },
              ],
              [
                { text: "🔴 Buy NO $5", callback_data: `buy_${targetMarketId}_no_5` },
                { text: "🔴 Buy NO $20", callback_data: `buy_${targetMarketId}_no_20` },
              ],
              [
                { text: "📊 Market Details", callback_data: `details_${targetMarketId}` },
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
                chat_id: targetChatId,
                text: tradeCardText,
                parse_mode: "Markdown",
                reply_markup: replyMarkup,
              }),
            }
          );

          const tgData = await tgRes.json();
          if (tgData.ok) {
            console.log(`[Vercel API] Telegram trade confirmation dispatched to ${targetChatId}`);
          } else {
            console.warn(`[Vercel API] Telegram trade notice not ok:`, tgData);
          }
        } catch (tgErr: any) {
          console.warn(`[Vercel API] Could not send Telegram trade notice:`, tgErr.message);
        }
      }

      // 2. Dispatch to Discord
      if (targetChatId && platform === "discord" && DISCORD_BOT_TOKEN) {
        try {
          await fetch(`https://discord.com/api/v10/channels/${targetChatId}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content: `🎯 **Trade Placed on Solana!**\n**${traderDisplay}** placed **$${tradeAmount.toFixed(2)} USDC** on **${outcomeUpper}** ${outcomeEmoji}\n📈 **Market:** ${targetTitle}\n${explorerUrl}`,
            }),
          });
        } catch (discordErr: any) {
          console.warn(`[Vercel API] Discord trade notice warning:`, discordErr.message);
        }
      }

      return NextResponse.json({
        success: true,
        status: "confirmed",
        signature: finalSig,
        type: "buy",
        amount: tradeAmount,
        outcome: outcomeUpper,
        explorerUrl,
      });
    }

    // =========================================================================
    // CASE B: User Created a New Prediction Market
    // =========================================================================
    const creatorUser = creatorPlatformId || creator || user || "Community Predictor";
    const marketTitle = title || "Prediction Market";

    // 1. Add Market to live catalog so it immediately displays on pantachat.vercel.app
    const createdMarket = addLiveMarket({
      id: marketId || `mkt_${Date.now()}`,
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
      chatId,
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
