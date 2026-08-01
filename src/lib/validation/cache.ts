// Ghana Digital Twin — Caching Layer
// Performance engineering: caches expensive operations (raster reads, STAC queries,
// feature vectors, product stats) to avoid redundant computation.

import { db } from "@/lib/db";

const memoryCache = new Map<string, { value: any; ts: number; ttl: number }>();
const MEMORY_TTL = 5 * 60 * 1000; // 5 min in memory

/**
 * Get a cached value (memory first, then DB).
 */
export async function getCached<T>(key: string, cacheType: string): Promise<T | null> {
  // check memory cache
  const mem = memoryCache.get(key);
  if (mem && Date.now() - mem.ts < mem.ttl) {
    // update hit count in DB (fire-and-forget)
    db.cacheEntry.updateMany({
      where: { cacheKey: key },
      data: { hitCount: { increment: 1 }, lastAccessedAt: new Date() },
    }).catch(() => {});
    return mem.value as T;
  }

  // check DB cache
  const entry = await db.cacheEntry.findUnique({ where: { cacheKey: key } });
  if (!entry) return null;

  // check TTL
  const ageSeconds = (Date.now() - entry.createdAt.getTime()) / 1000;
  if (ageSeconds > entry.ttlSeconds) {
    await db.cacheEntry.delete({ where: { id: entry.id } }).catch(() => {});
    return null;
  }

  // update hit count
  await db.cacheEntry.update({
    where: { id: entry.id },
    data: { hitCount: { increment: 1 }, lastAccessedAt: new Date() },
  }).catch(() => {});

  // store in memory
  const value = JSON.parse(entry.value);
  memoryCache.set(key, { value, ts: Date.now(), ttl: MEMORY_TTL });
  return value as T;
}

/**
 * Set a cached value (both memory and DB).
 */
export async function setCached(key: string, cacheType: string, value: any, ttlSeconds = 300): Promise<void> {
  // store in memory
  memoryCache.set(key, { value, ts: Date.now(), ttl: MEMORY_TTL });

  // store in DB (upsert)
  const valueStr = JSON.stringify(value);
  await db.cacheEntry.upsert({
    where: { cacheKey: key },
    update: {
      value: valueStr,
      ttlSeconds,
      sizeBytes: Buffer.byteLength(valueStr, "utf8"),
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    },
    create: {
      cacheKey: key,
      cacheType,
      value: valueStr,
      ttlSeconds,
      sizeBytes: Buffer.byteLength(valueStr, "utf8"),
    },
  }).catch(() => {});
}

/**
 * Get cache statistics.
 */
export async function getCacheStats(): Promise<any> {
  const [total, byType, totalHits, totalSize] = await Promise.all([
    db.cacheEntry.count(),
    db.cacheEntry.groupBy({ by: ["cacheType"], _count: true, _sum: { hitCount: true } }),
    db.cacheEntry.aggregate({ _sum: { hitCount: true } }),
    db.cacheEntry.aggregate({ _sum: { sizeBytes: true } }),
  ]);

  return {
    totalEntries: total,
    totalHits: totalHits._sum.hitCount ?? 0,
    totalSizeBytes: totalSize._sum.sizeBytes ?? 0,
    byType: byType.map((t) => ({
      type: t.cacheType,
      count: t._count,
      hits: t._sum.hitCount ?? 0,
    })),
  };
}

/**
 * Clear expired cache entries.
 */
export async function clearExpiredCache(): Promise<number> {
  const result = await db.cacheEntry.deleteMany({
    where: {
      createdAt: { lt: new Date(Date.now() - 3600000) }, // older than 1 hour
    },
  });
  // also clear memory cache
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (now - entry.ts > entry.ttl) {
      memoryCache.delete(key);
    }
  }
  return result.count;
}
