// POST /api/finance/credits/deposit { accountId, amount, description }

import { NextRequest, NextResponse } from "next/server";
import { depositCredits } from "@/lib/finance/engine";

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const tx = await depositCredits(body.accountId, body.amount, body.description ?? "Deposit", body.referenceType, body.referenceId);
    return NextResponse.json({ transaction: tx });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
