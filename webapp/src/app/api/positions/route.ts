import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet") || "";

  return NextResponse.json({
    wallet,
    positions: [
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
      {
        id: "pos_sol_flip_eth",
        marketId: "mkt_sol_flip_eth_2026",
        marketTitle: "Will Solana flip Ethereum in market cap before end of 2026?",
        category: "Crypto",
        outcome: "yes",
        shares: 30.77,
        costUsdc: 20,
        currentValueUsdc: 26,
        pnlUsdc: 6,
        pnlPercent: 30,
        status: "open",
        isClaimed: false,
      },
    ],
  });
}
