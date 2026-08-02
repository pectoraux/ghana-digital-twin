import { NextRequest, NextResponse } from "next/server";
import { getIdentityContext } from "@/lib/identity/context-service";
import { seedCommunityApp } from "@/lib/feed/seed";

export async function GET(req: NextRequest) {
  await seedCommunityApp().catch(() => null);
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const ctx = await getIdentityContext(userId);
  if (!ctx) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ identity: ctx });
}
