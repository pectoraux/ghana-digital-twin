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
  Eye,
  Boxes,
  Share2,
  Database,
  Terminal,
  Radio,
  Clock,
} from "lucide-react";

const VIEWS = [
  { id: "atlas", label: "Atlas", icon: MapIcon, hint: "Geospatial world view" },
  { id: "observations", label: "Observations", icon: Eye, hint: "Change detection feed" },
  { id: "entities", label: "Entities", icon: Boxes, hint: "Entity registry" },
  { id: "graph", label: "Knowledge Graph", icon: Share2, hint: "Relationship graph" },
  { id: "sources", label: "Data Sources", icon: Database, hint: "Pipeline & connectors" },
  { id: "api", label: "API Explorer", icon: Terminal, hint: "Programmatic access" },
] as const;

export function CommandPalette() {
  const paletteOpen = useGDT((s) => s.paletteOpen);
  const setPaletteOpen = useGDT((s) => s.setPaletteOpen);
  const setView = useGDT((s) => s.setView);
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
                <span className="ml-auto text-[10px] text-muted-foreground">{v.hint}</span>
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
            {temporalMode === "live" && <span className="ml-auto text-[10px] text-primary">active</span>}
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
            {temporalMode === "historical" && <span className="ml-auto text-[10px] text-primary">active</span>}
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
              <span className="font-mono text-[10px] text-muted-foreground">{o.id}</span>
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
              <span className="text-[10px] text-muted-foreground">{ENTITY_META[e.kind].label}</span>
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
              <span className="ml-auto text-[10px] text-muted-foreground">capital: {r.capital}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
