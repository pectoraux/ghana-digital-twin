// GET /api/governance-v2/council/[id] — council detail with members

import { NextRequest, NextResponse } from "next/server";
import { getCouncil } from "@/lib/governance-v2/engine";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const council = await getCouncil(id);
  if (!council) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ council });
}
