"use client";

import { useGDT } from "@/lib/gdt/store";
import { REGIONS } from "@/lib/gdt/geo";
import { OBSERVATIONS } from "@/lib/gdt/observations";
import { cn } from "@/lib/utils";
import { useSession, signOut } from "next-auth/react";
import {
  Search, Radio, Clock, ChevronDown, ShieldCheck, Activity, LogOut,
} from "lucide-react";
import { NotificationCenter } from "./NotificationCenter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "./atoms";
import { fmtInt } from "@/lib/gdt/format";

const VIEW_TITLES: Record<string, { title: string; sub: string }> = {
  home: { title: "Home", sub: "Your intelligence dashboard" },
  feed: { title: "Intelligence Feed", sub: "Latest verified intelligence from across the network" },
  atlas: { title: "Map", sub: "Live intelligence map of Ghana" },
  observations: { title: "Observations", sub: "Fused evidence from multiple raster products" },
  phenomena: { title: "Phenomena", sub: "Evolving events tracked over time" },
  intelligence: { title: "Intelligence", sub: "Ranked hypotheses, Bayesian reasoning & scenarios" },
  missions: { title: "Missions", sub: "Join intelligence missions and earn rewards" },
  validation: { title: "Validation", sub: "Replay testing, scientific evaluation & observability" },
  extensions: { title: "Extensions", sub: "Domain extensions: mining, flood, agriculture, forestry" },
  continuous: { title: "Continuous Pipeline", sub: "Nationwide processing & learning engine" },
  groundtruth: { title: "Ground Truth", sub: "Active learning, calibration & drift detection" },
  multimodal: { title: "Multi-Modal", sub: "Multi-modal evidence fusion & feature store" },
  entities: { title: "Entities", sub: "Entity registry & version history" },
  graph: { title: "Entity Graph", sub: "Geospatial relationship graph" },
  knowledge: { title: "Environmental Knowledge", sub: "Domain knowledge graph" },
  eo: { title: "Earth Observation", sub: "Sentinel-2 imagery & spectral indices" },
  raster: { title: "Raster Intelligence", sub: "Anomaly maps, baselines & uncertainty" },
  sources: { title: "Data Sources", sub: "Ingestion pipeline & connectors" },
  command: { title: "Command Center", sub: "National intelligence command: incidents, workflows, decisions, evidence rooms" },
  community: { title: "Community", sub: "Citizen intelligence network — reports, witnesses, and reputation" },
  "civic-trust": { title: "Civic Trust Graph", sub: "Trust propagation, Sybil resistance, identity vouching" },
  marketplace: { title: "Intelligence Marketplace", sub: "Requests, assets, bounties, value attribution" },
  finance: { title: "Intelligence Finance", sub: "Credits, licensing, royalties, agent economy, insurance" },
  federation: { title: "Federated Intelligence Network", sub: "Cross-border intelligence: nodes, trust proofs, treaties, markets" },
  os: { title: "Intelligence OS Marketplace", sub: "Package registry, developer economy, solutions, intelligence graph" },
  reality: { title: "Intelligence Reality Feed", sub: "Continuous ingestion, freshness monitoring, observation triggers" },
  governance: { title: "Intelligence Governance", sub: "Constitution, council, courts, proposals — who governs the civilization" },
  "gov-intel": { title: "Governance Intelligence", sub: "Governance agents, legal precedents, institutional reputation, compliance audits" },
  aio: { title: "Autonomous Organizations", sub: "Digital institutions: treasury, agents, objectives, charters, services" },
  profile: { title: "Profile", sub: "Your identity, reputation, and impact" },
  rewards: { title: "Rewards", sub: "Your earnings, reputation progress, and contribution impact" },
  api: { title: "API", sub: "Programmatic access primitives" },
};

export function CommandBar() {
  const view = useGDT((s) => s.view);
  const temporalMode = useGDT((s) => s.temporalMode);
  const setTemporalMode = useGDT((s) => s.setTemporalMode);
  const setPaletteOpen = useGDT((s) => s.setPaletteOpen);
  const obsFilter = useGDT((s) => s.obsFilter);
  const setObsFilter = useGDT((s) => s.setObsFilter);
  const { data: session } = useSession();

  const userName = session?.user?.name ?? "User";
  const userRole = (session?.user as any)?.role ?? "CITIZEN";
  const initials = userName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const meta = VIEW_TITLES[view] ?? { title: "Ghana Digital Twin", sub: "Geospatial world model" };
  const activeCount = OBSERVATIONS.filter((o) => o.status === "active").length;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/40 px-3">
      {/* Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex flex-col leading-tight min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold truncate">{meta.title}</h1>
            <Badge variant="outline" className="h-4 px-1 text-[13px] font-mono text-muted-foreground border-border">
              v4.2.0
            </Badge>
          </div>
          <span className="text-[15px] text-muted-foreground truncate">{meta.sub}</span>
        </div>
      </div>

      {/* Search */}
      <button
        onClick={() => setPaletteOpen(true)}
        className="group ml-2 flex h-9 w-[280px] items-center gap-2 rounded-lg border border-border bg-background/60 px-3 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-background"
      >
        <Search className="size-4" />
        <span className="text-xs">Search entities, observations, regions…</span>
        <kbd className="ml-auto text-[13px] font-mono border border-border rounded px-1 py-0.5">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        {/* Active observations indicator */}
        <div className="hidden lg:flex items-center gap-2 rounded-lg border border-border bg-background/40 px-2.5 h-9">
          <StatusDot color="#f43f5e" pulse />
          <span className="text-[15px] text-muted-foreground">Active</span>
          <span className="text-xs font-semibold tnum text-foreground">{activeCount}</span>
        </div>

        {/* Region filter */}
        <Select
          value={obsFilter.regionId}
          onValueChange={(v) => setObsFilter({ regionId: v })}
        >
          <SelectTrigger className="h-9 w-[150px] bg-background/40 text-xs">
            <SelectValue placeholder="All regions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All regions</SelectItem>
            {REGIONS.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Temporal mode */}
        <ToggleGroup
          type="single"
          value={temporalMode}
          onValueChange={(v) => v && setTemporalMode(v as "live" | "historical")}
          className="h-9 rounded-lg border border-border bg-background/40 p-0.5"
        >
          <ToggleGroupItem value="live" className="h-8 gap-1.5 px-2.5 text-xs data-[state=on]:bg-primary/15 data-[state=on]:text-primary">
            <Radio className="size-3.5" /> Live
          </ToggleGroupItem>
          <ToggleGroupItem value="historical" className="h-8 gap-1.5 px-2.5 text-xs data-[state=on]:bg-primary/15 data-[state=on]:text-primary">
            <Clock className="size-3.5" /> Historical
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Notifications — live notification center */}
        <NotificationCenter />

        {/* User */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background/40 pl-1.5 pr-2.5 h-9">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/20 text-primary text-[14px] font-semibold">
            {initials}
          </div>
          <div className="hidden xl:flex flex-col leading-tight">
            <span className="text-[15px] font-medium">{userName}</span>
            <span className="text-[13px] text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="size-2.5" /> {userRole.replace(/_/g, " ").toLowerCase()}
            </span>
          </div>
        </div>

        {/* Logout */}
        <Button variant="ghost" size="icon" className="size-9" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="size-[18px]" />
        </Button>
      </div>
    </header>
  );
}
