// POST /api/command-center/executions/[id]/advance { actor, decision, skip } — advance one step

import { NextRequest, NextResponse } from "next/server";
import { advanceWorkflowStep } from "@/lib/command/engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const execution = await advanceWorkflowStep(
      id,
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
