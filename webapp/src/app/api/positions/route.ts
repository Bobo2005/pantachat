import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet") || "";

  return NextResponse.json({
    wallet,
    positions: [],
  });
}
