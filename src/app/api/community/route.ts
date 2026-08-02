// GET /api/community — overview + packages
// POST /api/community { action: "seed" } — seed community data

import { NextRequest, NextResponse } from "next/server";
import { getCommunityOverview } from "@/lib/community/engine";
import { seedCommunity } from "@/lib/community/seed";
import { db } from "@/lib/db";

export async function GET() {
  const [overview, packages] = await Promise.all([
    getCommunityOverview(),
    db.communityPackage.findMany({ where: { active: true } }),
  ]);
  return NextResponse.json({
    overview,
    packages: packages.map((p) => ({
      packageId: p.packageId,
      name: p.name,
      version: p.version,
      provides: JSON.parse(p.provides || "[]"),
      requires: JSON.parse(p.requires || "[]"),
      subPackages: JSON.parse(p.subPackages || "[]"),
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.action === "seed") {
    const result = await seedCommunity();
    return NextResponse.json({ ok: true, seeded: result });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
