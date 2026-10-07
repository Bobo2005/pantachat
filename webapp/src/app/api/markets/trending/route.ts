import { NextRequest, NextResponse } from "next/server";
import { getTrendingMarketsAsync } from "@/lib/markets";

// =============================================================================
// GET /api/markets/trending
// Next.js Route Handler for Top Trending Markets
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 3);
    const markets = await getTrendingMarketsAsync(limit);
    return NextResponse.json({ markets });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
