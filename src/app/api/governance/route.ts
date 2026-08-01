import { NextRequest, NextResponse } from "next/server";
import { getGovernanceApprovals, grantGovernanceApproval } from "@/lib/platform/engine";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const approvals = await getGovernanceApprovals(sp.get("targetType") || undefined, sp.get("targetId") || undefined);
  return NextResponse.json({ approvals, count: approvals.length });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  await grantGovernanceApproval(body);
  return NextResponse.json({ granted: true });
}
