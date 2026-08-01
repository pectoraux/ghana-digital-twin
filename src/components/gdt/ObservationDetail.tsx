"use client";

import { useEffect, useState } from "react";
import { useGDT } from "@/lib/gdt/store";
import { fetchObservation, type ObservationDetail } from "@/lib/gdt/api";
import { formatCoord } from "@/lib/gdt/geo";
import { fmtArea, timeAgo } from "@/lib/gdt/format";
import { SectionLabel, StatusDot, ConfidenceBar } from "./atoms";
import { cn } from "@/lib/utils";
import {
  X,
  MapPin,
  Ruler,
  Clock,
  Zap,
  Share2,
  History,
  Database,
  GitCommit,
  Layers,
  AlertCircle,
  ChevronRight,
  Sigma,
} from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#f43f5e",
  high: "#fb923c",
  moderate: "#fbbf24",
  low: "#34d399",
};

const TYPE_COLORS: Record<string, string> = {
  surface_disturbance: "#fb923c",
  water_body_change: "#22d3ee",
  vegetation_loss: "#f97316",
  burn_event: "#ef4444",
  moisture_stress: "#a78bfa",
};

export function ObservationDetail({ id }: { id: string }) {
  const [data, setData] = useState<ObservationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const selectEntity = useGDT((s) => s.selectEntity);
  const toggleInspector = useGDT((s) => s.toggleInspector);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => setLoading(true));
    fetchObservation(id)
      .then((d) => { if (active) { setData(d); setLoading(false); } })
      .catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!data) return <div className="p-4 text-sm text-muted-foreground">Observation not found.</div>;

  const o = data.observation;
  const sevColor = SEVERITY_COLORS[o.severity] ?? "#a1a1aa";
  const typeColor = TYPE_COLORS[o.type] ?? "#a1a1aa";

  return (
    <div className="flex h-full flex-col gdt-scroll overflow-y-auto">
      {/* header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ color: typeColor, background: `${typeColor}1a`, border: `1px solid ${typeColor}33` }}
          >
            <span className="size-1.5 rounded-full" style={{ background: typeColor }} />
            {o.type.replace(/_/g, " ")}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ color: sevColor, background: `${sevColor}1a` }}
          >
            {o.severity}
          </span>
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground bg-foreground/5">
            <StatusDot color={o.status === "active" ? "#f43f5e" : "#fbbf24"} pulse={o.status === "active"} />
            {o.status}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[11px] text-muted-foreground">{o.uuid.slice(0, 13)}…</span>
          <span className="text-[10px] text-muted-foreground">· v{o.currentVersion}</span>
          <span className="text-[10px] text-muted-foreground">· {timeAgo(o.observedAt)}</span>
        </div>
        <h2 className="text-[14px] font-semibold leading-snug">{o.title}</h2>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <MapPin className="size-3" />
          {formatCoord(o.centroid)} · {o.mgrsTile ?? "—"}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* summary */}
        <p className="text-[12px] leading-relaxed text-foreground/85">{o.summary}</p>

        {/* key metrics */}
        <div className="grid grid-cols-2 gap-2">
          <Fact icon={Ruler} label="Area affected" value={fmtArea(o.areaHa * 100)} />
          <Fact icon={Zap} label="Confidence" value={`${(o.confidence * 100).toFixed(0)}% ±${(o.uncertainty * 100).toFixed(1)}%`} />
          <Fact icon={GitCommit} label="Version" value={`v${o.currentVersion}`} mono />
          <Fact icon={Clock} label="First observed" value={timeAgo(o.firstObserved)} />
        </div>

        {/* fused confidence + uncertainty */}
        <div className="rounded-lg border border-border bg-card/40 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Fused confidence</span>
            <span className="font-mono tnum font-semibold" style={{ color: o.confidence > 0.5 ? "#34d399" : o.confidence > 0.3 ? "#fbbf24" : "#fb923c" }}>
              {(o.confidence * 100).toFixed(0)}% ±{(o.uncertainty * 100).toFixed(1)}%
            </span>
          </div>
          <ConfidenceBar value={o.confidence} showLabel={false} />
          <div className="flex items-center gap-1.5 text-[10px] text-amber-400/80 pt-1 border-t border-border">
            <Sigma className="size-3" />
            Uncertainty propagated from {o.evidence.length} evidence sources
          </div>
        </div>

        {/* evidence breakdown — THE KEY FEATURE */}
        <div>
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <Layers className="size-3" /> Evidence Fusion ({o.evidence.length} sources)
          </SectionLabel>
          <div className="space-y-1.5">
            {o.evidence.map((e, i) => {
              const contribPct = (e.contribution * 100).toFixed(0);
              const signalPct = (e.normalizedSignal * 100).toFixed(0);
              return (
                <div key={i} className="rounded-lg border border-border bg-card/40 p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="size-2 rounded-full" style={{ background: typeColor }} />
                    <span className="text-[11px] font-medium">{e.productType.replace(/_/g, " ")}</span>
                    <span className="ml-auto font-mono text-[9px] text-muted-foreground">
                      w={e.weight.toFixed(2)} · signal={signalPct}% · contrib={contribPct}%
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mb-1.5">{e.description}</div>
                  {/* contribution bar */}
                  <div className="h-1 rounded-full bg-foreground/8 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${e.contribution * 100 / 0.35}%`, background: typeColor }} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                    <span>conf {(e.confidence * 100).toFixed(0)}%</span>
                    <span>±{(e.uncertainty * 100).toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* affected entities */}
        {o.affectedEntities.length > 0 && (
          <div>
            <SectionLabel className="mb-2 flex items-center gap-1.5">
              <Share2 className="size-3" /> Affected Entities ({o.affectedEntities.length})
            </SectionLabel>
            <div className="space-y-1">
              {o.affectedEntities.map((a) => (
                <button
                  key={a.entityId}
                  onClick={() => selectEntity(a.entityId)}
                  className="group flex w-full items-center gap-2 rounded-md border border-border bg-card/40 px-2.5 py-1.5 text-left transition-colors hover:border-primary/40 hover:bg-card"
                >
                  <span className="font-mono text-[10px] text-muted-foreground w-3">→</span>
                  <span className="text-[11px] font-mono text-primary/80 flex-1 truncate">{a.relationship}</span>
                  {a.distance != null && <span className="text-[9px] text-muted-foreground">{a.distance.toFixed(2)}km</span>}
                  <ChevronRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* version history (immutable) */}
        {data.versions.length > 0 && (
          <div>
            <SectionLabel className="mb-2 flex items-center gap-1.5">
              <History className="size-3" /> Version History ({data.versions.length})
            </SectionLabel>
            <div className="relative pl-4">
              <div className="absolute left-[5px] top-1 bottom-1 w-px bg-border" />
              <div className="space-y-2.5">
                {data.versions.map((v, i) => (
                  <div key={v.id} className="relative">
                    <span
                      className={cn("absolute -left-4 top-1 size-2.5 rounded-full border-2 border-background", i === 0 ? "" : "opacity-60")}
                      style={{ background: i === 0 ? typeColor : "#71717a" }}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">v{v.version}</span>
                      <span className="text-[10px] text-muted-foreground">· {timeAgo(v.observedAt)}</span>
                      {i === 0 && <span className="text-[9px] font-medium text-primary">latest</span>}
                    </div>
                    <p className="text-[12px] text-foreground/85 mt-0.5">{v.change}</p>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      conf {(v.confidence * 100).toFixed(0)}% · {v.evidenceCount} evidence sources
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* provenance */}
        <div>
          <SectionLabel className="mb-2">Provenance</SectionLabel>
          <div className="rounded-lg border border-border bg-card/40 p-3 space-y-1 text-[10px] font-mono text-muted-foreground">
            <div className="flex items-center gap-1.5"><Database className="size-3" /> Source products: {o.sourceProducts.length}</div>
            <div className="flex items-center gap-1.5"><GitCommit className="size-3" /> Source models: {o.sourceModels.join(", ")}</div>
            <div className="flex items-center gap-1.5"><MapPin className="size-3" /> MGRS: {o.mgrsTile ?? "—"}</div>
          </div>
        </div>

        {/* objectivity note */}
        <div className="rounded-lg border border-border bg-foreground/[0.02] p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertCircle className="size-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold text-muted-foreground">Objectivity</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            This observation describes objective physical-world change. No legal conclusion is asserted.
            Evidence is fused from multiple independent raster products with propagated uncertainty.
          </p>
        </div>
      </div>
    </div>
  );
}

function Fact({ icon: Icon, label, value, mono }: { icon: React.ElementType; label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
        <Icon className="size-2.5" /> {label}
      </div>
      <div className={cn("text-[12px] font-medium mt-0.5 truncate", mono && "font-mono")}>{value}</div>
    </div>
  );
}
