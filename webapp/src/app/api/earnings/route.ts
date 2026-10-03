import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet") || "";

  return NextResponse.json({
    wallet,
    royaltiesEarnedUsdc: 1.25,
    claimableRoyaltiesUsdc: 1.25,
    graduatedMarketsCount: 0,
    markets: [
      {
        id: "mkt_arsenal_chelsea_1790951354",
        title: "Will Arsenal beat Chelsea in the Premier League on October 18, 2026?",
        category: "Sports",
        source: "Telegram (@Bobotrades)",
        createdAt: "Today",
        volumeUsdc: 250,
        graduationThresholdUsdc: 10000,
        status: "bonding",
        creatorRoyaltyUsdc: 1.25,
        claimableRoyaltyUsdc: 1.25,
        isClaimed: false,
      },
    ],
  });
}
