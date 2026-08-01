import { NextRequest, NextResponse } from "next/server";
import { startDebate, getDebates } from "@/lib/governance/engine";
export const dynamic = "force-dynamic";
export async function GET() {
  const debates = await getDebates();
  return NextResponse.json({ debates, count: debates.length });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const debateId = await startDebate(body);
  return NextResponse.json({ debateId });
}
