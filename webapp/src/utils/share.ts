/**
 * Universal Social Share Helper for PantaChat (Telegram Mini App, Web, Mobile)
 */

export interface ShareResult {
  success: boolean;
  type: "tma" | "native" | "clipboard" | "telegram_url" | "aborted";
  message: string;
}

export interface SharePositionOptions {
  marketId: string;
  marketTitle: string;
  outcome: "yes" | "no";
  spendUsdc: number;
  oddsPercent: number;
  userHandle?: string;
  isTelegram?: boolean;
  switchInlineQuery?: (
    query: string,
    choose_chat_types?: ("users" | "bots" | "groups" | "channels")[]
  ) => void;
}

export interface ShareMarketOptions {
  marketId: string;
  marketTitle: string;
  yesPercent: number;
  noPercent: number;
  userHandle?: string;
  isTelegram?: boolean;
  switchInlineQuery?: (
    query: string,
    choose_chat_types?: ("users" | "bots" | "groups" | "channels")[]
  ) => void;
}

/**
 * Shares an active prediction position to any Telegram group/DM or clipboard.
 */
export async function sharePosition(options: SharePositionOptions): Promise<ShareResult> {
  const {
    marketId,
    marketTitle,
    outcome,
    spendUsdc,
    oddsPercent,
    userHandle = "trader",
    isTelegram = false,
    switchInlineQuery,
  } = options;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://pantachat.vercel.app";
  const shareUrl = `${baseUrl}/?market=${encodeURIComponent(marketId)}&ref=${encodeURIComponent(userHandle)}&side=${outcome}`;
  const shareText = `🎯 I'm holding ${outcome.toUpperCase()} on "${marketTitle}"! Current odds: ${oddsPercent}%. Agree or fade me on PantaChat: ${shareUrl}`;
  const inlineQuery = `share_pos_${marketId}_${outcome}_${Math.round(spendUsdc)}`;

  // 1. Inside Telegram Mini App: Native Chat Picker
  if (isTelegram && switchInlineQuery) {
    try {
      switchInlineQuery(inlineQuery, ["groups", "channels", "users"]);
      return {
        success: true,
        type: "tma",
        message: "🚀 Select a group or friend to share your bet!",
      };
    } catch (err) {
      console.warn("[Share] TMA switchInlineQuery failed:", err);
    }
  }

  // 2. Mobile Browser: Native Web Share API if supported
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
    if (isMobile) {
      try {
        await navigator.share({
          title: `My Bet on Panta: ${marketTitle}`,
          text: shareText,
          url: shareUrl,
        });
        return {
          success: true,
          type: "native",
          message: "✅ Position shared!",
        };
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return {
            success: false,
            type: "aborted",
            message: "",
          };
        }
      }
    }
  }

  // 3. Fallback: Copy to clipboard & open Telegram Web Share
  let copied = false;
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(shareText);
      copied = true;
    } catch {}
  }

  // Open Telegram universal share link
  const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(
    `🎯 I'm holding ${outcome.toUpperCase()} on "${marketTitle}"! Current odds: ${oddsPercent}%. Agree or fade me on PantaChat:`
  )}`;
  
  if (typeof window !== "undefined") {
    window.open(tgShareUrl, "_blank", "noopener,noreferrer");
  }

  return {
    success: true,
    type: copied ? "clipboard" : "telegram_url",
    message: copied
      ? "📋 Copied share link & opened Telegram!"
      : "🚀 Opening Telegram share...",
  };
}

/**
 * Shares an entire prediction market to any group or clipboard.
 */
export async function shareMarket(options: ShareMarketOptions): Promise<ShareResult> {
  const {
    marketId,
    marketTitle,
    yesPercent,
    noPercent,
    userHandle = "trader",
    isTelegram = false,
    switchInlineQuery,
  } = options;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://pantachat.vercel.app";
  const shareUrl = `${baseUrl}/?market=${encodeURIComponent(marketId)}&ref=${encodeURIComponent(userHandle)}`;
  const shareText = `🔥 Prediction Market on PantaChat: "${marketTitle}"\nYES ${yesPercent}% • NO ${noPercent}%\nTrade now: ${shareUrl}`;
  const inlineQuery = `share_mkt_${marketId}`;

  // 1. Inside Telegram Mini App
  if (isTelegram && switchInlineQuery) {
    try {
      switchInlineQuery(inlineQuery, ["groups", "channels", "users"]);
      return {
        success: true,
        type: "tma",
        message: "🚀 Select a group or friend to share this market!",
      };
    } catch (err) {
      console.warn("[Share] TMA switchInlineQuery failed:", err);
    }
  }

  // 2. Mobile Browser
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
    if (isMobile) {
      try {
        await navigator.share({
          title: marketTitle,
          text: shareText,
          url: shareUrl,
        });
        return {
          success: true,
          type: "native",
          message: "✅ Market shared!",
        };
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return {
            success: false,
            type: "aborted",
            message: "",
          };
        }
      }
    }
  }

  // 3. Fallback: Copy to clipboard & open Telegram Web Share
  let copied = false;
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(shareText);
      copied = true;
    } catch {}
  }

  const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(
    `🔥 Prediction Market on PantaChat: "${marketTitle}" (YES ${yesPercent}% • NO ${noPercent}%)`
  )}`;

  if (typeof window !== "undefined") {
    window.open(tgShareUrl, "_blank", "noopener,noreferrer");
  }

  return {
    success: true,
    type: copied ? "clipboard" : "telegram_url",
    message: copied
      ? "📋 Copied share link & opened Telegram!"
      : "🚀 Opening Telegram share...",
  };
}
