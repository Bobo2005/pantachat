import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet") || "";

  return NextResponse.json({
    wallet,
    royaltiesEarnedUsdc: 0,
    claimableRoyaltiesUsdc: 0,
    graduatedMarketsCount: 0,
    markets: [],
  });
}
