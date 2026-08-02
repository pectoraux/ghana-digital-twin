import { NextRequest, NextResponse } from "next/server";
import { getAioOverview } from "@/lib/aio/engine";
import { seedAIO } from "@/lib/aio/seed";
import { db } from "@/lib/db";

export async function GET() {
  await seedAIO().catch(() => null);
  const [overview, pkg] = await Promise.all([
    getAioOverview(),
    db.aioPackage.findMany({ where: { active: true } }),
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
    const result = await seedAIO();
    return NextResponse.json({ ok: true, seeded: result });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
