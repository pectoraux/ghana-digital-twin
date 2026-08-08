import { NextRequest, NextResponse } from "next/server";
import { engageWithFeedItem } from "@/lib/feed/engine";
import { feedEngagementSchema, validateBody, parseBody } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const body = await parseBody(req);
  const validation = validateBody(feedEngagementSchema, body);
  if (!validation.success) return validation.response;
  try {
    const eng = await engageWithFeedItem(validation.data);
    return NextResponse.json({ engagement: eng });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
