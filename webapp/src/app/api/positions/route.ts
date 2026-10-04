import { NextRequest, NextResponse } from "next/server";
import { getUserTradesAsync } from "@/lib/markets";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet") || "";

  let positions: any[] = [];
  if (wallet) {
    positions = await getUserTradesAsync(wallet);
  }

  return NextResponse.json({
    wallet,
    positions,
  });
}
