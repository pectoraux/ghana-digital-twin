// GET /api/governance-v2 — overview + packages (auto-seeds)
// POST /api/governance-v2 { action: "seed" }

import { NextRequest, NextResponse } from "next/server";
import { getGovernanceOverview } from "@/lib/governance-v2/engine";
import { seedGovernance } from "@/lib/governance-v2/seed";
import { db } from "@/lib/db";

export async function GET() {
  // Auto-seed on first call
  await seedGovernance().catch(() => null);
  const [overview, pkg] = await Promise.all([
    getGovernanceOverview(),
    db.governancePackage.findMany({ where: { active: true } }),
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
      const result = await seedGovernance();
      return NextResponse.json({ ok: true, seeded: result });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
