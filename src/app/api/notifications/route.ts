// Ghana Digital Twin — M15: Notifications API
// GET  /api/notifications?limit=30&unreadOnly=false  → list notifications for current user
// POST /api/notifications { action: "markRead"|"markAllRead", notificationId? } → mark read
// Also auto-seeds notifications for the user on first access.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth";
import {
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  getOverview,
} from "@/lib/notifications/engine";
import { seedNotificationsForUser } from "@/lib/notifications/seed";

async function getUserId(req: NextRequest): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as any)?.id;
  if (sessionUserId) return sessionUserId;
  // fallback to query param for demo / client-side calls
  const url = new URL(req.url);
  return url.searchParams.get("userId");
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Auto-seed on first access
  try {
    await seedNotificationsForUser(userId);
  } catch (e) {
    // non-fatal
  }

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") ?? "30");
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  const mode = url.searchParams.get("mode");

  if (mode === "count") {
    const unread = await getUnreadCount(userId);
    return NextResponse.json({ unread });
  }
  if (mode === "overview") {
    const overview = await getOverview(userId);
    return NextResponse.json(overview);
  }

  const items = await listNotifications(userId, { limit, unreadOnly });
  const unread = await getUnreadCount(userId);
  return NextResponse.json({ items, unread });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { action, notificationId } = body;

  if (action === "markAllRead") {
    const res = await markAllRead(userId);
    return NextResponse.json(res);
  }
  if (action === "markRead" && notificationId) {
    const res = await markRead(notificationId, userId);
    return NextResponse.json(res);
  }
  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
