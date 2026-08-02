"use client";

import { useCallback, useEffect, useState } from "react";
import { useGDT } from "@/lib/gdt/store";
import { fetchObservation, fetchLineage, type ObservationDetail, type LineageNode } from "@/lib/gdt/api";
import { formatCoord } from "@/lib/gdt/geo";
import { fmtArea, fmtDateTime, timeAgo } from "@/lib/gdt/format";
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
  ChevronDown,
  Sigma,
  GitBranch,
  Loader2,
} from "lucide-react";

// Level → accent color for the lineage tree badge
const LINEAGE_LEVEL_COLORS: Record<string, string> = {
  observation: "#34d399", // emerald
  evidence: "#fbbf24", // gold
  raster_product: "#2dd4bf", // teal
  baseline: "#a78bfa", // violet
  scene: "#f43f5e", // rose
  cog: "#f59e0b", // amber
  stac_item: "#94a3b8", // blue-gray (slate)
};

function lineageLevelColor(level: string): string {
  return LINEAGE_LEVEL_COLORS[level] ?? "#a1a1aa";
}

// Per-level detail extraction (defensive — picks known keys per level)
function lineageDetails(level: string, details: Record<string, unknown>): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const get = (k: string): unknown => details[k];
  const num = (v: unknown): number | null =>
    typeof v === "number" ? v : typeof v === "string" && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null;

  switch (level) {
    case "observation":
      if (get("type")) out.push({ label: "type", value: String(get("type")).replace(/_/g, " ") });
      if (get("severity")) out.push({ label: "severity", value: String(get("severity")) });
      if (num(get("confidence")) != null)
        out.push({ label: "conf", value: `${(num(get("confidence"))! * 100).toFixed(0)}%` });
      if (get("evidenceCount") != null) out.push({ label: "evidence", value: String(get("evidenceCount")) });
      break;
    case "evidence":
      if (num(get("value")) != null) out.push({ label: "value", value: num(get("value"))!.toFixed(3) });
      if (num(get("normalizedSignal")) != null)
        out.push({ label: "signal", value: `${(num(get("normalizedSignal"))! * 100).toFixed(0)}%` });
      if (num(get("confidence")) != null)
        out.push({ label: "conf", value: `${(num(get("confidence"))! * 100).toFixed(0)}%` });
      if (get("direction")) out.push({ label: "dir", value: String(get("direction")) });
      break;
    case "raster_product":
      if (get("type")) out.push({ label: "type", value: String(get("type")).replace(/_/g, " ") });
      if (get("indexName")) out.push({ label: "index", value: String(get("indexName")) });
      if (num(get("confidence")) != null)
        out.push({ label: "conf", value: `${(num(get("confidence"))! * 100).toFixed(0)}%` });
      if (get("mgrsTile")) out.push({ label: "mgrs", value: String(get("mgrsTile")) });
      break;
    case "baseline":
      if (get("indexName")) out.push({ label: "index", value: String(get("indexName")) });
      if (get("season")) out.push({ label: "season", value: String(get("season")) });
      if (get("sampleCount") != null) out.push({ label: "samples", value: String(get("sampleCount")) });
      break;
    case "scene":
      if (get("stacId")) out.push({ label: "stacId", value: String(get("stacId")) });
      if (num(get("cloudCover")) != null)
        out.push({ label: "cloud", value: `${num(get("cloudCover"))!.toFixed(1)}%` });
      if (get("datetime")) out.push({ label: "acquired", value: fmtDateTime(String(get("datetime"))) });
      break;
    case "cog":
      if (get("href")) out.push({ label: "href", value: truncateHref(String(get("href"))) });
      if (get("commonName")) out.push({ label: "band", value: String(get("commonName")) });
      break;
    case "stac_item":
      if (get("stacId")) out.push({ label: "stacId", value: String(get("stacId")) });
      if (get("collection")) out.push({ label: "collection", value: String(get("collection")) });
      break;
  }
  return out;
}

function truncateHref(href: string, max = 48): string {
  if (href.length <= max) return href;
  return href.slice(0, max - 1) + "…";
}

// Recursive lineage row
function LineageNodeRow({
  node,
  depth,
  expanded,
  onToggle,
}: {
  node: LineageNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isExpanded = expanded.has(node.id);
  const color = lineageLevelColor(node.level);
  const details = lineageDetails(node.level, node.details);

  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <div className="flex items-start gap-1.5 py-1">
        {hasChildren ? (
          <button
            onClick={() => onToggle(node.id)}
            className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
            aria-label={isExpanded ? "Collapse" : "Expand"}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
          </button>
        ) : (
          <span className="mt-1.5 flex size-4 shrink-0 items-center justify-center">
            <span className="size-1 rounded-full" style={{ background: color }} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[13px] font-semibold uppercase tracking-wider"
              style={{ color, background: `${color}1a`, border: `1px solid ${color}33` }}
            >
              {node.level.replace(/_/g, " ")}
            </span>
            <span className="text-[15px] font-medium truncate">{node.label}</span>
          </div>
          {details.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] font-mono text-muted-foreground">
              {details.map((d, i) => (
                <span key={i} className="truncate">
                  <span className="text-muted-foreground/60">{d.label}:</span>{" "}
                  <span className="text-foreground/80 tnum">{d.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((c) => (
            <LineageNodeRow
              key={c.id}
              node={c}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LineageTree({ root }: { root: LineageNode }) {
  // default expanded: observation (root) + its direct children (first level)
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>([root.id]);
    (root.children ?? []).forEach((c) => initial.add(c.id));
    return initial;
  });

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="rounded-lg border border-border bg-card/40 p-2">
      <LineageNodeRow node={root} depth={0} expanded={expanded} onToggle={toggle} />
    </div>
  );
}

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
  const [lineage, setLineage] = useState<LineageNode | null>(null);
  const [lineageLoading, setLineageLoading] = useState(false);
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

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setLineage(null);
        setLineageLoading(true);
      }
    });
    fetchLineage(id)
      .then((d) => { if (active) { setLineage(d); setLineageLoading(false); } })
      .catch(() => { if (active) setLineageLoading(false); });
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
            className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[14px] font-semibold"
            style={{ color: typeColor, background: `${typeColor}1a`, border: `1px solid ${typeColor}33` }}
          >
            <span className="size-1.5 rounded-full" style={{ background: typeColor }} />
            {o.type.replace(/_/g, " ")}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[14px] font-semibold"
            style={{ color: sevColor, background: `${sevColor}1a` }}
          >
            {o.severity}
          </span>
          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[14px] font-medium text-muted-foreground bg-foreground/5">
            <StatusDot color={o.status === "active" ? "#f43f5e" : "#fbbf24"} pulse={o.status === "active"} />
            {o.status}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[15px] text-muted-foreground">{o.uuid.slice(0, 13)}…</span>
          <span className="text-[14px] text-muted-foreground">· v{o.currentVersion}</span>
          <span className="text-[14px] text-muted-foreground">· {timeAgo(o.observedAt)}</span>
        </div>
        <h2 className="text-[18px] font-semibold leading-snug">{o.title}</h2>
        <div className="mt-1 flex items-center gap-1.5 text-[15px] text-muted-foreground">
          <MapPin className="size-3" />
          {formatCoord(o.centroid)} · {o.mgrsTile ?? "—"}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* summary */}
        <p className="text-[16px] leading-relaxed text-foreground/85">{o.summary}</p>

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
          <div className="flex items-center gap-1.5 text-[14px] text-amber-400/80 pt-1 border-t border-border">
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
                    <span className="text-[15px] font-medium">{e.productType.replace(/_/g, " ")}</span>
                    <span className="ml-auto font-mono text-[13px] text-muted-foreground">
                      w={e.weight.toFixed(2)} · signal={signalPct}% · contrib={contribPct}%
                    </span>
                  </div>
                  <div className="text-[14px] text-muted-foreground mb-1.5">{e.description}</div>
                  {/* contribution bar */}
                  <div className="h-1 rounded-full bg-foreground/8 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${e.contribution * 100 / 0.35}%`, background: typeColor }} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[13px] font-mono text-muted-foreground">
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
                  <span className="font-mono text-[14px] text-muted-foreground w-3">→</span>
                  <span className="text-[15px] font-mono text-primary/80 flex-1 truncate">{a.relationship}</span>
                  {a.distance != null && <span className="text-[13px] text-muted-foreground">{a.distance.toFixed(2)}km</span>}
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
                      <span className="text-[14px] font-mono text-muted-foreground">v{v.version}</span>
                      <span className="text-[14px] text-muted-foreground">· {timeAgo(v.observedAt)}</span>
                      {i === 0 && <span className="text-[13px] font-medium text-primary">latest</span>}
                    </div>
                    <p className="text-[16px] text-foreground/85 mt-0.5">{v.change}</p>
                    <div className="text-[14px] text-muted-foreground font-mono">
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
          <div className="rounded-lg border border-border bg-card/40 p-3 space-y-1 text-[14px] font-mono text-muted-foreground">
            <div className="flex items-center gap-1.5"><Database className="size-3" /> Source products: {o.sourceProducts.length}</div>
            <div className="flex items-center gap-1.5"><GitCommit className="size-3" /> Source models: {o.sourceModels.join(", ")}</div>
            <div className="flex items-center gap-1.5"><MapPin className="size-3" /> MGRS: {o.mgrsTile ?? "—"}</div>
          </div>
        </div>

        {/* observation lineage — full provenance chain */}
        <div>
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <GitBranch className="size-3" /> Observation Lineage
          </SectionLabel>
          {lineageLoading ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card/40 p-3 text-[15px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin text-primary" />
              Tracing provenance chain…
            </div>
          ) : lineage ? (
            <div className="space-y-2">
              <LineageTree key={lineage.id} root={lineage} />
              <p className="text-[14px] text-muted-foreground leading-relaxed px-1">
                Full provenance chain from observation to original satellite COG. Every transformation is traceable.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card/40 p-3 text-[15px] text-muted-foreground italic">
              Lineage unavailable for this observation.
            </div>
          )}
        </div>

        {/* objectivity note */}
        <div className="rounded-lg border border-border bg-foreground/[0.02] p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertCircle className="size-3 text-muted-foreground" />
            <span className="text-[14px] font-semibold text-muted-foreground">Objectivity</span>
          </div>
          <p className="text-[14px] text-muted-foreground leading-relaxed">
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
      <div className="flex items-center gap-1 text-[13px] uppercase tracking-wider text-muted-foreground">
        <Icon className="size-2.5" /> {label}
      </div>
      <div className={cn("text-[16px] font-medium mt-0.5 truncate", mono && "font-mono")}>{value}</div>
    </div>
  );
}
