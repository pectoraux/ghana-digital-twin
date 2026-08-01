import { NextRequest, NextResponse } from "next/server";
import { replayScene, getReplayHistory, seedBenchmarkDataset, runEvaluation, getEvaluationHistory } from "@/lib/validation/evaluation";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET /api/replay — replay history
// POST /api/replay {sceneId} — replay a scene
export async function GET() {
  const history = await getReplayHistory(10);
  return NextResponse.json({ replays: history, count: history.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body.action === "seed_benchmark") {
    const created = await seedBenchmarkDataset();
    return NextResponse.json({ created, message: `${created} benchmark samples seeded` });
  }

  if (body.action === "evaluate") {
    const result = await runEvaluation(body.datasetName || "ghana_validation");
    return NextResponse.json(result);
  }

  if (body.sceneId) {
    const result = await replayScene(body.sceneId);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Provide sceneId or action" }, { status: 400 });
}
