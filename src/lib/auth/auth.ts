// Ghana Digital Twin — M13.5: NextAuth configuration
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword } from "./password";
import { AuditLog } from "@prisma/client";

async function logAudit(action: string, actorId: string | null, actorName: string | null, actorRole: string | null, targetId?: string, targetName?: string, metadata?: any) {
  try {
    await db.auditLog.create({
      data: {
        logId: `LOG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
        actorId, actorName, actorRole,
        action, targetId, targetName,
        metadata: JSON.stringify(metadata ?? {}),
      },
    });
  } catch {}
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
