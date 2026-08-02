// GET /api/community/citizens/[id] — citizen detail
// POST /api/community/citizens — register a new citizen (also handled here via id=null)

import { NextRequest, NextResponse } from "next/server";
import { getCitizen } from "@/lib/community/engine";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const citizen = await getCitizen(id);
  if (!citizen) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ citizen });
}
