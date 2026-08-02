// GET /api/federation/treaties — list treaties

import { NextResponse } from "next/server";
import { listTreaties } from "@/lib/federation/engine";

export async function GET() {
  const treaties = await listTreaties();
  return NextResponse.json({ treaties, count: treaties.length });
}
