import { NextRequest, NextResponse } from "next/server";
import { getScenario } from "@/lib/intelligence/scenarios";

export const dynamic = "force-dynamic";

// GET /api/scenarios/:id
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scenario = await getScenario(id);
  if (!scenario) return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
  return NextResponse.json(scenario);
}
