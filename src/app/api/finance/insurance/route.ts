// GET /api/finance/insurance — list insurance policies
// POST /api/finance/insurance — create a policy

import { NextRequest, NextResponse } from "next/server";
import { listInsurancePolicies, createInsurancePolicy } from "@/lib/finance/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const policies = await listInsurancePolicies({
    status: sp.get("status") ?? undefined,
    category: sp.get("category") ?? undefined,
  });
  return NextResponse.json({ policies, count: policies.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const policy = await createInsurancePolicy(body);
  return NextResponse.json({ policy });
}
