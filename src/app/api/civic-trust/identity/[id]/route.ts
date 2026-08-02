// GET /api/civic-trust/identity/[id] — identity verification for a citizen

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idv = await db.identityVerification.findUnique({ where: { citizenId: id } });
  if (!idv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ identity: idv });
}
