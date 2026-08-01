"use client";

import { useGDT } from "@/lib/gdt/store";
import { entityById } from "@/lib/gdt/entities";
import { OBSERVATIONS } from "@/lib/gdt/observations";
import { REGIONS, formatCoord } from "@/lib/gdt/geo";
import {
  ENTITY_META,
  entityTypeLabel,
  fmtDate,
  timeAgo,
  entityColor,
} from "@/lib/gdt/format";
import { SectionLabel, StatusDot, ConfidenceBar } from "./atoms";
import { ChevronRight, MapPin, Ruler, History, Tag, GitCommit, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

export function EntityDetail({ id }: { id: string }) {
  const e = entityById(id);
  const selectObservation = useGDT((s) => s.selectObservation);
  const setView = useGDT((s) => s.setView);
  const selectEntity = useGDT((s) => s.selectEntity);

  if (!e) return null;
  const meta = ENTITY_META[e.kind];
  const region = REGIONS.find((r) => r.id === e.regionId);
  const relatedObs = OBSERVATIONS.filter((o) => o.affectedEntities.includes(e.id));

  return (
    <div className="flex h-full flex-col gdt-scroll overflow-y-auto">
      {/* header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ color: meta.color, background: `${meta.color}1a`, border: `1px solid ${meta.color}33` }}
          >
            <span className="size-1.5 rounded-full" style={{ background: meta.color }} />
            {meta.label}
          </span>
          <span className="text-[10px] text-muted-foreground">{entityTypeLabel(e.type)}</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[11px] text-muted-foreground">{e.id}</span>
        </div>
        <h2 className="text-[15px] font-semibold leading-snug">{e.name}</h2>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <MapPin className="size-3" />
          {region?.name} · {formatCoord(e.centroid)}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* key metrics */}
        <div className="grid grid-cols-2 gap-2">
          {e.areaKm2 != null && (
            <Fact icon={Ruler} label="Area" value={`${e.areaKm2.toLocaleString()} km²`} />
          )}
          {e.lengthKm != null && (
            <Fact icon={Ruler} label="Length" value={`${e.lengthKm} km`} />
          )}
          <Fact icon={GitCommit} label="Version" value={`v${e.version}`} mono />
          <Fact icon={History} label="Last update" value={timeAgo(e.lastUpdated)} />
        </div>

        {/* confidence + source */}
        <div className="rounded-lg border border-border bg-card/40 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Representation confidence</span>
            <span className="font-mono tnum font-semibold" style={{ color: e.confidence >= 0.9 ? "#34d399" : "#fbbf24" }}>
              {(e.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <ConfidenceBar value={e.confidence} showLabel={false} />
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground pt-1">
            <Tag className="size-3" /> source: {e.source}
          </div>
        </div>

        {/* version history */}
        <div>
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <History className="size-3" /> Version History
          </SectionLabel>
          <div className="relative pl-4">
            <div className="absolute left-[5px] top-1 bottom-1 w-px bg-border" />
            <div className="space-y-2.5">
              {e.versions.map((v, i) => (
                <div key={v.version} className="relative">
                  <span
                    className={cn(
                      "absolute -left-4 top-1 size-2.5 rounded-full border-2 border-background",
                      i === 0 ? "" : "opacity-60"
                    )}
                    style={{ background: i === 0 ? entityColor(e.kind) : "#71717a" }}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground">v{v.version}</span>
                    <span className="text-[10px] text-muted-foreground">· {timeAgo(v.timestamp)}</span>
                    {i === 0 && (
                      <span className="text-[9px] font-medium text-primary">latest</span>
                    )}
                  </div>
                  <p className="text-[12px] text-foreground/85 mt-0.5">{v.change}</p>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {v.source} · {(v.confidence * 100).toFixed(0)}% conf
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* attributes */}
        <div>
          <SectionLabel className="mb-2">Attributes</SectionLabel>
          <div className="rounded-lg border border-border bg-card/40 divide-y divide-border">
            {Object.entries(e.attributes).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-3 py-1.5 text-[11px]">
                <span className="text-muted-foreground font-mono">{k}</span>
                <span className="font-mono tnum text-foreground/90">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* tags */}
        {e.tags.length > 0 && (
          <div>
            <SectionLabel className="mb-2">Tags</SectionLabel>
            <div className="flex flex-wrap gap-1">
              {e.tags.map((t) => (
                <span key={t} className="rounded border border-border bg-foreground/5 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* related observations */}
        <div>
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <Eye className="size-3" /> Related Observations
          </SectionLabel>
          {relatedObs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-[11px] text-muted-foreground">
              No observations reference this entity
            </div>
          ) : (
            <div className="space-y-1">
              {relatedObs.map((o) => (
                <button
                  key={o.id}
                  onClick={() => {
                    selectObservation(o.id);
                    setView("observations");
                  }}
                  className="group flex w-full items-center gap-2 rounded-md border border-border bg-card/40 px-2.5 py-1.5 text-left transition-colors hover:border-primary/40 hover:bg-card"
                >
                  <StatusDot color={o.status === "active" ? "#f43f5e" : "#fbbf24"} pulse={o.status === "active"} />
                  <span className="flex-1 text-[12px] truncate">{o.title}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{o.id.replace("obs-", "")}</span>
                  <ChevronRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* provenance */}
        <div className="text-[10px] text-muted-foreground font-mono space-y-0.5 pt-1 border-t border-border">
          <div>first observed: {fmtDate(e.firstObserved)}</div>
          <div>last updated: {fmtDate(e.lastUpdated)}</div>
        </div>
      </div>
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
        <Icon className="size-2.5" /> {label}
      </div>
      <div className={cn("text-[12px] font-medium mt-0.5 truncate", mono && "font-mono")}>{value}</div>
    </div>
  );
}
