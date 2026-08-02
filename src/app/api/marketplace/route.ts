// GET /api/marketplace — overview + packages
// POST /api/marketplace { action: "seed" }

import { NextRequest, NextResponse } from "next/server";
import { getMarketplaceOverview } from "@/lib/marketplace/engine";
import { seedMarketplace } from "@/lib/marketplace/seed";
import { db } from "@/lib/db";

export async function GET() {
  const [overview, pkg] = await Promise.all([
    getMarketplaceOverview(),
    db.marketplacePackage.findMany({ where: { active: true } }),
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
    const result = await seedMarketplace();
    return NextResponse.json({ ok: true, seeded: result });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
