import { NextRequest, NextResponse } from "next/server";
import { getExtensionConfig, updateExtensionConfig } from "@/lib/extensions/registry";

export const dynamic = "force-dynamic";

// GET /api/extensions/:id — get extension config
// PATCH /api/extensions/:id — update config
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const config = await getExtensionConfig(id);
  return NextResponse.json({ extensionId: id, config, count: config.length });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (!body.key) return NextResponse.json({ error: "key required" }, { status: 400 });
  await updateExtensionConfig(id, body.key, body.value);
  return NextResponse.json({ extensionId: id, key: body.key, updated: true });
}
