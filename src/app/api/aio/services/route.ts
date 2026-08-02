import { NextRequest, NextResponse } from "next/server";
import { listServices, publishService } from "@/lib/aio/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const services = await listServices({
    orgId: sp.get("orgId") ?? undefined,
    serviceType: sp.get("serviceType") ?? undefined,
  });
  return NextResponse.json({ services, count: services.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const service = await publishService(body);
  return NextResponse.json({ service });
}
