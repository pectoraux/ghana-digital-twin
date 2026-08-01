import { NextRequest, NextResponse } from "next/server";
import { getAdvancedExtensionInfo } from "@/lib/extensions/advanced";

export const dynamic = "force-dynamic";

// GET /api/extensions/contracts?extensionId=... — get data contract + limits + trust
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const extensionId = sp.get("extensionId");
  if (!extensionId) return NextResponse.json({ error: "extensionId required" }, { status: 400 });

  const info = await getAdvancedExtensionInfo(extensionId);
  return NextResponse.json({
    extensionId,
    contract: info.contract,
    limits: info.limits,
    trust: info.trust,
  });
}
