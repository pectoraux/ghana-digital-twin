// GET /api/civic-trust — overview + packages
// POST /api/civic-trust { action: "seed" | "propagate" | "analyze" } — trigger operations

import { NextRequest, NextResponse } from "next/server";
import { getCivicTrustOverview } from "@/lib/civic-trust/engine";
import { seedCivicTrust } from "@/lib/civic-trust/seed";
import { runTrustPropagation, analyzeAllCitizens } from "@/lib/civic-trust/engine";
import { db } from "@/lib/db";

export async function GET() {
  const [overview, pkg] = await Promise.all([
    getCivicTrustOverview(),
    db.civicTrustPackage.findMany({ where: { active: true } }),
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
      const result = await seedCivicTrust();
      return NextResponse.json({ ok: true, seeded: result });
    }
    if (body.action === "propagate") {
      const result = await runTrustPropagation({ iterations: body.iterations ?? 15 });
      return NextResponse.json({ ok: true, result });
    }
    if (body.action === "analyze") {
      const result = await analyzeAllCitizens();
      return NextResponse.json({ ok: true, result });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
