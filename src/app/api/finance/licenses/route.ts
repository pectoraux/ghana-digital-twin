// GET /api/finance/licenses — list licenses
// POST /api/finance/licenses — issue a license

import { NextRequest, NextResponse } from "next/server";
import { listLicenses, issueLicense } from "@/lib/finance/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const licenses = await listLicenses({
    licenseType: sp.get("licenseType") ?? undefined,
    ownerId: sp.get("ownerId") ?? undefined,
  });
  return NextResponse.json({ licenses, count: licenses.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const license = await issueLicense(body);
  return NextResponse.json({ license });
}
