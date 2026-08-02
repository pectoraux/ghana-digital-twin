// GET /api/federation — overview + packages
// POST /api/federation { action: "seed" }

import { NextRequest, NextResponse } from "next/server";
import { getFederationOverview } from "@/lib/federation/engine";
import { seedFederation } from "@/lib/federation/seed";
import { db } from "@/lib/db";

export async function GET() {
  const [overview, pkg] = await Promise.all([
    getFederationOverview(),
    db.federationPackage.findMany({ where: { active: true } }),
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
  if (body.action === "seed") {
    const result = await seedFederation();
    return NextResponse.json({ ok: true, seeded: result });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
