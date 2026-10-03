import { NextResponse } from "next/server";
import { getAllLiveMarkets } from "@/lib/markets";

// =============================================================================
// GET /api/markets
// Next.js App Router Route Handler (Runs on Vercel Serverless)
// =============================================================================

export async function GET() {
  try {
    const markets = getAllLiveMarkets();

    return NextResponse.json(
      {
        success: true,
        markets,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (err: any) {
    console.error("[Next.js /api/markets Error]:", err);
    return NextResponse.json(
      { success: false, error: err.message, markets: [] },
      { status: 500 }
    );
  }
}
