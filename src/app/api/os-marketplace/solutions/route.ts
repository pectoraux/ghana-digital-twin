// GET /api/os-marketplace/solutions — list solution packages

import { NextResponse } from "next/server";
import { listSolutions } from "@/lib/os-marketplace/engine";

export async function GET() {
  const solutions = await listSolutions();
  return NextResponse.json({ solutions, count: solutions.length });
}
