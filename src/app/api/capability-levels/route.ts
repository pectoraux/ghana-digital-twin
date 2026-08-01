import { NextResponse } from "next/server";
import { getCapabilityLevels } from "@/lib/platform/specification";
export const dynamic = "force-dynamic";
export async function GET() {
  const levels = await getCapabilityLevels();
  return NextResponse.json({ levels, count: levels.length });
}
