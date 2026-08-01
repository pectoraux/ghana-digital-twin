// GET /api/governance-intel/audits — list audit runs (auto-seeds)
//   ?agentId=  ?auditType=  ?result=
// POST /api/governance-intel/audits
//   { action: "constitutional", targetType?, targetId? }
//   { action: "precedent", caseType, caseDescription? }
//   { action: "impact", proposalId, proposalTitle, proposalType }

import { NextRequest, NextResponse } from "next/server";
import {
  listAuditRuns,
  runConstitutionalAudit,
  runPrecedentSearch,
  runImpactAnalysis,
} from "@/lib/governance-intel/engine";
import { seedGovernanceIntel } from "@/lib/governance-intel/seed";

export async function GET(req: NextRequest) {
  await seedGovernanceIntel().catch(() => null);
  const sp = req.nextUrl.searchParams;
  const audits = await listAuditRuns({
    agentId: sp.get("agentId") ?? undefined,
    auditType: sp.get("auditType") ?? undefined,
    result: sp.get("result") ?? undefined,
  });
  return NextResponse.json({ audits, count: audits.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "constitutional") {
      const run = await runConstitutionalAudit({
        agentId: "constitutional-auditor",
        agentName: "Constitutional Auditor Agent",
        targetType: body.targetType,
        targetId: body.targetId,
      });
      return NextResponse.json({ ok: true, run });
    }
    if (body.action === "precedent") {
      const run = await runPrecedentSearch({
        agentId: "court-research",
        agentName: "Court Research Agent",
        caseType: body.caseType,
        caseDescription: body.caseDescription,
      });
      return NextResponse.json({ ok: true, run });
    }
    if (body.action === "impact") {
      const run = await runImpactAnalysis({
        agentId: "council-intelligence",
        agentName: "Council Intelligence Agent",
        proposalId: body.proposalId,
        proposalTitle: body.proposalTitle,
        proposalType: body.proposalType,
      });
      return NextResponse.json({ ok: true, run });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
