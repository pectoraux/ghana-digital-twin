import { NextResponse } from "next/server";
import { getAgentPackages } from "@/lib/platform/engine";
export const dynamic = "force-dynamic";
export async function GET() {
  const agents = await getAgentPackages();
  return NextResponse.json({ agents, count: agents.length });
}
