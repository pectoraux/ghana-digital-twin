import { NextRequest, NextResponse } from "next/server";
import { getPolicies, evaluatePolicy } from "@/lib/orchestration/engine";
export const dynamic = "force-dynamic";
export async function GET() {
  const policies = await getPolicies();
  return NextResponse.json({ policies, count: policies.length });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.action === "evaluate" && body.target) {
    const result = await evaluatePolicy(body.target, body.context || {});
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: "Provide action=evaluate, target, and context" }, { status: 400 });
}
