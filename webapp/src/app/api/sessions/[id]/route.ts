import { NextRequest, NextResponse } from "next/server";
import { getAllLiveMarkets } from "@/lib/markets";

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

    const isCreate = sessionId.startsWith("sess_create_");
    const markets = getAllLiveMarkets();

    return NextResponse.json({
      session: {
        id: sessionId,
        type: isCreate ? "create" : "buy",
        status: "pending",
        expiresAt: Math.floor(Date.now() / 1000) + 600,
      },
      payload: {
        amountUsdc: 20,
      },
      market: markets[0] || null,
      quote: {
        feeUsdc: "50.00",
        effectivePrice: 0.5,
      },
      transaction: "", // Triggers client-side Devnet builder
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
