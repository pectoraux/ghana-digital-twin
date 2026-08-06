"use client";

import { useGDT } from "@/lib/gdt/store";
import type { ViewId } from "@/lib/gdt/types";
import { cn } from "@/lib/utils";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  Map as MapIcon, Eye, Clock, Brain, Crosshair, ShieldCheck, Puzzle,
  Radar, CheckCircle2, Layers3, Boxes, Share2, Database, Satellite,
  Grid3x3, RadioTower, Users, Network, Store, Coins, Globe, Activity,
  Scale, Building2, Terminal, Settings, LogOut, Sun, Moon,
  ChevronDown, ChevronUp, Home, Bell, Award,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Consumer-facing primary nav — what a normal user thinks in
const PRIMARY_NAV: { id: ViewId; label: string; icon: React.ElementType; hint: string }[] = [
  { id: "home", label: "Home", icon: Home, hint: "Intelligence dashboard" },
  { id: "feed", label: "Intelligence Feed", icon: Eye, hint: "Latest verified intelligence" },
  { id: "atlas", label: "Map", icon: MapIcon, hint: "Live intelligence map" },
  { id: "missions", label: "Missions", icon: Crosshair, hint: "Active intelligence missions" },
  { id: "community", label: "Community", icon: Users, hint: "Citizen intelligence network" },
  { id: "rewards", label: "Rewards", icon: Award, hint: "Your earnings and reputation" },
  { id: "profile", label: "Profile", icon: Users, hint: "Your identity, reputation, and impact" },
];

// Advanced console — power users only, collapsed by default
const ADVANCED_NAV: { id: ViewId; label: string; icon: React.ElementType; hint: string }[] = [
  { id: "command", label: "Command Center", icon: RadioTower, hint: "Incidents, workflows, evidence rooms" },
  { id: "civic-trust", label: "Trust Graph", icon: Network, hint: "Trust propagation, Sybil resistance" },
  { id: "marketplace", label: "Marketplace", icon: Store, hint: "Intelligence marketplace" },
  { id: "finance", label: "Finance", icon: Coins, hint: "Credits, licensing, royalties" },
  { id: "federation", label: "Federation", icon: Globe, hint: "Cross-border intelligence" },
  { id: "os", label: "OS Marketplace", icon: Boxes, hint: "Package registry, developers" },
  { id: "reality", label: "Reality Feed", icon: Activity, hint: "Continuous ingestion" },
  { id: "governance", label: "Governance", icon: Scale, hint: "Constitution, council, courts" },
  { id: "gov-intel", label: "Gov Intelligence", icon: Brain, hint: "Governance agents, precedents" },
  { id: "aio", label: "Organizations", icon: Building2, hint: "Autonomous intelligence organizations" },
  { id: "phenomena", label: "Phenomena", icon: Clock, hint: "Evolving events" },
  { id: "validation", label: "Validation", icon: ShieldCheck, hint: "Replay testing, evaluation" },
  { id: "extensions", label: "Extensions", icon: Puzzle, hint: "Domain extensions" },
  { id: "continuous", label: "Continuous", icon: Radar, hint: "Nationwide pipeline" },
  { id: "groundtruth", label: "Ground Truth", icon: CheckCircle2, hint: "Active learning, calibration" },
  { id: "multimodal", label: "Multi-Modal", icon: Layers3, hint: "Multi-modal evidence fusion" },
  { id: "entities", label: "Entities", icon: Boxes, hint: "Entity registry" },
  { id: "graph", label: "Entity Graph", icon: Share2, hint: "Entity relationship graph" },
  { id: "knowledge", label: "Env Knowledge", icon: Brain, hint: "Domain knowledge graph" },
  { id: "eo", label: "Earth Observation", icon: Satellite, hint: "Sentinel-2 imagery" },
  { id: "raster", label: "Raster Intelligence", icon: Grid3x3, hint: "Anomaly maps" },
  { id: "sources", label: "Data Sources", icon: Database, hint: "Pipeline & connectors" },
  { id: "api", label: "API", icon: Terminal, hint: "Programmatic access" },
];

export function NavRail() {
  const view = useGDT((s) => s.view);
  const setView = useGDT((s) => s.setView);
  const setPaletteOpen = useGDT((s) => s.setPaletteOpen);
  const navExpanded = useGDT((s) => s.navExpanded);
  const setNavExpanded = useGDT((s) => s.setNavExpanded);
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();

  const userName = session?.user?.name ?? "User";
  const userRole = (session?.user as any)?.role ?? "CITIZEN";
  const initials = userName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const renderNavItem = (item: { id: ViewId; label: string; icon: React.ElementType; hint: string }) => {
    const active = view === item.id;
    const Icon = item.icon;
    return (
      <Tooltip key={item.id + item.label}>
        <TooltipTrigger asChild>
          <button
            onClick={() => setView(item.id)}
            className={cn(
              "group relative flex size-10 items-center justify-center rounded-lg transition-all",
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {active && (
              <span className="absolute left-[-10px] top-1/2 h-5 -translate-y-1/2 w-[3px] rounded-full bg-primary" />
            )}
            <Icon className="size-[18px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <div className="font-medium">{item.label}</div>
          <div className="text-[14px] text-muted-foreground">{item.hint}</div>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <nav className="hidden md:flex w-[56px] shrink-0 flex-col items-center border-r border-border bg-sidebar/60 py-2">
        {/* Logo mark */}
        <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary/15 border border-primary/30 text-primary">
          <svg viewBox="0 0 24 24" className="size-5" fill="none">
            <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M12 2v20M3 7l9 5 9-5" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
          </svg>
        </div>

        {/* Primary consumer nav */}
        <div className="flex flex-col gap-1">
          {PRIMARY_NAV.map(renderNavItem)}
        </div>

        {/* Advanced console expand/collapse */}
        <button
          onClick={() => setNavExpanded(!navExpanded)}
          className="mt-2 flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <span className="text-[8px] font-medium uppercase tracking-wider">Advanced</span>
          {navExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        </button>

        {/* Advanced nav (collapsed by default) */}
        {navExpanded && (
          <div className="mt-1 flex max-h-[35vh] flex-col gap-1 overflow-y-auto gdt-scroll">
            {ADVANCED_NAV.map(renderNavItem)}
          </div>
        )}

        {/* Bottom: user controls */}
        <div className="mt-auto flex flex-col gap-1">
          {/* Theme toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Toggle {theme === "dark" ? "light" : "dark"} mode
            </TooltipContent>
          </Tooltip>

          {/* Command palette */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setPaletteOpen(true)}
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <kbd className="text-[13px] font-mono border border-border rounded px-1 py-0.5">⌘K</kbd>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Command palette
            </TooltipContent>
          </Tooltip>

          {/* Settings */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <Settings className="size-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Settings
            </TooltipContent>
          </Tooltip>

          {/* User avatar */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 border border-primary/30 text-primary text-[14px] font-semibold cursor-default">
                {initials}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <div className="font-medium">{userName}</div>
              <div className="text-[14px] text-muted-foreground">{userRole.replace(/_/g, " ").toLowerCase()}</div>
            </TooltipContent>
          </Tooltip>

          {/* Logout */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
              >
                <LogOut className="size-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Logout
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>
    </TooltipProvider>
  );
}
