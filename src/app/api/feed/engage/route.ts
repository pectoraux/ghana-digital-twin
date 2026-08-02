import { NextRequest, NextResponse } from "next/server";
import { engageWithFeedItem } from "@/lib/feed/engine";

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const eng = await engageWithFeedItem(body);
    return NextResponse.json({ engagement: eng });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
