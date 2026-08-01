// GET /api/os-marketplace/developers — list developers

import { NextResponse } from "next/server";
import { listDevelopers } from "@/lib/os-marketplace/engine";

export async function GET() {
  const developers = await listDevelopers(50);
  return NextResponse.json({ developers, count: developers.length });
}
