// GET /api/marketplace/transactions — list transactions

import { NextResponse } from "next/server";
import { listTransactions } from "@/lib/marketplace/engine";

export async function GET() {
  const transactions = await listTransactions(50);
  return NextResponse.json({ transactions, count: transactions.length });
}
