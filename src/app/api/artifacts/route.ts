import { NextRequest, NextResponse } from "next/server";
import { getArtifacts, createArtifact, getArtifactLineage } from "@/lib/orchestration/engine";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind") || undefined;
  const ownerPackage = sp.get("packageId") || undefined;
  const lineageId = sp.get("lineage");
  if (lineageId) {
    const lineage = await getArtifactLineage(lineageId);
    return NextResponse.json(lineage || { error: "Not found" }, { status: lineage ? 200 : 404 });
  }
  const artifacts = await getArtifacts({ kind, ownerPackage });
  return NextResponse.json({ artifacts, count: artifacts.length });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = await createArtifact(body);
  return NextResponse.json({ artifactId: id });
}
