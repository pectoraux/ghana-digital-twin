"use client";

import { useGDT } from "@/lib/gdt/store";
import { fetchEntity, useAsync } from "@/lib/gdt/api";
import { REGIONS, formatCoord } from "@/lib/gdt/geo";
import {
  ENTITY_META,
  entityTypeLabel,
  entityColor,
  timeAgo,
  fmtDate,
} from "@/lib/gdt/format";
import type { EntityRecord, EntityVersionRecord, RelationshipRecord } from "@/lib/worldmodel/types";
import { SectionLabel, StatusDot, ConfidenceBar } from "./atoms";
import { ChevronRight, MapPin, Ruler, History, Tag, GitCommit, Share2, Database, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

export function EntityDetail({ id }: { id: string }) {
  const { data, loading } = useAsync(() => fetchEntity(id), [id]);
  const selectEntity = useGDT((s) => s.selectEntity);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!data) return <div className="p-4 text-sm text-muted-foreground">Entity not found.</div>;

  const e = data.entity;
  const meta = ENTITY_META[e.kind as keyof typeof ENTITY_META] ?? { color: "#a1a1aa", label: e.kind };
  const region = REGIONS.find((r) => r.id === e.regionId);
  const col = entityColor(e.kind as any);

  return (
    <div className="flex h-full flex-col gdt-scroll overflow-y-auto">
      {/* header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[14px] font-semibold"
            style={{ color: col, background: `${col}1a`, border: `1px solid ${col}33` }}
          >
            <span className="size-1.5 rounded-full" style={{ background: col }} />
            {meta.label}
          </span>
          <span className="text-[14px] text-muted-foreground">{entityTypeLabel(e.type)}</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[15px] text-muted-foreground">{e.externalId}</span>
        </div>
        <h2 className="text-[15px] font-semibold leading-snug">{e.name}</h2>
        <div className="mt-1 flex items-center gap-1.5 text-[15px] text-muted-foreground">
          <MapPin className="size-3" />
          {region?.name ?? "Unassigned"} · {formatCoord(e.centroid)}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* key metrics */}
        <div className="grid grid-cols-2 gap-2">
          {e.areaKm2 != null && (
            <Fact icon={Ruler} label="Area" value={`${e.areaKm2.toLocaleString(undefined, { maximumFractionDigits: 2 })} km²`} />
          )}
          {e.lengthKm != null && (
            <Fact icon={Ruler} label="Length" value={`${e.lengthKm.toFixed(1)} km`} />
          )}
          <Fact icon={GitCommit} label="Version" value={`v${e.currentVersion}`} mono />
          <Fact icon={History} label="Last update" value={timeAgo(e.lastObserved)} />
        </div>

        {/* provenance */}
        <div className="rounded-lg border border-border bg-card/40 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Representation confidence</span>
            <span className="font-mono tnum font-semibold" style={{ color: e.confidence >= 0.9 ? "#34d399" : "#fbbf24" }}>
              {(e.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <ConfidenceBar value={e.confidence} showLabel={false} />
          <div className="space-y-0.5 pt-1 border-t border-border">
            <ProvenanceRow icon={Database} label="Source" value={e.sourceName} />
            <ProvenanceRow icon={Hash} label="Dataset version" value={e.sourceVersion} mono />
            <ProvenanceRow icon={Tag} label="UUID" value={e.uuid.slice(0, 13) + "…"} mono />
          </div>
        </div>

        {/* version history */}
        <div>
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <History className="size-3" /> Version History ({data.history.length})
          </SectionLabel>
          <div className="relative pl-4">
            <div className="absolute left-[5px] top-1 bottom-1 w-px bg-border" />
            <div className="space-y-2.5">
              {data.history.map((v, i) => (
                <div key={v.id} className="relative">
                  <span
                    className={cn("absolute -left-4 top-1 size-2.5 rounded-full border-2 border-background", i === 0 ? "" : "opacity-60")}
                    style={{ background: i === 0 ? col : "#71717a" }}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-mono text-muted-foreground">v{v.version}</span>
                    <span className="text-[14px] text-muted-foreground">· {timeAgo(v.observedAt)}</span>
                    {i === 0 && <span className="text-[13px] font-medium text-primary">latest</span>}
                  </div>
                  <p className="text-[16px] text-foreground/85 mt-0.5">{v.change}</p>
                  <div className="text-[14px] text-muted-foreground font-mono">
                    {v.sourceName} · {(v.confidence * 100).toFixed(0)}% conf
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* attributes */}
        {Object.keys(e.attributes).length > 0 && (
          <div>
            <SectionLabel className="mb-2">Attributes (from source)</SectionLabel>
            <div className="rounded-lg border border-border bg-card/40 divide-y divide-border">
              {Object.entries(e.attributes).slice(0, 12).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-3 py-1.5 text-[15px]">
                  <span className="text-muted-foreground font-mono">{k}</span>
                  <span className="font-mono tnum text-foreground/90 truncate ml-2 max-w-[60%] text-right">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* tags */}
        {e.tags.length > 0 && (
          <div>
            <SectionLabel className="mb-2">Tags</SectionLabel>
            <div className="flex flex-wrap gap-1">
              {e.tags.map((t) => (
                <span key={t} className="rounded border border-border bg-foreground/5 px-1.5 py-0.5 text-[14px] font-mono text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* spatial relationships */}
        <div>
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <Share2 className="size-3" /> Spatial Relationships ({data.relationships.length})
          </SectionLabel>
          {data.relationships.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-[15px] text-muted-foreground">
              No spatial relationships inferred yet
            </div>
          ) : (
            <div className="space-y-1">
              {data.relationships.slice(0, 12).map((r) => {
                const otherId = r.fromEntityId === e.id ? r.toEntityId : r.fromEntityId;
                const dir = r.fromEntityId === e.id ? "→" : "←";
                return (
                  <button
                    key={r.id}
                    onClick={() => selectEntity(otherId)}
                    className="group flex w-full items-center gap-2 rounded-md border border-border bg-card/40 px-2.5 py-1.5 text-left transition-colors hover:border-primary/40 hover:bg-card"
                  >
                    <span className="font-mono text-[14px] text-muted-foreground w-3">{dir}</span>
                    <span className="text-[15px] font-mono text-primary/80 flex-1 truncate">{r.relation}</span>
                    <span className="text-[13px] text-muted-foreground">{r.inferredBy}</span>
                    <ChevronRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* provenance timestamps */}
        <div className="text-[14px] text-muted-foreground font-mono space-y-0.5 pt-1 border-t border-border">
          <div>first observed: {fmtDate(e.firstObserved)}</div>
          <div>last observed: {fmtDate(e.lastObserved)}</div>
        </div>
      </div>
    </div>
  );
}

function Fact({ icon: Icon, label, value, mono }: { icon: React.ElementType; label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-[13px] uppercase tracking-wider text-muted-foreground">
        <Icon className="size-2.5" /> {label}
      </div>
      <div className={cn("text-[16px] font-medium mt-0.5 truncate", mono && "font-mono")}>{value}</div>
    </div>
  );
}

function ProvenanceRow({ icon: Icon, label, value, mono }: { icon: React.ElementType; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-[14px] py-0.5">
      <Icon className="size-3 text-muted-foreground/70" />
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn("text-foreground/80 truncate", mono && "font-mono")}>{value}</span>
    </div>
  );
}
