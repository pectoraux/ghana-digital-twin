import { NextRequest, NextResponse } from "next/server";
import { validateExtensionPackage } from "@/lib/extensions/dynamic-registry";
import { BUILTIN_EXTENSIONS } from "@/lib/extensions/manifests";

export const dynamic = "force-dynamic";

// GET /api/extension-packages — validate all packages
// GET /api/extension-packages?extensionId=... — validate one
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const extensionId = sp.get("extensionId");

  if (extensionId) {
    const result = await validateExtensionPackage(extensionId);
    return NextResponse.json(result);
  }

  // validate all
  const results = [];
  for (const manifest of BUILTIN_EXTENSIONS) {
    const result = await validateExtensionPackage(manifest.id);
    results.push(result);
  }

  return NextResponse.json({
    packages: results,
    valid: results.filter((r) => r.valid).length,
    invalid: results.filter((r) => !r.valid).length,
    total: results.length,
  });
}
