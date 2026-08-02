import { NextRequest, NextResponse } from "next/server";
import { ensureCapabilitiesRegistered, getCapabilityStats, getExtensionCapabilities, grantExtensionCapabilities, checkCapability } from "@/lib/extensions/capabilities";
import { getExtensions } from "@/lib/extensions/registry";

export const dynamic = "force-dynamic";

// GET /api/capabilities — all capabilities + stats
// GET /api/capabilities?extensionId=... — capabilities for a specific extension
export async function GET(req: NextRequest) {
  await ensureCapabilitiesRegistered();
  const sp = req.nextUrl.searchParams;
  const extensionId = sp.get("extensionId");

  if (extensionId) {
    const caps = await getExtensionCapabilities(extensionId);
    return NextResponse.json({ extensionId, capabilities: caps, count: caps.length });
  }

  const stats = await getCapabilityStats();
  return NextResponse.json(stats);
}

// POST /api/capabilities {action: "grant_all"} — grant capabilities to all extensions
// POST /api/capabilities {extensionId, capabilityId} — check a specific capability
export async function POST(req: NextRequest) {
  await ensureCapabilitiesRegistered();
  const body = await req.json().catch(() => ({}));

  if (body.action === "grant_all") {
    const extensions = await getExtensions();
    let totalGranted = 0;
    for (const ext of extensions) {
      const granted = await grantExtensionCapabilities(ext.extensionId, ext.permissions);
      totalGranted += granted;
    }
    return NextResponse.json({ granted: totalGranted, extensions: extensions.length });
  }

  if (body.extensionId && body.capabilityId) {
    const result = await checkCapability(body.extensionId, body.capabilityId);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Provide action=grant_all or extensionId+capabilityId" }, { status: 400 });
}
