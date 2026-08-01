// GET /api/civic-trust/behavior/[id] — behavior profile for a citizen
// POST /api/civic-trust/behavior/[id] { action: "analyze" } — re-run analysis

import { NextRequest, NextResponse } from "next/server";
import { analyzeBehavior } from "@/lib/civic-trust/engine";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await db.behaviorProfile.findUnique({ where: { citizenId: id } });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body.action === "analyze") {
    const result = await analyzeBehavior(id);
    return NextResponse.json({ result });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
