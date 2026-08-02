// GET /api/finance — overview + packages
// POST /api/finance { action: "seed" | "computeScores" }

import { NextRequest, NextResponse } from "next/server";
import { getFinanceOverview, computeAllProducerScores } from "@/lib/finance/engine";
import { seedFinance } from "@/lib/finance/seed";
import { db } from "@/lib/db";

export async function GET() {
  const [overview, pkg] = await Promise.all([
    getFinanceOverview(),
    db.intelligenceFinancePackage.findMany({ where: { active: true } }),
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
      const result = await seedFinance();
      return NextResponse.json({ ok: true, seeded: result });
    }
    if (body.action === "computeScores") {
      const result = await computeAllProducerScores();
      return NextResponse.json({ ok: true, result });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
