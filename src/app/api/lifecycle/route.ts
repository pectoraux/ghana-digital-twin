import { NextRequest, NextResponse } from "next/server";
import { getPackageLifecycles, transitionPackageLifecycle } from "@/lib/platform/engine";
export const dynamic = "force-dynamic";
export async function GET() {
  const lifecycles = await getPackageLifecycles();
  return NextResponse.json({ lifecycles, count: lifecycles.length });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.packageId && body.toState) {
    const result = await transitionPackageLifecycle(body.packageId, body.toState, body.by || "system", body.notes);
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: "Provide packageId and toState" }, { status: 400 });
}
