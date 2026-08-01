import { NextResponse } from "next/server";
import { getLearnedPriors } from "@/lib/learning/engine";

export const dynamic = "force-dynamic";

// GET /api/learning/priors — current learned priors with accuracy
export async function GET() {
  const priors = await getLearnedPriors();
  return NextResponse.json({ priors, count: priors.length });
}
