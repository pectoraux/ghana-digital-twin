// Ghana Digital Twin — M14: Intelligence Feed Engine
// Personalized intelligence feed. Like YouTube Home + Twitter timeline + intelligence dashboard.
// Feed item types: ALERT, REPORT, ANALYSIS, MISSION, DISCUSSION, ASSET, ANNOUNCEMENT.

import { db } from "@/lib/db";

export interface FeedItemInput {
  type: string;
  creatorId: string;
  creatorName: string;
  creatorRole: string;
  organizationId?: string;
  organizationName?: string;
  title: string;
  summary: string;
  body?: string;
  category: string;
  region?: string;
  trustScore?: number;
  confidence?: number;
  sourceType?: string;
  sourceId?: string;
}

export async function createFeedItem(input: FeedItemInput): Promise<any> {
  const feedItemId = `FI-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const item = await db.feedItem.create({
    data: {
      feedItemId,
      type: input.type,
      creatorId: input.creatorId,
      creatorName: input.creatorName,
      creatorRole: input.creatorRole,
      organizationId: input.organizationId ?? null,
      organizationName: input.organizationName ?? null,
      title: input.title,
      summary: input.summary,
      body: input.body ?? null,
      category: input.category,
      region: input.region ?? null,
      trustScore: input.trustScore ?? 50,
      confidence: input.confidence ?? 0.5,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      status: "published",
    },
  });
  return serializeFeedItem(item);
}

export async function listFeedItems(filter: {
  type?: string;
  category?: string;
  region?: string;
  limit?: number;
} = {}): Promise<any[]> {
  const where: any = { status: "published" };
  if (filter.type) where.type = filter.type;
  if (filter.category) where.category = filter.category;
  if (filter.region) where.region = filter.region;
  const rows = await db.feedItem.findMany({ where, orderBy: { publishedAt: "desc" }, take: filter.limit ?? 50 });
  return rows.map(serializeFeedItem);
}

export async function getFeedItem(feedItemId: string): Promise<any | null> {
  const item = await db.feedItem.findUnique({ where: { feedItemId } });
  if (!item) return null;
  // Increment view count
  await db.feedItem.update({ where: { feedItemId }, data: { viewCount: { increment: 1 } } });
  return serializeFeedItem({ ...item, viewCount: item.viewCount + 1 });
}

export async function listComments(feedItemId: string, limit = 50): Promise<any[]> {
  const comments = await db.feedEngagement.findMany({
    where: { feedItemId, type: "comment" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return comments.map((c: any) => ({
    id: c.id,
    engagementId: c.engagementId,
    feedItemId: c.feedItemId,
    userId: c.userId,
    userName: c.userName,
    content: c.content,
    createdAt: c.createdAt,
  }));
}

export async function engageWithFeedItem(input: {
  feedItemId: string;
  userId: string;
  userName: string;
  type: string; // like | comment | share | flag
  content?: string;
}): Promise<any> {
  const engagementId = `ENG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const eng = await db.feedEngagement.create({
    data: {
      engagementId,
      feedItemId: input.feedItemId,
      userId: input.userId,
      userName: input.userName,
      type: input.type,
      content: input.content ?? null,
    },
  });

  // Update counts
  if (input.type === "like") await db.feedItem.update({ where: { feedItemId: input.feedItemId }, data: { likeCount: { increment: 1 } } });
  if (input.type === "comment") await db.feedItem.update({ where: { feedItemId: input.feedItemId }, data: { commentCount: { increment: 1 } } });

  return eng;
}

export async function getFeedOverview(): Promise<any> {
  const [total, alerts, reports, analyses, missions, assets, announcements] = await Promise.all([
    db.feedItem.count({ where: { status: "published" } }),
    db.feedItem.count({ where: { status: "published", type: "ALERT" } }),
    db.feedItem.count({ where: { status: "published", type: "REPORT" } }),
    db.feedItem.count({ where: { status: "published", type: "ANALYSIS" } }),
    db.feedItem.count({ where: { status: "published", type: "MISSION" } }),
    db.feedItem.count({ where: { status: "published", type: "ASSET" } }),
    db.feedItem.count({ where: { status: "published", type: "ANNOUNCEMENT" } }),
  ]);
  const recent = await db.feedItem.findMany({ where: { status: "published" }, orderBy: { publishedAt: "desc" }, take: 10 });
  return {
    counts: { total, alerts, reports, analyses, missions, assets, announcements },
    recent: recent.map(serializeFeedItem),
  };
}

function serializeFeedItem(f: any) {
  return {
    id: f.id, feedItemId: f.feedItemId,
    type: f.type,
    creatorId: f.creatorId, creatorName: f.creatorName, creatorRole: f.creatorRole, creatorAvatar: f.creatorAvatar,
    organizationId: f.organizationId, organizationName: f.organizationName,
    title: f.title, summary: f.summary, body: f.body,
    category: f.category, region: f.region,
    trustScore: f.trustScore, confidence: f.confidence,
    sourceType: f.sourceType, sourceId: f.sourceId,
    viewCount: f.viewCount, likeCount: f.likeCount, commentCount: f.commentCount,
    status: f.status, publishedAt: f.publishedAt,
  };
}
