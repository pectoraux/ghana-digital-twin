import { NextResponse } from "next/server";
import { runLearning, getLearningHistory } from "@/lib/learning/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/learning/update — run the learning engine
export async function POST() {
  const result = await runLearning();
  return NextResponse.json(result);
}

// GET /api/learning/update — learning history
export async function GET() {
  const history = await getLearningHistory(20);
  return NextResponse.json({ updates: history, count: history.length });
}
