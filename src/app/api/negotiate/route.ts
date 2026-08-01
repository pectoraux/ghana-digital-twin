import { NextRequest, NextResponse } from "next/server";
import { negotiateCapability, getProviderCapabilities, getPackageDependencies, registerAllManifests, getPackageManifests } from "@/lib/platform/negotiation";

export const dynamic = "force-dynamic";

// GET /api/negotiate — list all provider capabilities + dependencies
// GET /api/negotiate?capability=weather.precipitation.daily — negotiate a specific capability
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const capability = sp.get("capability");

  if (capability) {
    const result = await negotiateCapability(capability, {
      preferredQuality: parseFloat(sp.get("minQuality") || "0"),
      maxCost: parseFloat(sp.get("maxCost") || "Infinity"),
    });
    return NextResponse.json({ capability, ...result });
  }

  const [capabilities, dependencies, manifests] = await Promise.all([
    getProviderCapabilities(),
    getPackageDependencies(),
    getPackageManifests(),
  ]);

  return NextResponse.json({
    capabilities,
    dependencies,
    manifests,
    stats: {
      totalCapabilities: capabilities.length,
      totalDependencies: dependencies.length,
      resolvedDependencies: dependencies.filter((d) => d.resolved).length,
      totalManifests: manifests.length,
      portablePackages: manifests.filter((m) => m.portable).length,
    },
  });
}

// POST /api/negotiate {action: "register_all"} — register all manifests
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.action === "register_all") {
    const count = await registerAllManifests();
    return NextResponse.json({ registered: count });
  }
  return NextResponse.json({ error: "Provide action=register_all" }, { status: 400 });
}
