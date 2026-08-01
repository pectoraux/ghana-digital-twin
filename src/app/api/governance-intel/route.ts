// GET /api/governance-intel — overview + packages (auto-seeds)
// POST /api/governance-intel { action: "seed" | "audit" | "evaluateAll" }

import { NextRequest, NextResponse } from "next/server";
import { getGovernanceIntelOverview, runConstitutionalAudit, evaluateInstitution, listInstitutions } from "@/lib/governance-intel/engine";
import { seedGovernanceIntel } from "@/lib/governance-intel/seed";
import { db } from "@/lib/db";

export async function GET() {
  // Auto-seed on first call
  await seedGovernanceIntel().catch(() => null);
  const [overview, pkg] = await Promise.all([
    getGovernanceIntelOverview(),
    db.governanceIntelligencePackage.findMany({ where: { active: true } }),
  ]);
  return NextResponse.json({
    overview,
    packages: pkg.map((p) => ({
      packageId: p.packageId, name: p.name, version: p.version,
      provides: JSON.parse(p.provides || "[]"), requires: JSON.parse(p.requires || "[]"),
      subPackages: JSON.parse(p.subPackages || "[]"),
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "seed") {
      const result = await seedGovernanceIntel();
      return NextResponse.json({ ok: true, seeded: result });
    }
    if (body.action === "audit") {
      // Run a constitutional audit via the constitutional-auditor agent
      const run = await runConstitutionalAudit({
        agentId: "constitutional-auditor",
        agentName: "Constitutional Auditor Agent",
        targetType: body.targetType,
        targetId: body.targetId,
      });
      return NextResponse.json({ ok: true, run });
    }
    if (body.action === "evaluateAll") {
      const institutions = await listInstitutions();
      const results: any[] = [];
      for (const inst of institutions) {
        try {
          const updated = await evaluateInstitution(inst.institutionId);
          results.push({ institutionId: inst.institutionId, name: inst.name, overallScore: updated.overallScore, trustTier: updated.trustTier });
        } catch (e: any) {
          results.push({ institutionId: inst.institutionId, error: e.message });
        }
      }
      return NextResponse.json({ ok: true, evaluated: results.length, results });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
