import { NextResponse } from "next/server";
import { getModalities, getModalityStats } from "@/lib/multimodal/modalities";

export const dynamic = "force-dynamic";

// GET /api/modalities — list all sensing modalities
export async function GET() {
  const [modalities, stats] = await Promise.all([getModalities(), getModalityStats()]);
  return NextResponse.json({ modalities, stats, count: modalities.length });
}
