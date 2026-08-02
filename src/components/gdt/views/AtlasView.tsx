"use client";

import { useEffect, useState } from "react";
import { GhanaMap } from "@/components/gdt/GhanaMap";
import { useGDT, type LayerKey } from "@/lib/gdt/store";
import { fetchChanges, fetchStats } from "@/lib/gdt/api";
import { entityColor, fmtDateTime, timeAgo } from "@/lib/gdt/format";
import { cn } from "@/lib/utils";
import { StatusDot, SectionLabel } from "@/components/gdt/atoms";
import {
  Layers,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Calendar,
  Radio,
  RotateCcw,
} from "lucide-react";

const LAYER_GROUPS: { group: string; items: { key: LayerKey; label: string; color?: string }[] }[] = [
  {
    group: "Natural",
    items: [
      { key: "rivers", label: "Rivers & Watersheds", color: "#2dd4bf" },
      { key: "lakes", label: "Lakes & Water", color: "#22d3ee" },
      { key: "forests", label: "Forest & Vegetation", color: "#34d399" },
      { key: "protected", label: "Protected Areas", color: "#34d399" },
    ],
  },
  {
    group: "Infrastructure",
    items: [
      { key: "roads", label: "Roads", color: "#a1a1aa" },
      { key: "settlements", label: "Settlements", color: "#fbbf24" },
      { key: "dams", label: "Dams", color: "#f59e0b" },
    ],
  },
  {
    group: "Human Activity",
    items: [
      { key: "mining", label: "Mining & Excavation", color: "#f43f5e" },
      { key: "observations", label: "Observations", color: "#fb923c" },
    ],
  },
  {
    group: "Reference",
    items: [
      { key: "regions", label: "Region Boundaries" },
      { key: "labels", label: "Labels" },
      { key: "grid", label: "Graticule Grid" },
    ],
  },
];

const NOW = Date.now();
const START = Date.UTC(2024, 0, 1);

export function AtlasView() {
  const layers = useGDT((s) => s.layers);
  const toggleLayer = useGDT((s) => s.toggleLayer);
  const temporalMode = useGDT((s) => s.temporalMode);
  const temporalDate = useGDT((s) => s.temporalDate);
  const setTemporalDate = useGDT((s) => s.setTemporalDate);
  const setTemporalMode = useGDT((s) => s.setTemporalMode);
  const [panelOpen, setPanelOpen] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [liveTime, setLiveTime] = useState(() => new Date());

  // live clock — updates every second when in live mode
  useEffect(() => {
    if (temporalMode !== "live") return;
    const t = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(t);
  }, [temporalMode]);

  // temporal play loop
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      const cur = new Date(temporalDate).getTime();
      const next = cur + 6 * 3600000; // +6h
      if (next > NOW) {
        setPlaying(false);
        setTemporalMode("live");
        return;
      }
      setTemporalDate(new Date(next).toISOString());
    }, 280);
    return () => clearInterval(t);
  }, [playing, temporalDate, setTemporalDate, setTemporalMode]);

  const rangeMs = NOW - START;
  const curMs = new Date(temporalDate).getTime();
  const pct = ((curMs - START) / rangeMs) * 100;

  // real recent entity changes from the world model
  const [changes, setChanges] = useState<any[]>([]);
  useEffect(() => {
    fetchChanges(undefined, 8)
      .then((r) => setChanges(r.changes))
      .catch(() => {});
    const t = setInterval(
      () => fetchChanges(undefined, 8).then((r) => setChanges(r.changes)).catch(() => {}),
      20000
    );
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative h-full w-full">
      <GhanaMap />

      {/* Layer panel (top-left) */}
      <div className="absolute left-3 top-3 w-[230px]">
        <div className="overflow-hidden rounded-lg border border-border bg-card/85 backdrop-blur-md shadow-lg">
          <button
            onClick={() => setPanelOpen((v) => !v)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left"
          >
            <Layers className="size-4 text-primary" />
            <span className="text-xs font-semibold flex-1">Layers</span>
            <span className="text-[14px] text-muted-foreground font-mono">
              {Object.values(layers).filter(Boolean).length}/{Object.values(layers).length}
            </span>
            {panelOpen ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
          {panelOpen && (
            <div className="border-t border-border p-2 space-y-2.5 max-h-[calc(100vh-220px)] overflow-y-auto gdt-scroll">
              {LAYER_GROUPS.map((g) => (
                <div key={g.group}>
                  <SectionLabel className="mb-1.5 px-0.5">{g.group}</SectionLabel>
                  <div className="space-y-0.5">
                    {g.items.map((it) => (
                      <button
                        key={it.key}
                        onClick={() => toggleLayer(it.key)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                          layers[it.key]
                            ? "bg-primary/8 hover:bg-primary/12"
                            : "hover:bg-accent opacity-60"
                        )}
                      >
                        {it.color ? (
                          <span className="size-2.5 rounded-full" style={{ background: it.color }} />
                        ) : (
                          <span className="size-2.5 rounded-full border border-border" />
                        )}
                        <span className="flex-1 text-[15px] truncate">{it.label}</span>
                        <span
                          className={cn(
                            "h-3 w-5 rounded-full p-0.5 transition-colors",
                            layers[it.key] ? "bg-primary" : "bg-foreground/15"
                          )}
                        >
                          <span
                            className={cn(
                              "block size-2 rounded-full bg-white transition-transform",
                              layers[it.key] && "translate-x-2"
                            )}
                          />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Legend (top-right) */}
      <div className="absolute right-3 top-3 w-[176px] rounded-lg border border-border bg-card/85 backdrop-blur-md shadow-lg p-2.5">
        <SectionLabel className="mb-2">Legend</SectionLabel>
        <div className="space-y-1.5 text-[15px]">
          <LegendRow color="#2dd4bf" label="Rivers / Water" />
          <LegendRow color="#34d399" label="Forest / Protected" />
          <LegendRow color="#fbbf24" label="Settlement / Dam" />
          <LegendRow color="#f43f5e" label="Mining / Excavation" hatch />
          <LegendRow color="#fb923c" label="Observation marker" dot />
        </div>
      </div>

      {/* Recent entity changes ticker (right side, below legend) — real world-model data */}
      <div className="absolute right-3 top-[210px] w-[176px]">
        <div className="rounded-lg border border-border bg-card/85 backdrop-blur-md shadow-lg p-2.5">
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <Radio className="size-3 text-emerald-400" /> Recent Changes
          </SectionLabel>
          <div className="space-y-1 max-h-56 overflow-y-auto gdt-scroll">
            {changes.length === 0 && (
              <div className="text-[14px] text-muted-foreground px-1 py-2">
                No recent changes
              </div>
            )}
            {changes.map((c) => (
              <ChangeRow
                key={c.id}
                entityId={c.entityId}
                title={c.entityName ?? c.change}
                kind={c.entityKind}
                sub={`v${c.version} · ${timeAgo(c.observedAt)}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Temporal scrubber (bottom-center) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[min(580px,calc(100%-32px))]">
        <div className="rounded-xl border border-border bg-card/90 backdrop-blur-md shadow-xl px-3 py-2.5">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-[14px] font-semibold font-mono shrink-0",
                temporalMode === "live"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-amber-500/15 text-amber-400"
              )}
            >
              {temporalMode === "live" ? (
                <>
                  <StatusDot color="#34d399" pulse /> LIVE
                </>
              ) : (
                <>
                  <Calendar className="size-3" /> AS-OF
                </>
              )}
            </div>

            {temporalMode === "historical" && (
              <button
                onClick={() => setPlaying((p) => !p)}
                className="flex size-7 items-center justify-center rounded-md border border-border bg-background/60 text-foreground/80 hover:text-primary hover:border-primary/40 shrink-0"
              >
                {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              </button>
            )}

            <div className="text-[15px] font-mono text-foreground/90 tnum w-[150px] shrink-0">
              {temporalMode === "live"
                ? fmtDateTime(liveTime.toISOString())
                : fmtDateTime(temporalDate)}
            </div>

            <div className="flex-1 relative">
              <input
                type="range"
                min={START}
                max={NOW}
                step={3600000}
                value={curMs}
                onChange={(e) => setTemporalDate(new Date(parseInt(e.target.value)).toISOString())}
                className="gdt-range w-full"
                style={{ "--pct": `${pct}%` } as React.CSSProperties}
              />
              <div className="flex justify-between text-[13px] text-muted-foreground font-mono mt-1">
                <span>Jan 2024</span>
                <span>Jan 2025</span>
                <span>Now</span>
              </div>
            </div>

            {temporalMode === "historical" && (
              <button
                onClick={() => setTemporalMode("live")}
                className="flex items-center gap-1 rounded-md border border-border bg-background/60 px-2 py-1 text-[14px] text-foreground/80 hover:text-primary hover:border-primary/40 shrink-0"
              >
                <RotateCcw className="size-3" /> Live
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .gdt-range {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          background: linear-gradient(
            to right,
            oklch(0.72 0.16 155) 0%,
            oklch(0.72 0.16 155) var(--pct, 100%),
            oklch(1 0 0 / 0.1) var(--pct, 100%),
            oklch(1 0 0 / 0.1) 100%
          );
          border-radius: 999px;
          outline: none;
        }
        .gdt-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: oklch(0.16 0.01 165);
          border: 2px solid oklch(0.72 0.16 155);
          cursor: pointer;
          box-shadow: 0 0 8px oklch(0.72 0.16 155 / 0.6);
        }
        .gdt-range::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: oklch(0.16 0.01 165);
          border: 2px solid oklch(0.72 0.16 155);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

function LegendRow({
  color,
  label,
  hatch,
  dot,
}: {
  color: string;
  label: string;
  hatch?: boolean;
  dot?: boolean;
}) {
  if (dot) {
    return (
      <div className="flex items-center gap-2">
        <span className="relative inline-flex size-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full opacity-50" style={{ background: color }} />
          <span className="relative inline-flex size-2.5 rounded-full" style={{ background: color }} />
        </span>
        <span className="text-muted-foreground">{label}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      {hatch ? (
        <span
          className="size-3.5 rounded-sm border"
          style={{
            borderColor: color,
            background: `repeating-linear-gradient(45deg, ${color}33, ${color}33 2px, transparent 2px, transparent 4px)`,
          }}
        />
      ) : (
        <span className="size-3.5 rounded-sm" style={{ background: color }} />
      )}
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function ChangeRow({
  entityId,
  title,
  kind,
  sub,
}: {
  entityId: string;
  title: string;
  kind: string;
  sub: string;
}) {
  const selectEntity = useGDT((s) => s.selectEntity);
  const col = entityColor(kind as any) ?? "#a1a1aa";
  return (
    <button
      onClick={() => selectEntity(entityId)}
      className="group flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-accent"
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: col, boxShadow: `0 0 6px ${col}` }} />
      <span className="flex-1 min-w-0">
        <span className="block truncate text-[14px] text-foreground/80 group-hover:text-foreground">
          {title}
        </span>
        <span className="block text-[13px] text-muted-foreground font-mono truncate">{sub}</span>
      </span>
    </button>
  );
}
