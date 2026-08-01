// GET /api/governance-v2/cases/[id] — case detail with verdict

import { NextRequest, NextResponse } from "next/server";
import { getCase } from "@/lib/governance-v2/engine";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courtCase = await getCase(id);
  if (!courtCase) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ case: courtCase });
}
