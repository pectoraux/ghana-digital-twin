// GET /api/command-center — national overview + package manifest
// POST /api/command-center { action: "seed" } — seed real data

import { NextRequest, NextResponse } from "next/server";
import {
  getNationalOverview,
  getCommandCenterPackage,
  registerCommandCenterPackage,
} from "@/lib/command/engine";
import { seedCommandCenter } from "@/lib/command/seed";

export async function GET(req: NextRequest) {
  // Ensure the package is registered (idempotent)
  await registerCommandCenterPackage();
  const [overview, pkg] = await Promise.all([getNationalOverview(), getCommandCenterPackage()]);
  return NextResponse.json({ overview, package: pkg });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.action === "seed") {
    const result = await seedCommandCenter();
    return NextResponse.json({ ok: true, seeded: result });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
