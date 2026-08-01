import { NextRequest, NextResponse } from "next/server";
import { getExtensions, getExtensionStats, enableExtension, disableExtension } from "@/lib/extensions/registry";

export const dynamic = "force-dynamic";

// GET /api/extensions — list all extensions
export async function GET() {
  const [extensions, stats] = await Promise.all([getExtensions(), getExtensionStats()]);
  return NextResponse.json({ extensions, stats, count: extensions.length });
}

// PATCH /api/extensions {extensionId, action: "enable"|"disable"}
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.extensionId) return NextResponse.json({ error: "extensionId required" }, { status: 400 });
  if (body.action === "enable") {
    await enableExtension(body.extensionId);
    return NextResponse.json({ extensionId: body.extensionId, status: "enabled" });
  }
  if (body.action === "disable") {
    await disableExtension(body.extensionId);
    return NextResponse.json({ extensionId: body.extensionId, status: "disabled" });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
