// Ghana Digital Twin — Rate Limiter (Phase 5.24)
// Simple in-memory rate limiter for API routes.
//
// The audit (§Phase 5) recommends: "Rate limiting and audit-log reliability
// — increasingly important once missions carry reputation/reward stakes
// that create an incentive to game the system."
//
// Usage in API routes:
//   import { checkRateLimit } from "@/lib/validation/rate-limit";
//   const rateLimit = checkRateLimit(req, "feed-post", 10, 60000); // 10 req/min
//   if (!rateLimit.allowed) return rateLimit.response;

import { NextRequest, NextResponse } from "next/server";

interface RateBucket {
  count: number;
  resetAt: number;
}

// In-memory store (resets on server restart — acceptable for app-tier rate limiting)
const buckets = new Map<string, RateBucket>();

// Clean up expired buckets every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

/**
 * Check rate limit for a request.
 * @param req The NextRequest to get the IP from
 * @param action The action being rate-limited (e.g. "feed-post", "withdraw")
 * @param maxRequests Maximum requests in the window
 * @param windowMs Time window in milliseconds
 * @returns { allowed: boolean, response?: NextResponse }
 */
export function checkRateLimit(
  req: NextRequest,
  action: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; response?: NextResponse; remaining?: number } {
  cleanup();

  // Get client identifier: IP + action
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
             req.headers.get("x-real-ip") ||
             "unknown";
  const key = `${action}:${ip}`;

  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt < now) {
    // New window
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  existing.count++;

  if (existing.count > maxRequests) {
    const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
    return {
      allowed: false,
      response: NextResponse.json(
        { error: "Rate limit exceeded", detail: `Too many requests. Try again in ${retryAfter}s.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      ),
    };
  }

  return { allowed: true, remaining: maxRequests - existing.count };
}

// Pre-configured rate limits for common actions
export const RATE_LIMITS = {
  feedPost: { action: "feed-post", max: 10, windowMs: 60_000 }, // 10/min
  feedEngage: { action: "feed-engage", max: 30, windowMs: 60_000 }, // 30/min
  communityEvent: { action: "community-event", max: 10, windowMs: 60_000 }, // 10/min
  witness: { action: "witness", max: 20, windowMs: 60_000 }, // 20/min
  withdraw: { action: "withdraw", max: 3, windowMs: 60_000 }, // 3/min
  missionJoin: { action: "mission-join", max: 10, windowMs: 60_000 }, // 10/min
  photoUpload: { action: "photo-upload", max: 5, windowMs: 60_000 }, // 5/min
  profileUpdate: { action: "profile-update", max: 5, windowMs: 60_000 }, // 5/min
  search: { action: "search", max: 30, windowMs: 60_000 }, // 30/min
} as const;
