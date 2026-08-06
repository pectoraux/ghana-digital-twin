// Ghana Digital Twin — M15: Notification Seed
// Generates contextual notifications for a user based on their profile, region,
// and the current state of the platform (feed items, community events needing
// witnesses, active missions, reward activity).

import { db } from "@/lib/db";
import { createNotification } from "./engine";
import { REGIONS } from "@/lib/gdt/geo";

// Map region name → region id (e.g. "Western" → "wst")
const REGION_NAME_TO_ID: Record<string, string> = Object.fromEntries(
  REGIONS.map((r) => [r.name, r.id])
);
// Also map name → name for feed items (which use full names like "Western North")
const REGION_ID_TO_NAME: Record<string, string> = Object.fromEntries(
  REGIONS.map((r) => [r.id, r.name])
);

export async function seedNotificationsForUser(userId: string): Promise<number> {
  // Skip if already seeded (has any notifications)
  const existing = await db.notification.count({ where: { userId } });
  if (existing > 0) return 0;

  const [user, profile] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.userProfile.findUnique({ where: { userId } }).catch(() => null),
  ]);
  if (!user) return 0;

  const userRegionName = profile?.region ?? "Greater Accra";
  const userRegionId = REGION_NAME_TO_ID[userRegionName] ?? "gar";
  const userName = profile?.displayName ?? user.name ?? "there";

  // Gather relevant data in parallel
  const [
    nearbyFeed,
    witnessingEvents,
    activeMissions,
    recentFeedAnnouncements,
  ] = await Promise.all([
    // Feed items in user's region OR Ghana-wide
    db.feedItem
      .findMany({
        where: {
          OR: [{ region: userRegionName }, { region: "Ghana" }, { region: "West Africa" }],
        },
        orderBy: { publishedAt: "desc" },
        take: 3,
      })
      .catch(() => []),
    // Community events needing witnesses
    db.citizenEvent
      .findMany({
        where: { status: "witnessing" },
        orderBy: { reportedAt: "desc" },
        take: 3,
      })
      .catch(() => []),
    // Active missions
    db.mission
      .findMany({
        where: { status: { in: ["planned", "in_progress", "active"] } },
        orderBy: { createdAt: "desc" },
        take: 2,
      })
      .catch(() => []),
    // Recent announcements
    db.feedItem
      .findMany({
        where: { type: "ANNOUNCEMENT" },
        orderBy: { publishedAt: "desc" },
        take: 1,
      })
      .catch(() => []),
  ]);

  let count = 0;

  // 1. ALERT_NEARBY — recent feed alerts in user's region
  for (const item of nearbyFeed.slice(0, 2)) {
    if (item.type === "ALERT" || item.type === "REPORT") {
      await createNotification({
        userId,
        type: "ALERT_NEARBY",
        title: `${item.type === "ALERT" ? "Alert" : "Report"} in ${item.region ?? userRegionName}: ${item.title}`,
        body: item.summary,
        sourceType: "feed_item",
        sourceId: item.feedItemId,
        actionLabel: "View in Feed",
        actionView: "feed",
      });
      count++;
    }
  }

  // 2. WITNESS_REQUESTED — community events needing verification
  for (const ev of witnessingEvents.slice(0, 2)) {
    const regionName = REGION_ID_TO_NAME[ev.regionId ?? ""] ?? ev.regionId ?? "Ghana";
    await createNotification({
      userId,
      type: "WITNESS_REQUESTED",
      title: `Witness needed: ${ev.title}`,
      body: `A community report in ${regionName} needs your verification. Help confirm or reject this event.`,
      sourceType: "community_event",
      sourceId: ev.eventId,
      actionLabel: "Verify Report",
      actionView: "community",
    });
    count++;
  }

  // 3. MISSION_PROGRESS — active missions the user could join
  for (const m of activeMissions.slice(0, 1)) {
    await createNotification({
      userId,
      type: "MISSION_PROGRESS",
      title: `New mission available: ${m.title}`,
      body: `An intelligence mission has been launched near you. Join to earn rewards and contribute to verification.`,
      sourceType: "mission",
      sourceId: m.id,
      actionLabel: "Join Mission",
      actionView: "missions",
    });
    count++;
  }

  // 4. REWARD_EARNED — simulate a recent reward (based on user's report activity)
  if (user.role === "CITIZEN" || user.role === "COMMUNITY_GUARDIAN") {
    await createNotification({
      userId,
      type: "REWARD_EARNED",
      title: `You earned 45 IC from a verified report`,
      body: `Your recent community report was verified by 3 witnesses. 45 Intelligence Credits have been added to your rewards balance.`,
      sourceType: "reward",
      sourceId: `RDW-${Date.now().toString(36).toUpperCase()}`,
      actionLabel: "View Rewards",
      actionView: "rewards",
    });
    count++;
  }

  // 5. REPORT_VERIFIED — simulate a report the user filed getting verified
  if (user.role === "CITIZEN") {
    await createNotification({
      userId,
      type: "REPORT_VERIFIED",
      title: `Your report "Discolored water in stream" was verified`,
      body: `2 community guardians confirmed your report near Ahafo mining site. Confidence increased to 87%.`,
      sourceType: "community_event",
      sourceId: "CE-2026-0006",
      actionLabel: "View Report",
      actionView: "community",
    });
    count++;
  }

  // 6. FEED_MENTION / ANNOUNCEMENT — recent announcement
  for (const ann of recentFeedAnnouncements.slice(0, 1)) {
    await createNotification({
      userId,
      type: "FEED_MENTION",
      title: `${ann.creatorName} posted: ${ann.title}`,
      body: ann.summary,
      sourceType: "feed_item",
      sourceId: ann.feedItemId,
      actionLabel: "View Announcement",
      actionView: "feed",
    });
    count++;
  }

  // 7. SYSTEM — welcome / onboarding
  await createNotification({
    userId,
    type: "SYSTEM",
    title: `Welcome to Ghana Digital Twin, ${userName.split(" ")[0]}!`,
    body: `Your intelligence dashboard is ready. Report events, verify community reports, and earn rewards for keeping Ghana safe.`,
    actionLabel: "Get Started",
    actionView: "home",
  });
  count++;

  return count;
}

// Seed notifications for ALL demo users (called on first API hit)
export async function seedAllNotifications(): Promise<number> {
  const users = await db.user.findMany({ where: { isDemo: true } });
  let total = 0;
  for (const u of users) {
    total += await seedNotificationsForUser(u.id).catch(() => 0);
  }
  return total;
}
