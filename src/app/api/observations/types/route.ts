import { NextResponse } from "next/server";
import { OBSERVATION_TYPE_LIST } from "@/lib/observation/types";

export const dynamic = "force-dynamic";

// GET /api/observations/types — list observation types + fusion rules
export async function GET() {
  return NextResponse.json({
    types: OBSERVATION_TYPE_LIST.map((t) => ({
      type: t.type,
      label: t.label,
      description: t.description,
      threshold: t.threshold,
      minEvidenceSources: t.minEvidenceSources,
      evidenceSources: t.evidenceSources.map((s) => ({
        productType: s.productType,
        weight: s.weight,
      })),
    })),
  });
}
