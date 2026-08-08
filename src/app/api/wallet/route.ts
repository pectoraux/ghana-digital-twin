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
import { withdrawalSchema, validateBody, parseBody } from "@/lib/validation/schemas";
import { checkRateLimit, RATE_LIMITS } from "@/lib/validation/rate-limit";

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
  const rl = checkRateLimit(req, RATE_LIMITS.withdraw.action, RATE_LIMITS.withdraw.max, RATE_LIMITS.withdraw.windowMs);
  if (!rl.allowed) return rl.response;
  const body = await parseBody(req);
  const validation = validateBody(withdrawalSchema, body);
  if (!validation.success) return validation.response;
  const { userId, amount, mobileMoneyNumber, provider } = validation.data;

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
