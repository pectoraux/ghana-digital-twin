// GET /api/finance/credits — list credit accounts + transactions

import { NextRequest, NextResponse } from "next/server";
import { listCreditAccounts, listCreditTransactions } from "@/lib/finance/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const [accounts, transactions] = await Promise.all([
    listCreditAccounts(50),
    listCreditTransactions({ type: sp.get("type") ?? undefined, limit: 50 }),
  ]);
  return NextResponse.json({ accounts, transactions, accountCount: accounts.length, txCount: transactions.length });
}
