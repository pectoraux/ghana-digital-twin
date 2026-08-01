// GET /api/community/subscriptions?citizenId=... — list subscriptions
// POST /api/community/subscriptions — create a subscription

import { NextRequest, NextResponse } from "next/server";
import { listSubscriptions, createSubscription } from "@/lib/community/rewards";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const subs = await listSubscriptions(sp.get("citizenId") ?? undefined);
  return NextResponse.json({ subscriptions: subs, count: subs.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const sub = await createSubscription(body);
  return NextResponse.json({ subscription: sub });
}
