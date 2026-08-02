// GET /api/finance/insurance/[id] — policy detail with predictions

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const policy = await db.insurancePolicy.findUnique({ where: { policyId: id } });
  if (!policy) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const predictions = await db.insurancePrediction.findMany({ where: { policyId: id }, orderBy: { submittedAt: "desc" } });
  return NextResponse.json({ policy, predictions });
}
