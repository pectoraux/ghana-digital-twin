import { NextRequest, NextResponse } from "next/server";
import { ensureExtensionsInstalled } from "@/lib/extensions/registry";

export const dynamic = "force-dynamic";

// POST /api/extensions/install — install all built-in extensions
export async function POST() {
  await ensureExtensionsInstalled();
  return NextResponse.json({ message: "Extensions installed successfully" });
}
