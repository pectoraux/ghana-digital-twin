// GET /api/marketplace/packages — list marketplace packages

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const rows = await db.marketplacePackage.findMany({ where: { active: true } });
  return NextResponse.json({
    packages: rows.map((p) => ({
      packageId: p.packageId, name: p.name, version: p.version,
      provides: JSON.parse(p.provides || "[]"), requires: JSON.parse(p.requires || "[]"),
      subPackages: JSON.parse(p.subPackages || "[]"), installedAt: p.installedAt,
    })),
  });
}
