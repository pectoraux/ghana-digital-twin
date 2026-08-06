"use client";

import { useEffect } from "react";
import { useGDT } from "@/lib/gdt/store";
import { ENTITIES } from "@/lib/gdt/entities";
import { OBSERVATIONS } from "@/lib/gdt/observations";
import { REGIONS } from "@/lib/gdt/geo";
import { entityColor, obsColor, OBS_META, ENTITY_META } from "@/lib/gdt/format";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Map as MapIcon,
  Home,
  Eye,
  Boxes,
  Share2,
  Database,
  Satellite,
  Grid3x3,
  Terminal,
  Radio,
  RadioTower,
  Users,
  Network,
  Store,
  Coins,
  Globe,
  Activity,
  Scale,
  Brain,
  Building2,
  Clock,
  Sparkles,
} from "lucide-react";

const VIEWS = [
  { id: "home", label: "Home", icon: Home, hint: "Intelligence dashboard" },
  { id: "feed", label: "Intelligence Feed", icon: Eye, hint: "Latest verified intelligence" },
  { id: "atlas", label: "Map", icon: MapIcon, hint: "Live intelligence map" },
  { id: "missions", label: "Missions", icon: Radio, hint: "Active intelligence missions" },
  { id: "community", label: "Community", icon: Users, hint: "Citizen intelligence network" },
  { id: "rewards", label: "Rewards", icon: Coins, hint: "Your earnings and reputation" },
  { id: "profile", label: "Profile", icon: Users, hint: "Your identity, reputation, and impact" },
  { id: "observations", label: "Change Log", icon: Eye, hint: "Entity version history" },
  { id: "entities", label: "Entities", icon: Boxes, hint: "Entity registry" },
  { id: "graph", label: "Knowledge Graph", icon: Share2, hint: "Relationship graph" },
  { id: "eo", label: "Earth Observation", icon: Satellite, hint: "Sentinel-2 imagery & spectral indices" },
  { id: "raster", label: "Raster Intelligence", icon: Grid3x3, hint: "Anomaly maps, baselines & uncertainty" },
  { id: "sources", label: "Data Sources", icon: Database, hint: "Pipeline & connectors" },
  { id: "command", label: "Command Center", icon: RadioTower, hint: "National intelligence command center" },
  { id: "civic-trust", label: "Civic Trust Graph", icon: Network, hint: "Trust propagation, Sybil resistance, identity vouching" },
  { id: "marketplace", label: "Intelligence Marketplace", icon: Store, hint: "Requests, assets, bounties, value attribution" },
  { id: "finance", label: "Intelligence Finance", icon: Coins, hint: "Credits, licensing, royalties, agent economy, insurance" },
  { id: "federation", label: "Federated Intelligence Network", icon: Globe, hint: "Cross-border intelligence: nodes, trust proofs, treaties" },
  { id: "os", label: "Intelligence OS Marketplace", icon: Boxes, hint: "Package registry, developers, solutions, intelligence graph" },
  { id: "reality", label: "Intelligence Reality Feed", icon: Activity, hint: "Continuous ingestion, freshness monitoring, observation triggers" },
  { id: "governance", label: "Intelligence Governance", icon: Scale, hint: "Constitution, council, courts, proposals" },
  { id: "gov-intel", label: "Governance Intelligence", icon: Brain, hint: "Governance agents, precedents, institutional reputation" },
  { id: "aio", label: "Autonomous Organizations", icon: Building2, hint: "Digital institutions: treasury, agents, objectives, charters" },
  { id: "api", label: "API Explorer", icon: Terminal, hint: "Programmatic access" },
] as const;

export function CommandPalette() {
  const paletteOpen = useGDT((s) => s.paletteOpen);
  const setPaletteOpen = useGDT((s) => s.setPaletteOpen);
  const setView = useGDT((s) => s.setView);
  const setReportOpen = useGDT((s) => s.setReportOpen);
  const selectEntity = useGDT((s) => s.selectEntity);
  const selectObservation = useGDT((s) => s.selectObservation);
  const temporalMode = useGDT((s) => s.temporalMode);
  const setTemporalMode = useGDT((s) => s.setTemporalMode);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPaletteOpen]);

  return (
    <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen} className="max-w-[560px]">
      <CommandInput placeholder="Search entities, observations, regions, or jump to…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Quick Actions">
          <CommandItem
            value="report event new create submit intelligence"
            onSelect={() => {
              setReportOpen(true);
              setPaletteOpen(false);
            }}
          >
            <Sparkles className="size-4 text-primary" />
            <span>Report Intelligence...</span>
            <span className="ml-auto text-[14px] text-muted-foreground">Create new report</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigate">
          {VIEWS.map((v) => {
            const Icon = v.icon;
            return (
              <CommandItem
                key={v.id}
                value={`go ${v.label}`}
                onSelect={() => {
                  setView(v.id);
                  setPaletteOpen(false);
                }}
              >
                <Icon className="size-4" />
                <span>{v.label}</span>
                <span className="ml-auto text-[14px] text-muted-foreground">{v.hint}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Temporal Mode">
          <CommandItem
            value="live mode real-time"
            onSelect={() => {
              setTemporalMode("live");
              setPaletteOpen(false);
            }}
          >
            <Radio className="size-4 text-emerald-400" />
            <span>Switch to Live mode</span>
            {temporalMode === "live" && <span className="ml-auto text-[14px] text-primary">active</span>}
          </CommandItem>
          <CommandItem
            value="historical mode time travel"
            onSelect={() => {
              setTemporalMode("historical");
              setPaletteOpen(false);
            }}
          >
            <Clock className="size-4 text-amber-400" />
            <span>Switch to Historical mode</span>
            {temporalMode === "historical" && <span className="ml-auto text-[14px] text-primary">active</span>}
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Observations">
          {OBSERVATIONS.slice(0, 8).map((o) => (
            <CommandItem
              key={o.id}
              value={`obs ${o.title} ${o.id} ${OBS_META[o.type].label}`}
              onSelect={() => {
                selectObservation(o.id);
                setView("observations");
                setPaletteOpen(false);
              }}
            >
              <span className="size-2 rounded-full" style={{ background: obsColor(o.type) }} />
              <span className="flex-1 truncate">{o.title}</span>
              <span className="font-mono text-[14px] text-muted-foreground">{o.id}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Entities">
          {ENTITIES.slice(0, 10).map((e) => (
            <CommandItem
              key={e.id}
              value={`entity ${e.name} ${e.kind} ${ENTITY_META[e.kind].label}`}
              onSelect={() => {
                selectEntity(e.id);
                setView("atlas");
                setPaletteOpen(false);
              }}
            >
              <span className="size-2 rounded-full" style={{ background: entityColor(e.kind) }} />
              <span className="flex-1 truncate">{e.name}</span>
              <span className="text-[14px] text-muted-foreground">{ENTITY_META[e.kind].label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Regions">
          {REGIONS.slice(0, 8).map((r) => (
            <CommandItem
              key={r.id}
              value={`region ${r.name} ${r.capital} ${r.code}`}
              onSelect={() => {
                setView("atlas");
                setPaletteOpen(false);
              }}
            >
              <MapIcon className="size-4" />
              <span>{r.name}</span>
              <span className="ml-auto text-[14px] text-muted-foreground">capital: {r.capital}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
