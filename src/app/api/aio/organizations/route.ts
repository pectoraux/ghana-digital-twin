import { NextRequest, NextResponse } from "next/server";
import { listOrganizations, createOrganization } from "@/lib/aio/engine";
import { seedAIO } from "@/lib/aio/seed";

export async function GET(req: NextRequest) {
  await seedAIO().catch(() => null);
  const sp = req.nextUrl.searchParams;
  const orgs = await listOrganizations({
    status: sp.get("status") ?? undefined,
    orgType: sp.get("orgType") ?? undefined,
  });
  return NextResponse.json({ organizations: orgs, count: orgs.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const org = await createOrganization(body);
  return NextResponse.json({ organization: org });
}
