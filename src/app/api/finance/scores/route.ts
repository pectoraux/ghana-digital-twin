// GET /api/finance/scores — list producer market scores

import { NextResponse } from "next/server";
import { listProducerScores } from "@/lib/finance/engine";

export async function GET() {
  const scores = await listProducerScores(50);
  return NextResponse.json({ scores, count: scores.length });
}
