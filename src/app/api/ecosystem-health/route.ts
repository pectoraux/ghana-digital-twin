import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/ecosystem-health — ecosystem health metrics
export async function GET() {
  const [
    packages, manifests, profiles, solutions,
    capabilities, dependencies, resolvedDeps,
    governanceApproved, conformancePassed, conformanceTotal,
    sdkInterfaces, registries, kernelVersion,
    agents, knowledgePkgs, featureContracts,
  ] = await Promise.all([
    db.platformPackage.count(),
    db.packageManifest.count(),
    db.packageProfile.count(),
    db.solutionDefinition.count(),
    db.providerCapability.count(),
    db.packageDependency.count(),
    db.packageDependency.count({ where: { resolved: true } }),
    db.governanceApproval.count({ where: { decision: "approved" } }),
    db.conformanceResult.count({ where: { passed: true } }),
    db.conformanceResult.count(),
    db.sDKInterfaceFreeze.count(),
    db.remoteRegistry.count(),
    db.kernelVersion.findUnique({ where: { version: "1.0.0" } }),
    db.agentPackage.count({ where: { enabled: true } }),
    db.knowledgePackage.count(),
    db.featureContract.count(),
  ]);

  const dependencyResolutionRate = dependencies > 0 ? resolvedDeps / dependencies : 0;
  const conformancePassRate = conformanceTotal > 0 ? conformancePassed / conformanceTotal : 0;
  const portablePackages = await db.packageManifest.count({ where: { portable: true } });

  return NextResponse.json({
    kernel: {
      version: kernelVersion?.version ?? "unknown",
      status: kernelVersion?.status ?? "unknown",
      frozenApis: kernelVersion ? JSON.parse(kernelVersion.frozenApis || "[]").length : 0,
      sdkInterfacesFrozen: sdkInterfaces,
    },
    ecosystem: {
      packagesPublished: packages,
      packageManifests: manifests,
      portablePackages,
      profiles: profiles,
      solutions: solutions,
      averageDependencyDepth: dependencies > 0 ? (dependencies / Math.max(1, manifests)).toFixed(1) : "0",
    },
    capabilities: {
      total: capabilities,
      resolutionSuccessRate: dependencyResolutionRate,
      resolved: resolvedDeps,
      unresolved: dependencies - resolvedDeps,
    },
    quality: {
      conformancePassRate,
      testsPassed: conformancePassed,
      testsTotal: conformanceTotal,
      governanceApproved,
    },
    extensions: {
      agents,
      knowledgePackages: knowledgePkgs,
      featureContracts,
      registries,
    },
  });
}
