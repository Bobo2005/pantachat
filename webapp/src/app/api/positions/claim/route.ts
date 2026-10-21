import { NextRequest, NextResponse } from "next/server";
import { claimUserPositionsAsync } from "@/lib/markets";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { marketId, wallet, signature, amount } = body;

    if (!marketId || !wallet) {
      return NextResponse.json(
        { error: "Missing required parameters: marketId and wallet." },
        { status: 400 }
      );
    }

    const finalSig = signature || `claim_${Date.now()}`;
    const claimedCount = await claimUserPositionsAsync(marketId, wallet, finalSig);

    return NextResponse.json({
      success: true,
      claimedCount,
      marketId,
      wallet,
      amount,
      signature: finalSig,
    });
  } catch (err: any) {
    console.error("[API /positions/claim Error]:", err);
    return NextResponse.json(
      { error: "Failed to record claim.", message: err.message },
      { status: 500 }
    );
  }
}
