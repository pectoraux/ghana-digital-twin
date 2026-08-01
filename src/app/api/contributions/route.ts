import { NextRequest, NextResponse } from "next/server";
import { getContributions, registerAllContributions } from "@/lib/orchestration/engine";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") || undefined;
  const packageId = sp.get("packageId") || undefined;
  const contributions = await getContributions({ kind, packageId });
  return NextResponse.json({ contributions, count: contributions.length });
}
export async function POST() {
  const count = await registerAllContributions();
  return NextResponse.json({ registered: count });
}
