// /api/wallet — citizen wallet endpoints
//
// GET  /api/wallet?userId=<id>
//     Returns: { account: WalletAccount, transactions: WalletTransaction[], pendingWithdrawals: WithdrawalRequestRow[] }
//
// POST /api/wallet { userId, action: "withdraw", amount, mobileMoneyNumber, provider? }
//     Returns: { withdrawal, newBalance }

import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateUserWallet,
  getUserTransactions,
  getUserWithdrawals,
  requestWithdrawal,
  MOBILE_MONEY_PROVIDERS,
  type MobileMoneyProvider,
} from "@/lib/wallet/service";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    const [account, transactions, pendingWithdrawals] = await Promise.all([
      getOrCreateUserWallet(userId),
      getUserTransactions(userId, 50),
      getUserWithdrawals(userId, 20),
    ]);
    return NextResponse.json({
      account,
      transactions,
      pendingWithdrawals,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { userId, action, amount, mobileMoneyNumber, provider } = body ?? {};

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (action !== "withdraw") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return NextResponse.json({ error: "amount must be a number" }, { status: 400 });
  }
  if (typeof mobileMoneyNumber !== "string" || !mobileMoneyNumber.trim()) {
    return NextResponse.json({ error: "mobileMoneyNumber required" }, { status: 400 });
  }

  const prov: MobileMoneyProvider = (MOBILE_MONEY_PROVIDERS as readonly string[]).includes(
    provider,
  )
    ? (provider as MobileMoneyProvider)
    : "mtn";

  try {
    const result = await requestWithdrawal(userId, amount, mobileMoneyNumber.trim(), prov);
    return NextResponse.json(result);
  } catch (e: any) {
    const status = /Insufficient|Minimum|Invalid|Unknown/.test(e.message) ? 400 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
