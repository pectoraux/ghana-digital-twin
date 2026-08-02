// GET /api/governance-v2/constitution/[id] — constitution detail with articles + amendments

import { NextRequest, NextResponse } from "next/server";
import { getConstitution } from "@/lib/governance-v2/engine";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const constitution = await getConstitution(id);
  if (!constitution) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ constitution });
}
