"use client";

import { useGDT } from "@/lib/gdt/store";
import type { ViewId } from "@/lib/gdt/types";
import { cn } from "@/lib/utils";
import {
  Home,
  Eye,
  Map as MapIcon,
  Crosshair,
  Users,
  Award,
  User,
} from "lucide-react";

// Mobile bottom navigation — mirrors the 7 primary consumer nav items from
// NavRail. Hidden on desktop (md+), where the vertical NavRail takes over.
const MOBILE_NAV: { id: ViewId; label: string; icon: React.ElementType }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "feed", label: "Feed", icon: Eye },
  { id: "atlas", label: "Map", icon: MapIcon },
  { id: "missions", label: "Missions", icon: Crosshair },
  { id: "community", label: "Community", icon: Users },
  { id: "rewards", label: "Rewards", icon: Award },
  { id: "profile", label: "Profile", icon: User },
];

export function MobileBottomNav() {
  const view = useGDT((s) => s.view);
  const setView = useGDT((s) => s.setView);

  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        "md:hidden flex shrink-0 items-stretch justify-around",
        "border-t border-border bg-card/95 backdrop-blur",
        "pb-[env(safe-area-inset-bottom)]",
        "z-40"
      )}
    >
      {MOBILE_NAV.map((item) => {
        const active = view === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-[56px] min-w-[44px] flex-1 flex-col items-center justify-center gap-1",
              "transition-colors",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-5" />
            <span className="text-[10px] font-medium leading-none">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
