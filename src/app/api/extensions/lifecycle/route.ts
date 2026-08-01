import { NextRequest, NextResponse } from "next/server";
import { getAdvancedExtensionInfo, runExtensionTests, installAdvancedFeatures } from "@/lib/extensions/advanced";
import { getExtensions } from "@/lib/extensions/registry";
import { BUILTIN_EXTENSIONS } from "@/lib/extensions/manifests";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/extensions/lifecycle?extensionId=... — get hooks, pipelines, deps, contracts, limits, trust, tests
// POST /api/extensions/lifecycle {action: "install_all" | "run_tests", extensionId?} — install advanced features or run tests
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const extensionId = sp.get("extensionId");

  if (extensionId) {
    const info = await getAdvancedExtensionInfo(extensionId);
    return NextResponse.json({ extensionId, ...info });
  }

  // return summary for all extensions
  const extensions = await getExtensions();
  const summary = await Promise.all(
    extensions.map(async (ext) => {
      const info = await getAdvancedExtensionInfo(ext.extensionId);
      return {
        extensionId: ext.extensionId,
        name: ext.name,
        hookCount: info.hooks.length,
        pipelineCount: info.pipelines.length,
        dependencyCount: info.dependencies.length,
        contractValidated: info.contract?.validated ?? false,
        trustLevel: info.trust?.trustLevel ?? "unknown",
        trustScore: info.trust?.trustScore ?? 0,
        testCount: info.tests.length,
        testsPassed: info.tests.filter((t: any) => t.lastResult === "passed").length,
      };
    })
  );

  return NextResponse.json({ extensions: summary, count: summary.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body.action === "install_all") {
    // install advanced features for all extensions
    const results = [];
    for (const manifest of BUILTIN_EXTENSIONS) {
      const result = await installAdvancedFeatures(manifest.id, manifest);
      results.push({ extensionId: manifest.id, ...result });
    }
    return NextResponse.json({ installed: results.length, results });
  }

  if (body.action === "run_tests") {
    if (!body.extensionId) return NextResponse.json({ error: "extensionId required" }, { status: 400 });
    const result = await runExtensionTests(body.extensionId);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action. Use install_all or run_tests." }, { status: 400 });
}
