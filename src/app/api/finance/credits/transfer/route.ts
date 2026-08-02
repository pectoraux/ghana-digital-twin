// POST /api/finance/credits/transfer { fromAccountId, toAccountId, amount, type, description }

import { NextRequest, NextResponse } from "next/server";
import { transferCredits } from "@/lib/finance/engine";

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const tx = await transferCredits(body.fromAccountId, body.toAccountId, body.amount, body.type ?? "purchase", body.description ?? "Transfer", body.referenceType, body.referenceId);
    return NextResponse.json({ transaction: tx });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
