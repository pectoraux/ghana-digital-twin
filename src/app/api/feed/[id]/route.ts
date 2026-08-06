// GET  /api/feed/[id] → single feed item (increments view count) + comments
import { NextRequest, NextResponse } from "next/server";
import { getFeedItem, listComments } from "@/lib/feed/engine";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await getFeedItem(id);
  if (!item) {
    return NextResponse.json({ error: "Feed item not found" }, { status: 404 });
  }
  const comments = await listComments(id).catch(() => []);
  return NextResponse.json({ item, comments });
}
