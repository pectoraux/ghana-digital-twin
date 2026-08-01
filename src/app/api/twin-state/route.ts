import { NextResponse } from "next/server";
import { getTwinStates, getTwinStateStats } from "@/lib/multimodal/twin-state";

export const dynamic = "force-dynamic";

// GET /api/twin-state?riskLevel=critical&limit=50
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const riskLevel = sp.get("riskLevel") || undefined;
  const limit = Math.min(parseInt(sp.get("limit") || "100"), 500);
  const [states, stats] = await Promise.all([getTwinStates({ riskLevel, limit }), getTwinStateStats()]);
  return NextResponse.json({ states, stats, count: states.length });
}
