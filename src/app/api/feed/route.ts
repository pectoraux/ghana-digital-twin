import { NextRequest, NextResponse } from "next/server";
import { listFeedItems, createFeedItem, getFeedOverview } from "@/lib/feed/engine";
import { seedCommunityApp } from "@/lib/feed/seed";
import { createFeedItemSchema, validateBody, parseBody } from "@/lib/validation/schemas";

export async function GET(req: NextRequest) {
  await seedCommunityApp().catch(() => null);
  const sp = req.nextUrl.searchParams;
  if (sp.get("overview") === "true") {
    const overview = await getFeedOverview();
    return NextResponse.json({ overview });
  }
  const items = await listFeedItems({
    type: sp.get("type") ?? undefined,
    category: sp.get("category") ?? undefined,
    region: sp.get("region") ?? undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : 50,
  });
  return NextResponse.json({ items, count: items.length });
}

export async function POST(req: NextRequest) {
  const body = await parseBody(req);
  const validation = validateBody(createFeedItemSchema, body);
  if (!validation.success) return validation.response;
  const item = await createFeedItem(validation.data);
  return NextResponse.json({ item });
}
