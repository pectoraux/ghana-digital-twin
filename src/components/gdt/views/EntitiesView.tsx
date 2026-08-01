"use client";

import { useMemo, useState } from "react";
import { useGDT } from "@/lib/gdt/store";
import { ENTITIES } from "@/lib/gdt/entities";
import { REGIONS } from "@/lib/gdt/geo";
import {
  ENTITY_META,
  entityColor,
  entityTypeLabel,
  fmtInt,
  timeAgo,
} from "@/lib/gdt/format";
import type { EntityKind, EntityType } from "@/lib/gdt/types";
import { cn } from "@/lib/utils";
import { ConfidenceBar, MetricStat, SectionLabel } from "@/components/gdt/atoms";
import {
  Search,
  ArrowUpDown,
  Boxes,
  Leaf,
  Building2,
  Map,
  Pickaxe,
  ChevronDown,
} from "lucide-react";

type SortKey = "name" | "kind" | "region" | "confidence" | "version" | "updated" | "area";

const TYPE_GROUPS: { type: EntityType; label: string; icon: React.ElementType; color: string }[] = [
  { type: "natural", label: "Natural", icon: Leaf, color: "#34d399" },
  { type: "infrastructure", label: "Infrastructure", icon: Building2, color: "#fbbf24" },
  { type: "administrative", label: "Administrative", icon: Map, color: "#a1a1aa" },
  { type: "human_activity", label: "Human Activity", icon: Pickaxe, color: "#f43f5e" },
];

export function EntitiesView() {
  const selectEntity = useGDT((s) => s.selectEntity);
  const selectedEntityId = useGDT((s) => s.selectedEntityId);
  const setView = useGDT((s) => s.setView);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<EntityType | "all">("all");
  const [kindFilter, setKindFilter] = useState<EntityKind | "all">("all");
  const [sort, setSort] = useState<SortKey>("updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let list = ENTITIES.filter((e) => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (kindFilter !== "all" && e.kind !== kindFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!e.name.toLowerCase().includes(q) && !e.id.toLowerCase().includes(q) && !e.kind.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sort) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "kind": cmp = a.kind.localeCompare(b.kind); break;
        case "region": cmp = a.regionId.localeCompare(b.regionId); break;
        case "confidence": cmp = a.confidence - b.confidence; break;
        case "version": cmp = a.version - b.version; break;
        case "updated": cmp = new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime(); break;
        case "area": cmp = (a.areaKm2 ?? a.lengthKm ?? 0) - (b.areaKm2 ?? b.lengthKm ?? 0); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [search, typeFilter, kindFilter, sort, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sort === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(k);
      setSortDir(k === "name" ? "asc" : "desc");
    }
  };

  const kindCounts = useMemo(() => {
    const map: Record<string, number> = {};
    ENTITIES.forEach((e) => (map[e.kind] = (map[e.kind] ?? 0) + 1));
    return map;
  }, []);

  return (
    <div className="flex h-full w-full">
      {/* Left sidebar — entity types */}
      <div className="hidden w-[230px] shrink-0 flex-col border-r border-border bg-card/20 md:flex">
        <div className="border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold">
            <Boxes className="size-3.5 text-primary" /> Entity Registry
          </h3>
          <p className="mt-1 text-[10px] text-muted-foreground">{ENTITIES.length} tracked & versioned</p>
        </div>
        <div className="min-h-0 flex-1 gdt-scroll overflow-y-auto p-3 space-y-4">
          {/* by type */}
          <div>
            <SectionLabel className="mb-2">By Type</SectionLabel>
            <div className="space-y-0.5">
              <SidebarRow
                active={typeFilter === "all"}
                onClick={() => setTypeFilter("all")}
                label="All entities"
                count={ENTITIES.length}
              />
              {TYPE_GROUPS.map((g) => {
                const count = ENTITIES.filter((e) => e.type === g.type).length;
                const Icon = g.icon;
                return (
                  <SidebarRow
                    key={g.type}
                    active={typeFilter === g.type}
                    onClick={() => setTypeFilter(g.type)}
                    label={g.label}
                    count={count}
                    icon={<Icon className="size-3.5" style={{ color: g.color }} />}
                  />
                );
              })}
            </div>
          </div>

          {/* by kind */}
          <div>
            <SectionLabel className="mb-2">By Kind</SectionLabel>
            <div className="space-y-0.5">
              <SidebarRow
                active={kindFilter === "all"}
                onClick={() => setKindFilter("all")}
                label="All kinds"
                count={ENTITIES.length}
              />
              {Object.entries(ENTITY_META)
                .filter(([k]) => kindCounts[k])
                .sort((a, b) => kindCounts[b[0]] - kindCounts[a[0]])
                .map(([k, meta]) => (
                  <SidebarRow
                    key={k}
                    active={kindFilter === k}
                    onClick={() => setKindFilter(k as EntityKind)}
                    label={meta.label}
                    count={kindCounts[k]}
                    color={meta.color}
                  />
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main table */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* header */}
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold">Entities</h2>
            <span className="rounded-md bg-foreground/5 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {filtered.length} / {ENTITIES.length}
            </span>
            <div className="ml-auto flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 h-8">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search entities…"
                className="w-48 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricStat label="Natural" value={fmtInt(ENTITIES.filter((e) => e.type === "natural").length)} accent="#34d399" />
            <MetricStat label="Infrastructure" value={fmtInt(ENTITIES.filter((e) => e.type === "infrastructure").length)} accent="#fbbf24" />
            <MetricStat label="Administrative" value={fmtInt(ENTITIES.filter((e) => e.type === "administrative").length)} accent="#a1a1aa" />
            <MetricStat label="Human Activity" value={fmtInt(ENTITIES.filter((e) => e.type === "human_activity").length)} accent="#f43f5e" />
          </div>
        </div>

        {/* table */}
        <div className="min-h-0 flex-1 gdt-scroll overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card/90 backdrop-blur">
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <Th onClick={() => toggleSort("name")} active={sort === "name"} dir={sortDir} className="text-left pl-4">Entity</Th>
                <Th onClick={() => toggleSort("kind")} active={sort === "kind"} dir={sortDir}>Kind</Th>
                <Th onClick={() => toggleSort("region")} active={sort === "region"} dir={sortDir}>Region</Th>
                <Th onClick={() => toggleSort("confidence")} active={sort === "confidence"} dir={sortDir} className="w-32">Confidence</Th>
                <Th onClick={() => toggleSort("version")} active={sort === "version"} dir={sortDir} className="text-right">Ver</Th>
                <Th onClick={() => toggleSort("updated")} active={sort === "updated"} dir={sortDir}>Updated</Th>
                <Th onClick={() => toggleSort("area")} active={sort === "area"} dir={sortDir} className="text-right pr-4">Area/Length</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const meta = ENTITY_META[e.kind];
                const region = REGIONS.find((r) => r.id === e.regionId);
                const selected = selectedEntityId === e.id;
                const size = e.areaKm2 ? `${e.areaKm2.toLocaleString()} km²` : e.lengthKm ? `${e.lengthKm} km` : "—";
                return (
                  <tr
                    key={e.id}
                    onClick={() => selectEntity(e.id)}
                    className={cn(
                      "border-b border-border/60 cursor-pointer transition-colors",
                      selected ? "bg-primary/8" : "hover:bg-accent/40"
                    )}
                  >
                    <td className="py-2.5 pl-4">
                      <div className="flex items-center gap-2.5">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: entityColor(e.kind), boxShadow: `0 0 6px ${entityColor(e.kind)}55` }} />
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium truncate">{e.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{e.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="rounded border border-border bg-foreground/5 px-1.5 py-0.5 text-[10px]" style={{ color: meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="text-[11px] text-muted-foreground">{region?.name ?? "—"}</td>
                    <td>
                      <div className="flex items-center gap-2 pr-2">
                        <ConfidenceBar value={e.confidence} showLabel={false} size="sm" />
                        <span className="font-mono text-[10px] tnum text-muted-foreground w-7 text-right">{(e.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="text-right font-mono text-[11px] tnum text-muted-foreground">v{e.version}</td>
                    <td className="text-[11px] text-muted-foreground">{timeAgo(e.lastUpdated)}</td>
                    <td className="text-right pr-4 font-mono text-[11px] tnum text-foreground/80">{size}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Boxes className="size-8 opacity-30" />
              <span className="text-sm">No entities match your filters</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir: "asc" | "desc";
  className?: string;
}) {
  return (
    <th className={cn("py-2 px-2 font-medium cursor-pointer select-none hover:text-foreground transition-colors", className)} onClick={onClick}>
      <span className={cn("inline-flex items-center gap-1", active && "text-primary")}>
        {children}
        {active && <ChevronDown className={cn("size-3 transition-transform", dir === "asc" && "rotate-180")} />}
      </span>
    </th>
  );
}

function SidebarRow({
  active,
  onClick,
  label,
  count,
  icon,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {icon ?? (color ? <span className="size-2.5 rounded-full" style={{ background: color }} /> : null)}
      <span className="flex-1 truncate">{label}</span>
      <span className="font-mono text-[10px] tnum opacity-70">{count}</span>
    </button>
  );
}
