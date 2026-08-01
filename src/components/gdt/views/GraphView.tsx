"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { GRAPH_NODES, GRAPH_EDGES } from "@/lib/gdt/graph";
import { entityById } from "@/lib/gdt/entities";
import { observationById } from "@/lib/gdt/observations";
import { ENTITY_META, entityColor, OBS_META, obsColor } from "@/lib/gdt/format";
import { useGDT } from "@/lib/gdt/store";
import { cn } from "@/lib/utils";
import { SectionLabel, StatusDot } from "@/components/gdt/atoms";
import { Share2, Maximize2, Eye, Eye as EyeIcon } from "lucide-react";

const GW = 960;
const GH = 660;

// node color resolver
function nodeColor(n: (typeof GRAPH_NODES)[number]): string {
  if (n.kind === "observation") return "#fb923c";
  if (n.kind === "river" || n.kind === "lake") return "#2dd4bf";
  if (n.kind === "forest" || n.kind === "protected_area") return "#34d399";
  if (n.kind === "watershed" || n.kind === "coastline") return "#22d3ee";
  if (n.kind === "dam") return "#f59e0b";
  if (n.kind === "excavation" || n.kind === "waterbody_mined") return "#f43f5e";
  return "#a1a1aa";
}

function nodeRadius(n: (typeof GRAPH_NODES)[number], degree: number): number {
  if (n.kind === "observation") return 7;
  if (degree >= 4) return 13;
  if (degree >= 2) return 10;
  return 8;
}

export function GraphView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [vp, setVp] = useState({ scale: 1, tx: 0, ty: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const selectEntity = useGDT((s) => s.selectEntity);
  const selectObservation = useGDT((s) => s.selectObservation);
  const setView = useGDT((s) => s.setView);

  // degree map
  const degree = useMemo(() => {
    const m: Record<string, number> = {};
    GRAPH_EDGES.forEach((e) => {
      m[e.source] = (m[e.source] ?? 0) + 1;
      m[e.target] = (m[e.target] ?? 0) + 1;
    });
    return m;
  }, []);

  // adjacency
  const adjacency = useMemo(() => {
    const m: Record<string, { node: string; relation: string; dir: "out" | "in" }[]> = {};
    GRAPH_EDGES.forEach((e) => {
      (m[e.source] ??= []).push({ node: e.target, relation: e.relation, dir: "out" });
      (m[e.target] ??= []).push({ node: e.source, relation: e.relation, dir: "in" });
    });
    return m;
  }, []);

  const focus = hovered ?? selected;
  const connectedSet = useMemo(() => {
    if (!focus) return null;
    const s = new Set<string>([focus]);
    (adjacency[focus] ?? []).forEach((c) => s.add(c.node));
    return s;
  }, [focus, adjacency]);

  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return pt.matrixTransform(ctm.inverse());
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const P = clientToSvg(e.clientX, e.clientY);
      setVp((s) => {
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const ns = Math.max(0.6, Math.min(3.5, s.scale * factor));
        if (ns === s.scale) return s;
        const Lx = (P.x - s.tx) / s.scale;
        const Ly = (P.y - s.ty) / s.scale;
        return { scale: ns, tx: P.x - Lx * ns, ty: P.y - Ly * ns };
      });
    },
    [clientToSvg]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const P = clientToSvg(e.clientX, e.clientY);
      dragStart.current = { x: P.x, y: P.y, tx: vp.tx, ty: vp.ty };
      setDragging(true);
    },
    [clientToSvg, vp]
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !dragStart.current) return;
      const P = clientToSvg(e.clientX, e.clientY);
      setVp((s) => ({ ...s, tx: dragStart.current!.tx + (P.x - dragStart.current!.x), ty: dragStart.current!.ty + (P.y - dragStart.current!.y) }));
    },
    [clientToSvg, dragging]
  );
  const onPointerUp = useCallback(() => {
    setDragging(false);
    dragStart.current = null;
  }, []);

  const onNodeClick = (id: string) => {
    setSelected(id);
    if (id.startsWith("obs-")) {
      selectObservation(id);
    } else if (id.startsWith("ent-")) {
      selectEntity(id);
    }
  };

  const reset = () => setVp({ scale: 1, tx: 0, ty: 0 });

  const focusNode = focus ? GRAPH_NODES.find((n) => n.id === focus) : null;

  return (
    <div className="flex h-full w-full">
      {/* Graph canvas */}
      <div className="relative min-w-0 flex-1 overflow-hidden bg-[oklch(0.135_0.006_165)]">
        <div className="absolute inset-0 gdt-dot-bg opacity-50" />
        <svg
          ref={svgRef}
          viewBox={`0 0 ${GW} ${GH}`}
          preserveAspectRatio="xMidYMid meet"
          className={cn("absolute inset-0 h-full w-full touch-none", dragging ? "cursor-grabbing" : "cursor-grab")}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <g transform={`translate(${vp.tx} ${vp.ty}) scale(${vp.scale})`}>
            {/* edges */}
            {GRAPH_EDGES.map((e, i) => {
              const s = GRAPH_NODES.find((n) => n.id === e.source)!;
              const t = GRAPH_NODES.find((n) => n.id === e.target)!;
              const active = !focus || (focus === e.source || focus === e.target);
              const midX = (s.x + t.x) / 2;
              const midY = (s.y + t.y) / 2;
              return (
                <g key={i} opacity={active ? 0.5 : 0.08}>
                  <line x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke={active && focus ? "#34d399" : "#52525b"} strokeWidth={active && focus ? 1.4 : 0.8} />
                  {active && focus && (
                    <text x={midX} y={midY - 3} fill="#34d399" fontSize={8} textAnchor="middle" opacity={0.7} className="font-mono">
                      {e.relation}
                    </text>
                  )}
                </g>
              );
            })}

            {/* nodes */}
            {GRAPH_NODES.map((n) => {
              const d = degree[n.id] ?? 0;
              const r = nodeRadius(n, d);
              const col = nodeColor(n);
              const active = !focus || connectedSet?.has(n.id);
              const isFocus = focus === n.id;
              const isObs = n.kind === "observation";
              return (
                <g
                  key={n.id}
                  className="cursor-pointer transition-opacity"
                  opacity={active ? 1 : 0.2}
                  onPointerEnter={() => setHovered(n.id)}
                  onPointerLeave={() => setHovered(null)}
                  onClick={(e) => { e.stopPropagation(); onNodeClick(n.id); }}
                >
                  {isObs && (
                    <circle cx={n.x} cy={n.y} r={r} fill="none" stroke={col} strokeWidth={1} className="gdt-ping" style={{ transformOrigin: `${n.x}px ${n.y}px` }} />
                  )}
                  {isFocus && <circle cx={n.x} cy={n.y} r={r + 6} fill="none" stroke={col} strokeWidth={1} strokeDasharray="2 2" />}
                  <circle cx={n.x} cy={n.y} r={r} fill={`${col}22`} stroke={col} strokeWidth={isObs ? 1.5 : 1.2} />
                  <circle cx={n.x} cy={n.y} r={r - 3} fill={col} />
                  <text
                    x={n.x}
                    y={n.y + r + 11}
                    fill={isFocus ? "#fafafa" : "#a1a1aa"}
                    fontSize={9}
                    fontWeight={isFocus ? 600 : 400}
                    textAnchor="middle"
                    className="select-none"
                  >
                    {n.label.length > 20 ? n.label.slice(0, 18) + "…" : n.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* header */}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card/85 backdrop-blur px-3 py-1.5">
            <Share2 className="size-4 text-primary" />
            <span className="text-xs font-semibold">Knowledge Graph</span>
            <span className="text-[10px] text-muted-foreground font-mono">{GRAPH_NODES.length} nodes · {GRAPH_EDGES.length} edges</span>
          </div>
        </div>

        {/* legend */}
        <div className="absolute right-3 top-3 w-[170px] rounded-lg border border-border bg-card/85 backdrop-blur p-2.5">
          <SectionLabel className="mb-2">Node Types</SectionLabel>
          <div className="space-y-1 text-[10px]">
            <LegRow color="#2dd4bf" label="River / Water" />
            <LegRow color="#34d399" label="Forest / Protected" />
            <LegRow color="#f59e0b" label="Dam / Infrastructure" />
            <LegRow color="#f43f5e" label="Excavation / Mining" />
            <LegRow color="#fb923c" label="Observation" ring />
          </div>
        </div>

        {/* controls */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1">
          <button onClick={() => setVp((s) => ({ ...s, scale: Math.min(3.5, s.scale * 1.25) }))} className="flex size-8 items-center justify-center rounded-md border border-border bg-card/80 text-foreground/80 hover:text-primary">+</button>
          <button onClick={() => setVp((s) => ({ ...s, scale: Math.max(0.6, s.scale / 1.25) }))} className="flex size-8 items-center justify-center rounded-md border border-border bg-card/80 text-foreground/80 hover:text-primary">−</button>
          <button onClick={reset} className="flex size-8 items-center justify-center rounded-md border border-border bg-card/80 text-foreground/80 hover:text-primary">
            <Maximize2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Relationships panel */}
      <div className="hidden w-[300px] shrink-0 flex-col border-l border-border bg-card/20 lg:flex">
        <div className="border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold">
            <Eye className="size-3.5 text-primary" /> Relationships
          </h3>
          <p className="mt-1 text-[10px] text-muted-foreground">Hover or select a node to inspect its connections</p>
        </div>
        <div className="min-h-0 flex-1 gdt-scroll overflow-y-auto p-3">
          {focusNode ? (
            <NodeInspector
              node={focusNode}
              connections={adjacency[focusNode.id] ?? []}
              onSelect={(id) => onNodeClick(id)}
            />
          ) : (
            <div className="space-y-3">
              <SectionLabel>Relation Types</SectionLabel>
              <div className="space-y-1.5">
                {Array.from(new Set(GRAPH_EDGES.map((e) => e.relation))).map((rel) => {
                  const count = GRAPH_EDGES.filter((e) => e.relation === rel).length;
                  return (
                    <div key={rel} className="flex items-center justify-between rounded-md border border-border bg-background/40 px-2.5 py-1.5">
                      <span className="font-mono text-[10px] text-foreground/80">{rel}</span>
                      <span className="font-mono text-[10px] tnum text-muted-foreground">{count}</span>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-lg border border-border bg-background/40 p-3 text-[11px] text-muted-foreground leading-relaxed">
                The knowledge graph connects every Entity through typed spatial, hydrological, and observational relationships. It supports cross-graph reasoning for downstream intelligence systems.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NodeInspector({
  node,
  connections,
  onSelect,
}: {
  node: (typeof GRAPH_NODES)[number];
  connections: { node: string; relation: string; dir: "out" | "in" }[];
  onSelect: (id: string) => void;
}) {
  const isObs = node.kind === "observation";
  const col = nodeColor(node);
  const detail = !isObs && node.id.startsWith("ent-") ? entityById(node.id) : isObs ? observationById(node.id) : null;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-background/40 p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="size-2.5 rounded-full" style={{ background: col }} />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {isObs ? "Observation" : ENTITY_META[node.kind as keyof typeof ENTITY_META]?.label ?? node.kind}
          </span>
        </div>
        <div className="text-[13px] font-semibold">{node.label}</div>
        {node.region && <div className="text-[10px] text-muted-foreground mt-0.5">{node.region}</div>}
        {detail && "summary" in detail && (
          <p className="text-[11px] text-foreground/70 mt-2 leading-relaxed line-clamp-3">{detail.summary}</p>
        )}
        {detail && "kind" in detail && (
          <p className="text-[11px] text-foreground/70 mt-2 leading-relaxed">
            {detail.attributes && Object.entries(detail.attributes).slice(0, 3).map(([k, v]) => (
              <span key={k} className="mr-2 font-mono text-[10px] text-muted-foreground">{k}: {String(v)}</span>
            ))}
          </p>
        )}
      </div>

      <div>
        <SectionLabel className="mb-2">Connections ({connections.length})</SectionLabel>
        <div className="space-y-1">
          {connections.map((c, i) => {
            const n = GRAPH_NODES.find((x) => x.id === c.node);
            if (!n) return null;
            return (
              <button
                key={i}
                onClick={() => onSelect(c.node)}
                className="group flex w-full items-center gap-2 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-left transition-colors hover:border-primary/40 hover:bg-card"
              >
                <span className="size-2 rounded-full" style={{ background: nodeColor(n) }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] truncate">{n.label}</div>
                  <div className="text-[9px] font-mono text-muted-foreground">
                    {c.dir === "out" ? "→" : "←"} {c.relation}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function LegRow({ color, label, ring }: { color: string; label: string; ring?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {ring ? (
        <span className="size-3.5 rounded-full border-2" style={{ borderColor: color, background: `${color}22` }} />
      ) : (
        <span className="size-3.5 rounded-full" style={{ background: `${color}33`, border: `1px solid ${color}` }} />
      )}
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
