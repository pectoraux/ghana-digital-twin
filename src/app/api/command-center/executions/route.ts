// GET /api/command-center/executions?incidentId=... — list executions
// POST /api/command-center/executions { executionId, actor, decision, skip } — advance a step

import { NextRequest, NextResponse } from "next/server";
import { listExecutions, getExecution, advanceWorkflowStep } from "@/lib/command/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const incidentId = sp.get("incidentId") ?? undefined;
  const executionId = sp.get("executionId") ?? undefined;
  if (executionId) {
    const execution = await getExecution(executionId);
    if (!execution) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ execution });
  }
  const executions = await listExecutions(incidentId);
  return NextResponse.json({ executions, count: executions.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const execution = await advanceWorkflowStep(
      body.executionId,
      body.actor ?? "operator",
      body.decision ?? "",
      body.artifactHash,
      body.skip ?? false
    );
    return NextResponse.json({ execution });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
