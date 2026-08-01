import { NextRequest, NextResponse } from "next/server";
import { resolveArbitration, getArbitrations } from "@/lib/governance/engine";
export const dynamic = "force-dynamic";
export async function GET() {
  const arbitrations = await getArbitrations();
  return NextResponse.json({ arbitrations, count: arbitrations.length });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.action === "resolve" && body.arbitrationId) {
    const result = await resolveArbitration(body.arbitrationId);
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: "Provide action=resolve and arbitrationId" }, { status: 400 });
}
