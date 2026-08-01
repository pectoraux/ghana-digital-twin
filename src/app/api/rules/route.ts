import { NextResponse } from "next/server";
import { RULES } from "@/lib/intelligence/types";

export const dynamic = "force-dynamic";

// GET /api/rules — list all deterministic rules
export async function GET() {
  return NextResponse.json({
    rules: RULES.map((r) => ({
      ruleId: r.ruleId,
      name: r.name,
      description: r.description,
      category: r.category,
      hypothesisType: r.hypothesisType,
      effect: r.effect,
      likelihoodRatio: r.likelihoodRatio,
      conditions: r.conditions,
    })),
    count: RULES.length,
  });
}
