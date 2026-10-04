import { NextRequest, NextResponse } from "next/server";
import { getAllLiveMarketsAsync } from "@/lib/markets";

// =============================================================================
// GET /api/sessions/[id]
// Next.js App Router Route Handler (Runs on Vercel Serverless)
// =============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet") || "";
    const marketId = searchParams.get("market") || searchParams.get("marketId") || "";
    const outcome = (searchParams.get("outcome") as "yes" | "no") || "yes";
    const amount = Number(searchParams.get("amount") || 20);
    const queryTitle = searchParams.get("title") || "";
    const queryCategory = searchParams.get("category") || "";

    const isCreate = sessionId.startsWith("sess_create_") || searchParams.get("type") === "create";
    const markets = await getAllLiveMarketsAsync();

    let matchedMarket = markets.find(
      (m) =>
        m.id === marketId ||
        (queryTitle && m.title?.toLowerCase().trim() === queryTitle.toLowerCase().trim())
    );

    if (!matchedMarket && markets.length > 0 && !isCreate) {
      matchedMarket = markets.find((m) => m.id === marketId) || markets[0];
    }

    const price = matchedMarket
      ? outcome === "yes"
        ? matchedMarket.yesPrice
        : matchedMarket.noPrice
      : 0.5;
    const estShares = Math.floor(amount / (price || 0.5));

    return NextResponse.json({
      session: {
        id: sessionId,
        type: isCreate ? "create" : "buy",
        status: "pending",
        expiresAt: Math.floor(Date.now() / 1000) + 600,
      },
      payload: {
        marketId: matchedMarket?.id || marketId,
        title: matchedMarket?.title || queryTitle || "Prediction Market",
        category: matchedMarket?.category || queryCategory || "Crypto",
        outcome,
        amountUsdc: amount,
        cutoffAt: matchedMarket?.cutoffAt || "2026-12-31T23:59:59.000Z",
      },
      market: matchedMarket || {
        id: marketId || sessionId,
        title: queryTitle || "Prediction Market",
        category: queryCategory || "Crypto",
        yesPrice: 0.5,
        noPrice: 0.5,
      },
      quote: {
        estimatedShares: estShares,
        feeUsdc: isCreate ? "50.00" : "0.00",
        effectivePrice: price,
      },
      transaction: "", // Triggers client-side Devnet builder
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
