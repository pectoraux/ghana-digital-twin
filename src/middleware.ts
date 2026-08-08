// Ghana Digital Twin — API Auth Middleware (Phase 0.1)
// Enforces session checks on all /api/* routes EXCEPT auth callbacks, public stats, and seed endpoints.
// This prevents the PII leak identified in the audit (e.g. /api/admin/users was unauthenticated).

import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // If we get here, the user has a valid session token (checked by withAuth)
    // Role-based checks for admin routes
    const path = req.nextUrl.pathname;
    const role = (req as any).nextauth?.token?.role as string | undefined;

    // Admin-only routes
    if (path.startsWith("/api/admin/") && role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden: admin access required" }, { status: 403 });
    }

    // Super-admin-only routes
    if (path.startsWith("/api/admin/system/") && role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden: super-admin access required" }, { status: 403 });
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Only allow authenticated requests to /api/* routes
      // Public routes are excluded via the matcher below
      authorized: ({ req }) => {
        // withAuth checks for the session token; if absent, redirect to login
        return Boolean(req.cookies.get("next-auth.session-token") || req.cookies.get("__Secure-next-auth.session-token"));
      },
    },
  }
);

// Match all /api/* routes EXCEPT:
// - /api/auth/* (NextAuth callbacks — must be public)
// - /api/seed-auth (initial seeding — must be public)
// - /api/stats (public dashboard stats — read-only, no PII)
// - /api/pipeline/schedule (cron-triggered — uses its own CRON_API_KEY auth)
// - /api/health (health check — must be public for monitoring)
// - /api/search (search — rate-limited at route level)
export const config = {
  matcher: [
    "/api/((?!auth|seed-auth|stats|pipeline/schedule|health|search).*)",
  ],
};
