// Ghana Digital Twin — M13.5: NextAuth configuration
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword } from "./password";
import { AuditLog } from "@prisma/client";
import { logger } from "@/lib/logging/logger";

// Phase 5.23a: Fixed audit-log reliability — no longer silently swallows failures.
// The audit (§Phase 5.24) noted: "audit-log reliability (currently logAudit()
// silently swallows failures) — increasingly important once missions carry
// reputation/reward stakes that create an incentive to game the system."
async function logAudit(action: string, actorId: string | null, actorName: string | null, actorRole: string | null, targetId?: string, targetName?: string, metadata?: any) {
  const logId = `LOG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  try {
    await db.auditLog.create({
      data: {
        logId,
        actorId, actorName, actorRole,
        action, targetId, targetName,
        metadata: JSON.stringify(metadata ?? {}),
      },
    });
  } catch (e: any) {
    // Phase 5.23a: Log the failure instead of silently swallowing it.
    // This makes audit-log failures visible in structured logs.
    logger.error("audit.log.failed", {
      logId,
      action,
      actorId,
      error: e.message?.slice(0, 200),
    });
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await db.user.findUnique({ where: { email: credentials.email } });
        if (!user) return null;
        if (user.status !== "ACTIVE") return null;
        const valid = await verifyPassword(credentials.password, user.passwordHash);
        if (!valid) return null;

        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        await logAudit("USER_LOGIN", user.id, user.name, user.role, user.id, user.email);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          citizenId: (user as any).citizenId,
        } as any;
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = (user as any).id;
        token.citizenId = (user as any).citizenId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).citizenId = token.citizenId;
      }
      return session;
    },
  },
};

export { logAudit };
