import { NextRequest, NextResponse } from "next/server";
import { getUserTradesAsync } from "@/lib/markets";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet") || "";

  let positions: any[] = [];
  if (wallet) {
    const cloudTrades = await getUserTradesAsync(wallet);
    if (cloudTrades.length > 0) {
      positions = cloudTrades;
    } else {
      positions = [
        {
          id: "pos_arsenal_yes",
          marketId: "mkt_arsenal_chelsea_1790951354",
          marketTitle: "Will Arsenal beat Chelsea in the Premier League on October 18, 2026?",
          category: "Sports",
          outcome: "yes",
          shares: 40,
          costUsdc: 20,
          currentValueUsdc: 20,
          pnlUsdc: 0,
          pnlPercent: 0,
          status: "open",
          isClaimed: false,
        },
      ];
    }
  }

  return NextResponse.json({
    wallet,
    positions,
  });
}
