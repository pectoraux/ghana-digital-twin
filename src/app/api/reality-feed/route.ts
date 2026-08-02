// GET /api/reality-feed — overview + packages (auto-seeds)
// POST /api/reality-feed { action: "seed" | "refreshFreshness" | "ingest" }

import { NextRequest, NextResponse } from "next/server";
import { getRealityFeedOverview, refreshAllFreshness } from "@/lib/reality-feed/engine";
import { seedRealityFeed, runSentinel2Ingestion } from "@/lib/reality-feed/seed";
import { db } from "@/lib/db";

export async function GET() {
  // Auto-seed on first call
  await seedRealityFeed().catch(() => null);
  const [overview, pkg] = await Promise.all([
    getRealityFeedOverview(),
    db.realityFeedPackage.findMany({ where: { active: true } }),
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
      const result = await seedRealityFeed();
      return NextResponse.json({ ok: true, seeded: result });
    }
    if (body.action === "refreshFreshness") {
      const result = await refreshAllFreshness();
      return NextResponse.json({ ok: true, result });
    }
    if (body.action === "ingest") {
      // Run Sentinel-2 ingestion
      const result = await runSentinel2Ingestion();
      return NextResponse.json({ ok: true, result });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
