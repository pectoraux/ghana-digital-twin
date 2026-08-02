import { NextRequest, NextResponse } from "next/server";
import { generateExplainabilityAudit } from "@/lib/validation/audit";

export const dynamic = "force-dynamic";

// POST /api/audit {hypothesisId} — generate explainability audit
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.hypothesisId) return NextResponse.json({ error: "hypothesisId required" }, { status: 400 });
  const audit = await generateExplainabilityAudit(body.hypothesisId);
  if (!audit) return NextResponse.json({ error: "Hypothesis not found" }, { status: 404 });
  return NextResponse.json(audit);
}
