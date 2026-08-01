import { NextRequest, NextResponse } from "next/server";
import { compileExecutionPlan, getExecutionPlans } from "@/lib/kernel/engine";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET() {
  const plans = await getExecutionPlans();
  return NextResponse.json({ plans, count: plans.length });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const plan = await compileExecutionPlan({ solutionId: body.solutionId, packageIds: body.packageIds || ["illegal-mining"] });
  return NextResponse.json(plan);
}
