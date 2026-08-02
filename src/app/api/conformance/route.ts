import { NextRequest, NextResponse } from "next/server";
import { runConformanceTests, seedConformanceTests } from "@/lib/platform/specification";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const packageId = sp.get("packageId");
  if (!packageId) return NextResponse.json({ error: "packageId required" }, { status: 400 });
  const result = await runConformanceTests(packageId);
  return NextResponse.json(result);
}
export async function POST() {
  const count = await seedConformanceTests();
  return NextResponse.json({ seeded: count });
}
