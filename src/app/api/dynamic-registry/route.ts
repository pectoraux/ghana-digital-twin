import { NextResponse } from "next/server";
import { getRegisteredHypothesisTypes, getRegisteredRules, getRegisteredMissionTypes, registerAllFromManifests } from "@/lib/extensions/dynamic-registry";

export const dynamic = "force-dynamic";

// GET /api/dynamic-registry — list all registered types/rules/missions
export async function GET() {
  const [hypothesisTypes, rules, missionTypes] = await Promise.all([
    getRegisteredHypothesisTypes(),
    getRegisteredRules(),
    getRegisteredMissionTypes(),
  ]);
  return NextResponse.json({
    hypothesisTypes,
    rules,
    missionTypes,
    counts: {
      hypothesisTypes: hypothesisTypes.length,
      rules: rules.length,
      missionTypes: missionTypes.length,
    },
  });
}

// POST /api/dynamic-registry — register all from manifests
export async function POST() {
  const result = await registerAllFromManifests();
  return NextResponse.json({ registered: result });
}
