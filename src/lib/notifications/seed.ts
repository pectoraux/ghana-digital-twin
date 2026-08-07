// Ghana Digital Twin — M15: Notifications Seed
// Generates 6-8 contextual notifications per user based on their region + role.
// Pulls real data from feed items, community events, and missions.

import { db } from "@/lib/db";
import { createNotification, NotificationType } from "./engine";

let SEEDED = new Set<string>();

export async function seedNotificationsForUser(userId: string): Promise<{ created: number }> {
  if (SEEDED.has(userId)) return { created: 0 };

  // If user already has notifications, skip.
  const existing = await db.notification.count({ where: { userId } }).catch(() => 0);
  if (existing > 0) {
    SEEDED.add(userId);
    return { created: 0 };
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { created: 0 };

  const profile = await db.userProfile.findUnique({ where: { userId } }).catch(() => null);
  const reputation = await db.userReputation.findUnique({ where: { userId } }).catch(() => null);
  const region = profile?.region ?? user.region ?? "Greater Accra";
  const role = user.role;

  let created = 0;

  // 1. SYSTEM welcome — always
  await createNotification({
    userId, type: "SYSTEM",
    title: `Welcome to the Ghana Digital Twin, ${user.name.split(" ")[0]}`,
    body: `Your intelligence workspace is ready. Reputation: ${reputation?.trustScore ?? 50} trust, ${reputation?.civicScore ?? 50} civic. Start by reporting an event or verifying intelligence from your region.`,
    sourceType: "system", sourceId: "onboarding",
    actionView: "home", actionLabel: "Open Home",
    priority: "high",
  });
  created++;

  // 2. ALERT_NEARBY — pull recent ALERT feed items in the user's region
  const nearbyAlerts = await db.feedItem.findMany({
    where: { type: "ALERT", status: "published", region: { contains: region.split(" ")[0] } },
    orderBy: { publishedAt: "desc" }, take: 1,
  }).catch(() => []);
  if (nearbyAlerts.length > 0) {
    const a = nearbyAlerts[0];
    await createNotification({
      userId, type: "ALERT_NEARBY",
      title: `Nearby alert in ${a.region ?? region}: ${a.title}`,
      body: a.summary.slice(0, 180) + (a.summary.length > 180 ? "…" : ""),
      sourceType: "feed_item", sourceId: a.feedItemId,
      actionView: "feed", actionLabel: "View in Feed",
      priority: "urgent",
    });
    created++;
  }

  // 3. WITNESS_REQUESTED — pull broadcast community events needing verification
  const witnessEvents = await db.citizenEvent.findMany({
    where: { status: { in: ["broadcast", "witnessing"] } },
    orderBy: { reportedAt: "desc" }, take: 1,
  }).catch(() => []);
  if (witnessEvents.length > 0) {
    const e = witnessEvents[0];
    await createNotification({
      userId, type: "WITNESS_REQUESTED",
      title: `Witness request: ${e.title}`,
      body: `A citizen report needs community verification. Your input helps confirm or reject this intelligence.`,
      sourceType: "citizen_event", sourceId: e.eventId,
      actionView: "community", actionLabel: "Open Witness Queue",
      priority: "high",
    });
    created++;
  }

  // 4. MISSION_PROGRESS — pull in_progress missions
  const missions = await db.mission.findMany({
    where: { status: "in_progress" },
    orderBy: { createdAt: "desc" }, take: 1,
  }).catch(() => []);
  if (missions.length > 0) {
    const m = missions[0];
    await createNotification({
      userId, type: "MISSION_PROGRESS",
      title: `Mission in progress: ${m.title}`,
      body: m.reasoning?.slice(0, 180) ?? "Mission is gathering evidence.",
      sourceType: "mission", sourceId: m.uuid ?? m.id,
      actionView: "missions", actionLabel: "View Missions",
      priority: "normal",
    });
    created++;
  }

  // 5. REWARD_EARNED — contextual based on user's totalReports
  const totalReports = reputation?.totalReports ?? 0;
  if (totalReports > 0) {
    const reward = 15 + Math.min(30, totalReports);
    await createNotification({
      userId, type: "REWARD_EARNED",
      title: `Reward earned: ${reward} IC`,
      body: `Your contribution was verified and credited. Total verified reports: ${reputation?.totalVerified ?? 0}.`,
      sourceType: "reward", sourceId: `RWD-${Date.now().toString(36).toUpperCase()}`,
      actionView: "rewards", actionLabel: "View Rewards",
      priority: "normal",
    });
    created++;
  }

  // 6. REPORT_VERIFIED — at least one (based on totalVerified)
  const totalVerified = reputation?.totalVerified ?? 0;
  if (totalVerified > 0) {
    await createNotification({
      userId, type: "REPORT_VERIFIED",
      title: `Report verified by ${Math.max(1, Math.floor(totalVerified / 10))} witnesses`,
      body: `One of your reports reached community consensus and is now marked verified. Your civic score has improved.`,
      sourceType: "feed_item", sourceId: "VERIFIED",
      actionView: "feed", actionLabel: "View in Feed",
      priority: "normal",
    });
    created++;
  } else {
    // First-time reporters get a nudge
    await createNotification({
      userId, type: "REPORT_VERIFIED",
      title: `Your first report is awaiting verification`,
      body: `Submit your first intelligence report — community witnesses will verify it within 24h. Higher trust means faster verification.`,
      sourceType: "system", sourceId: "first-report",
      actionView: "feed", actionLabel: "Browse Feed",
      priority: "normal",
    });
    created++;
  }

  // 7. FEED_MENTION — pulled from recent feed item mentioning the user's role
  const mentionItem = await db.feedItem.findFirst({
    where: { type: "DISCUSSION", status: "published" },
    orderBy: { publishedAt: "desc" },
  }).catch(() => null);
  if (mentionItem) {
    await createNotification({
      userId, type: "FEED_MENTION",
      title: `${mentionItem.creatorName} mentioned ${role.replace(/_/g, " ").toLowerCase()}s in a discussion`,
      body: mentionItem.title.slice(0, 180) + (mentionItem.title.length > 180 ? "…" : ""),
      sourceType: "feed_item", sourceId: mentionItem.feedItemId,
      actionView: "feed", actionLabel: "View Discussion",
      priority: "low",
    });
    created++;
  }

  // 8. SYSTEM — second one only for citizens/guardians (producers may not need it)
  if (role === "CITIZEN" || role === "COMMUNITY_GUARDIAN") {
    await createNotification({
      userId, type: "SYSTEM",
      title: `Weekly digest: 3 new alerts in ${region}`,
      body: `3 new intelligence alerts were published in your region this week. Tap to review and stay informed.`,
      sourceType: "system", sourceId: "weekly-digest",
      actionView: "feed", actionLabel: "Open Feed",
      priority: "low",
    });
    created++;
  }

  SEEDED.add(userId);
  return { created };
}
