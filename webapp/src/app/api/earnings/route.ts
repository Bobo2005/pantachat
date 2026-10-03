import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet") || "";

  return NextResponse.json({
    wallet,
    royaltiesEarnedUsdc: 25.0,
    claimableRoyaltiesUsdc: 12.5,
    graduatedMarketsCount: 1,
    markets: [
      {
        id: "mkt_arsenal_chelsea_1790951354",
        title: "Will Arsenal beat Chelsea in the Premier League on October 18, 2026?",
        category: "Sports",
        phase: "primary",
        volumeUsdc: 250,
        creatorRoyaltyUsdc: 1.25,
      },
    ],
  });
}
