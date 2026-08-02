// POST /api/command-center/workflows/[id]/execute { incidentId } — start a workflow execution

import { NextRequest, NextResponse } from "next/server";
import { startWorkflowExecution } from "@/lib/command/engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const execution = await startWorkflowExecution(id, body.incidentId);
    return NextResponse.json({ execution });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
