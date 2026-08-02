import { NextResponse } from "next/server";
import { getPackages, initializeOrchestration } from "@/lib/orchestration/engine";
export const dynamic = "force-dynamic";
export async function GET() {
  const packages = await getPackages();
  return NextResponse.json({ packages, count: packages.length });
}
export async function POST() {
  const result = await initializeOrchestration();
  return NextResponse.json({ initialized: true, ...result });
}
