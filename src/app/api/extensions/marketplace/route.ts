import { NextResponse } from "next/server";
import { getExtensions } from "@/lib/extensions/registry";

export const dynamic = "force-dynamic";

// GET /api/extensions/marketplace — browse available extensions
export async function GET() {
  const extensions = await getExtensions();
  return NextResponse.json({
    marketplace: extensions.map((e) => ({
      extensionId: e.extensionId,
      name: e.name,
      version: e.version,
      description: e.description,
      author: e.author,
      category: e.category,
      status: e.status,
      icon: e.icon,
      color: e.color,
      tags: e.tags,
      trustScore: e.trustScore,
      isSigned: e.isSigned,
      isVerified: e.isVerified,
      ruleCount: e.ruleCount,
      permissions: e.permissions,
    })),
    count: extensions.length,
  });
}
