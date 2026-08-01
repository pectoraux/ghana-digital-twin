import { NextRequest, NextResponse } from "next/server";
import { resolveDependencies } from "@/lib/extensions/advanced";

export const dynamic = "force-dynamic";

// GET /api/extensions/dependencies?extensionId=... — resolve dependency tree
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const extensionId = sp.get("extensionId");
  if (!extensionId) return NextResponse.json({ error: "extensionId required" }, { status: 400 });

  const result = await resolveDependencies(extensionId);
  return NextResponse.json({ extensionId, ...result });
}
