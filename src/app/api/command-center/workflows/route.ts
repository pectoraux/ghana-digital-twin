// GET /api/command-center/workflows — list workflow definitions
// POST /api/command-center/workflows — register a workflow

import { NextRequest, NextResponse } from "next/server";
import { listWorkflows, registerWorkflow } from "@/lib/command/engine";

export async function GET() {
  const workflows = await listWorkflows();
  return NextResponse.json({ workflows, count: workflows.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const workflow = await registerWorkflow(body);
  return NextResponse.json({ workflow });
}
