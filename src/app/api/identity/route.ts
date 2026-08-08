import { NextRequest, NextResponse } from "next/server";
import { getIdentityContext, updateProfile } from "@/lib/identity/context-service";
import { seedCommunityApp } from "@/lib/feed/seed";
import { profileUpdateSchema, validateBody, parseBody } from "@/lib/validation/schemas";

export async function GET(req: NextRequest) {
  await seedCommunityApp().catch(() => null);
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const ctx = await getIdentityContext(userId);
  if (!ctx) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ identity: ctx });
}

export async function PATCH(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const body = await parseBody(req);
  const validation = validateBody(profileUpdateSchema, body);
  if (!validation.success) return validation.response;
  try {
    const updated = await updateProfile(userId, validation.data);
    return NextResponse.json({ profile: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
