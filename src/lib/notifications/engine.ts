// Ghana Digital Twin — M15: Notification Engine
// User-facing activity notifications tying the consumer experience together.
// Notification types: ALERT_NEARBY, REPORT_VERIFIED, REPORT_REJECTED,
// WITNESS_REQUESTED, MISSION_PROGRESS, REWARD_EARNED, FEED_MENTION, SYSTEM.
//
// Generated when: reports need verification in user's region, the user's own
// reports get verified/rejected, missions the user joined make progress,
// rewards are earned, new feed items match the user's interests, system events.

import { db } from "@/lib/db";
import { timeAgo } from "@/lib/gdt/format";

export interface NotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  sourceType?: string;
  sourceId?: string;
  actionLabel?: string;
  actionView?: string;
}

export const NOTIFICATION_TYPES = [
  "ALERT_NEARBY",
  "REPORT_VERIFIED",
  "REPORT_REJECTED",
  "WITNESS_REQUESTED",
  "MISSION_PROGRESS",
  "REWARD_EARNED",
  "FEED_MENTION",
  "SYSTEM",
] as const;

export const NOTIFICATION_META: Record<
  string,
  { color: string; icon: string; label: string }
> = {
  ALERT_NEARBY: { color: "#f43f5e", icon: "AlertTriangle", label: "Nearby Alert" },
  REPORT_VERIFIED: { color: "#34d399", icon: "CheckCircle2", label: "Verified" },
  REPORT_REJECTED: { color: "#fb7185", icon: "XCircle", label: "Rejected" },
  WITNESS_REQUESTED: { color: "#fbbf24", icon: "Users", label: "Witness Needed" },
  MISSION_PROGRESS: { color: "#22d3ee", icon: "Target", label: "Mission Update" },
  REWARD_EARNED: { color: "#fbbf24", icon: "Award", label: "Reward Earned" },
  FEED_MENTION: { color: "#a78bfa", icon: "AtSign", label: "Mention" },
  SYSTEM: { color: "#71717a", icon: "Bell", label: "System" },
};

export async function createNotification(input: NotificationInput): Promise<any> {
  const seq = await db.notification.count({ where: { userId: input.userId } });
  const notificationId = `NT-2026-${String(seq + 1).padStart(4, "0")}`;
  const notif = await db.notification.create({
    data: {
      notificationId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      actionLabel: input.actionLabel ?? null,
      actionView: input.actionView ?? null,
    },
  });
  return serializeNotification(notif);
}

export async function listNotifications(
  userId: string,
  opts: { limit?: number; unreadOnly?: boolean } = {}
): Promise<any[]> {
  const { limit = 30, unreadOnly = false } = opts;
  const items = await db.notification.findMany({
    where: {
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return items.map(serializeNotification);
}

export async function getUnreadCount(userId: string): Promise<number> {
  return db.notification.count({
    where: { userId, readAt: null },
  });
}

export async function markRead(notificationId: string, userId: string): Promise<any> {
  const res = await db.notification.updateMany({
    where: { notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: res.count };
}

export async function markAllRead(userId: string): Promise<any> {
  const res = await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: res.count };
}

export async function getOverview(userId: string): Promise<any> {
  const [total, unread, byType] = await Promise.all([
    db.notification.count({ where: { userId } }),
    db.notification.count({ where: { userId, readAt: null } }),
    db.notification.groupBy({
      by: ["type"],
      where: { userId, readAt: null },
      _count: true,
    }),
  ]);
  return {
    total,
    unread,
    byType: byType.reduce((acc, r) => ({ ...acc, [r.type]: r._count }), {} as Record<string, number>),
  };
}

export function serializeNotification(n: any) {
  const meta = NOTIFICATION_META[n.type] ?? NOTIFICATION_META.SYSTEM;
  return {
    id: n.id,
    notificationId: n.notificationId,
    type: n.type,
    typeMeta: meta,
    title: n.title,
    body: n.body,
    sourceType: n.sourceType,
    sourceId: n.sourceId,
    actionLabel: n.actionLabel,
    actionView: n.actionView,
    read: !!n.readAt,
    readAt: n.readAt,
    createdAt: n.createdAt,
    createdAtLabel: timeAgo(n.createdAt),
  };
}
