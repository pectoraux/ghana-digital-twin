import { NextRequest, NextResponse } from "next/server";
import { runExtensionTests, getAdvancedExtensionInfo } from "@/lib/extensions/advanced";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/extensions/tests?extensionId=... — list tests
// POST /api/extensions/tests {extensionId} — run tests
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const extensionId = sp.get("extensionId");
  if (!extensionId) return NextResponse.json({ error: "extensionId required" }, { status: 400 });

  const info = await getAdvancedExtensionInfo(extensionId);
  return NextResponse.json({ extensionId, tests: info.tests, count: info.tests.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.extensionId) return NextResponse.json({ error: "extensionId required" }, { status: 400 });

  const result = await runExtensionTests(body.extensionId);
  return NextResponse.json(result);
}
