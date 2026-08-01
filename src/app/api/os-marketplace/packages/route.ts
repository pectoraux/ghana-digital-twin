// GET /api/os-marketplace/packages — list packages (auto-seeds)
// POST /api/os-marketplace/packages — publish a package

import { NextRequest, NextResponse } from "next/server";
import { listPackages, publishPackage } from "@/lib/os-marketplace/engine";
import { seedOSMarketplace } from "@/lib/os-marketplace/seed";

export async function GET(req: NextRequest) {
  await seedOSMarketplace().catch(() => null);
  const sp = req.nextUrl.searchParams;
  const packages = await listPackages({
    packageType: sp.get("packageType") ?? undefined,
    category: sp.get("category") ?? undefined,
    lifecycleStage: sp.get("lifecycleStage") ?? undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : 100,
  });
  return NextResponse.json({ packages, count: packages.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const pkg = await publishPackage(body);
  return NextResponse.json({ package: pkg });
}
