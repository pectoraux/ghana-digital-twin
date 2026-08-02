import { NextRequest, NextResponse } from "next/server";
import { listPhenomena, countPhenomena } from "@/lib/temporal/engine";

export const dynamic = "force-dynamic";

// GET /api/phenomena?type=&status=&limit=50
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") || undefined;
  const status = sp.get("status") || undefined;
  const limit = Math.min(parseInt(sp.get("limit") || "50"), 200);
  const [phenomena, total] = await Promise.all([listPhenomena({ type, status, limit }), countPhenomena()]);
  return NextResponse.json({ phenomena, total, count: phenomena.length });
}
