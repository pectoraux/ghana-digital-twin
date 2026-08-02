import { NextResponse } from "next/server";
import { getKnowledgePackages } from "@/lib/platform/engine";
export const dynamic = "force-dynamic";
export async function GET() {
  const packages = await getKnowledgePackages();
  return NextResponse.json({ knowledgePackages: packages, count: packages.length });
}
