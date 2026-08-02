import { NextResponse } from "next/server";
import { measureSLOs } from "@/lib/validation/gates";

export const dynamic = "force-dynamic";

// GET /api/slo — list all SLOs with current status
// POST /api/slo — measure SLOs
export async function GET() {
  const slos = await measureSLOs();
  return NextResponse.json({ slos, count: slos.length });
}

export async function POST() {
  const slos = await measureSLOs();
  return NextResponse.json({ measured: slos.length, slos });
}
