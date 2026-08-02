import { NextRequest, NextResponse } from "next/server";
import { listTransactions, treasuryTransaction } from "@/lib/aio/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const txs = await listTransactions(sp.get("orgId") ?? undefined, 50);
  return NextResponse.json({ transactions: txs, count: txs.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const tx = await treasuryTransaction(body);
    return NextResponse.json({ transaction: tx });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
