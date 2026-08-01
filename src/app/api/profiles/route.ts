import { NextResponse } from "next/server";
import { getProfiles } from "@/lib/orchestration/engine";
export const dynamic = "force-dynamic";
export async function GET() {
  const profiles = await getProfiles();
  return NextResponse.json({ profiles, count: profiles.length });
}
