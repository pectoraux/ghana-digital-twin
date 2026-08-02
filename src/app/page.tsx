"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Shell } from "@/components/gdt/Shell";
import { CommunityAppShell } from "@/components/gdt/CommunityAppShell";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [identity, setIdentity] = useState<any>(null);

  useEffect(() => {
    fetch("/api/seed-auth", { method: "POST" }).catch(() => null);
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) { router.push("/login"); return; }
    // Fetch identity context
    const userId = (session.user as any)?.id;
    if (userId) {
      fetch(`/api/identity?userId=${userId}`)
        .then((r) => r.json())
        .then((d) => setIdentity(d.identity))
        .catch(() => setIdentity({}));
    }
  }, [session, status, router]);

  if (status === "loading" || !session) {
    return <div className="flex h-screen w-screen items-center justify-center bg-background"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  const role = (session.user as any)?.role;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const isDeveloper = role === "DEVELOPER";

  // Admin and Developer users get the full platform shell
  if (isAdmin || isDeveloper) {
    return <Shell />;
  }

  // Citizens, Guardians, Producers, Org members get the consumer app
  return <CommunityAppShell identity={identity} session={session} />;
}
