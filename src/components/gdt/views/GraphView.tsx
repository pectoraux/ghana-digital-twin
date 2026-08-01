"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { fetchGraph, useAsync, type GraphData } from "@/lib/gdt/api";
import { ENTITY_META, entityColor } from "@/lib/gdt/format";
import type { EntityKind } from "@/lib/gdt/types";
import { useGDT } from "@/lib/gdt/store";
import { cn } from "@/lib/utils";
import { SectionLabel } from "@/components/gdt/atoms";
import { Share2, Maximize2, Eye, Loader2, AlertTriangle } from "lucide-react";

const GW = 960;
const GH = 660;

const MAX_NODES = 60;

type GraphNode = GraphData["nodes"][number];
type GraphEdge = GraphData["edges"][number];

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  degree: number;
}

interface Layout {
  nodes: PositionedNode[];
  edges: GraphEdge[];
  totalCount: number;
  totalEdges: number;
}

// ---- layout: concentric rings by kind group ----
// Smallest kind group → innermost ring (needs least space).
// Largest kind group → outermost ring (most circumference).
function computeLayout(data: GraphData): Layout {
  const allNodes = data.nodes;
  const allEdges = data.edges;

  // degree map across ALL edges (so we pick the most connected nodes)
  const deg: Record<string, number> = {};
  allEdges.forEach((e) => {
    deg[e.source] = (deg[e.source] ?? 0) + 1;
    deg[e.target] = (deg[e.target] ?? 0) + 1;
  });

  // pick top-N by degree (ties broken by id for determinism)
  const ranked = [...allNodes].sort((a, b) => {
    const da = deg[a.id] ?? 0;
    const db = deg[b.id] ?? 0;
    if (db !== da) return db - da;
    return a.id.localeCompare(b.id);
  });
  const limit = Math.min(MAX_NODES, ranked.length);
  const topNodes = ranked.slice(0, limit);
  const topIds = new Set(topNodes.map((n) => n.id));

  // keep only edges between two visible nodes
  const topEdges = allEdges.filter((e) => topIds.has(e.source) && topIds.has(e.target));

  // group by kind
  const groups: Record<string, GraphNode[]> = {};
  topNodes.forEach((n) => {
    (groups[n.kind] ??= []).push(n);
  });

  // smallest group first (innermost), largest last (outermost)
  const groupKinds = Object.keys(groups).sort((a, b) => groups[a].length - groups[b].length);

  const cx = GW / 2;
  const cy = GH / 2;
  const baseR = 55;
  const ringSpacing = 52;

  const positioned: PositionedNode[] = [];
  groupKinds.forEach((kind, ringIdx) => {
    const r = baseR + ringIdx * ringSpacing;
    const nodes = groups[kind];
    const phase = (ringIdx * Math.PI) / 4; // stagger starting angle per ring
    nodes.forEach((n, i) => {
      const angle = phase + (2 * Math.PI * i) / nodes.length;
      positioned.push({
        ...n,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        degree: deg[n.id] ?? 0,
      });
    });
  });

  return { nodes: positioned, edges: topEdges, totalCount: allNodes.length, totalEdges: allEdges.length };
}

function nodeRadius(degree: number): number {
  if (degree >= 6) return 13;
  if (degree >= 3) return 11;
  if (degree >= 1) return 9;
  return 7;
}

export function GraphView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [vp, setVp] = useState({ scale: 1, tx: 0, ty: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const selectEntity = useGDT((s) => s.selectEntity);

  const { data, loading, error } = useAsync(() => fetchGraph(), []);

  const layout = useMemo<Layout | null>(() => {
    if (!data) return null;
    return computeLayout(data);
  }, [data]);

  const nodes = layout?.nodes ?? [];
  const edges = layout?.edges ?? [];

  const nodeById = useMemo(() => {
    const m: Record<string, PositionedNode> = {};
    nodes.forEach((n) => (m[n.id] = n));
    return m;
  }, [nodes]);

  // adjacency (between visible nodes only)
  const adjacency = useMemo(() => {
    const m: Record<string, { node: string; relation: string; dir: "out" | "in"; inferredBy: string }[]> = {};
    edges.forEach((e) => {
      (m[e.source] ??= []).push({ node: e.target, relation: e.relation, dir: "out", inferredBy: e.inferredBy });
      (m[e.target] ??= []).push({ node: e.source, relation: e.relation, dir: "in", inferredBy: e.inferredBy });
    });
    return m;
  }, [edges]);

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
      setVp((s) => ({
        ...s,
        tx: dragStart.current!.tx + (P.x - dragStart.current!.x),
        ty: dragStart.current!.ty + (P.y - dragStart.current!.y),
      }));
    },
    [clientToSvg, dragging]
  );
  const onPointerUp = useCallback(() => {
    setDragging(false);
    dragStart.current = null;
  }, []);

  const onNodeClick = (id: string) => {
    setSelected(id);
    selectEntity(id);
  };

  const reset = () => setVp({ scale: 1, tx: 0, ty: 0 });

  const focusNode = focus ? nodeById[focus] : null;

  // legend derived from visible nodes' kinds
  const legendKinds = useMemo(() => {
    const seen: Record<string, number> = {};
    nodes.forEach((n) => (seen[n.kind] = (seen[n.kind] ?? 0) + 1));
    return Object.entries(seen)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([kind, count]) => ({
        kind,
        color: entityColor(kind as EntityKind),
        label: ENTITY_META[kind as keyof typeof ENTITY_META]?.label ?? kind.replace(/_/g, " "),
        count,
      }));
  }, [nodes]);

  return (
    <div className="flex h-full w-full">
      {/* Graph canvas */}
      <div className="relative min-w-0 flex-1 overflow-hidden bg-[oklch(0.135_0.006_165)]">
        <div className="absolute inset-0 gdt-dot-bg opacity-50" />

        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-7 animate-spin text-primary" />
            <span className="text-xs">Loading knowledge graph…</span>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <AlertTriangle className="size-7 text-rose-400" />
            <span className="text-xs">Failed to load graph: {error}</span>
          </div>
        )}
        {!loading && !error && nodes.length === 0 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Share2 className="size-7 opacity-40" />
            <span className="text-xs">No entities or relationships in the world model yet.</span>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${GW} ${GH}`}
          preserveAspectRatio="xMidYMid meet"
          className={cn(
            "absolute inset-0 h-full w-full touch-none",
            dragging ? "cursor-grabbing" : "cursor-grab",
            (loading || error) && "opacity-40"
          )}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <g transform={`translate(${vp.tx} ${vp.ty}) scale(${vp.scale})`}>
            {/* edges */}
            {edges.map((e, i) => {
              const s = nodeById[e.source];
              const t = nodeById[e.target];
              if (!s || !t) return null;
              const active = !focus || focus === e.source || focus === e.target;
              const midX = (s.x + t.x) / 2;
              const midY = (s.y + t.y) / 2;
              return (
                <g key={i} opacity={active ? (focus ? 0.6 : 0.35) : 0.06}>
                  <line
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke={active && focus ? "#34d399" : "#52525b"}
                    strokeWidth={active && focus ? 1.4 : 0.8}
                  />
                  {active && focus && (
                    <text
                      x={midX}
                      y={midY - 3}
                      fill="#34d399"
                      fontSize={8}
                      textAnchor="middle"
                      opacity={0.7}
                      className="font-mono"
                    >
                      {e.relation}
                    </text>
                  )}
                </g>
              );
            })}

            {/* nodes */}
            {nodes.map((n) => {
              const r = nodeRadius(n.degree);
              const col = entityColor(n.kind as EntityKind);
              const active = !focus || connectedSet?.has(n.id);
              const isFocus = focus === n.id;
              return (
                <g
                  key={n.id}
                  className="cursor-pointer transition-opacity"
                  opacity={active ? 1 : 0.2}
                  onPointerEnter={() => setHovered(n.id)}
                  onPointerLeave={() => setHovered(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNodeClick(n.id);
                  }}
                >
                  {isFocus && (
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={r + 6}
                      fill="none"
                      stroke={col}
                      strokeWidth={1}
                      strokeDasharray="2 2"
                    />
                  )}
                  <circle cx={n.x} cy={n.y} r={r} fill={`${col}22`} stroke={col} strokeWidth={1.2} />
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
            <span className="text-[10px] text-muted-foreground font-mono tnum">
              {layout
                ? `${nodes.length} / ${layout.totalCount} nodes · ${edges.length} / ${layout.totalEdges} edges`
                : "…"}
            </span>
          </div>
          {layout && layout.totalCount > MAX_NODES && (
            <span className="rounded-md border border-border bg-card/85 backdrop-blur px-2 py-1 text-[10px] text-muted-foreground">
              showing top <span className="font-mono tnum text-foreground">{MAX_NODES}</span> by degree
            </span>
          )}
        </div>

        {/* legend */}
        <div className="absolute right-3 top-3 w-[180px] rounded-lg border border-border bg-card/85 backdrop-blur p-2.5">
          <SectionLabel className="mb-2">Node Kinds</SectionLabel>
          <div className="space-y-1 text-[10px]">
            {legendKinds.map((k) => (
              <div key={k.kind} className="flex items-center gap-2">
                <span
                  className="size-3.5 rounded-full"
                  style={{ background: `${k.color}33`, border: `1px solid ${k.color}` }}
                />
                <span className="flex-1 truncate text-muted-foreground">{k.label}</span>
                <span className="font-mono tnum text-muted-foreground/80">{k.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* controls */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1">
          <button
            onClick={() => setVp((s) => ({ ...s, scale: Math.min(3.5, s.scale * 1.25) }))}
            className="flex size-8 items-center justify-center rounded-md border border-border bg-card/80 text-foreground/80 hover:text-primary transition-colors"
          >
            +
          </button>
          <button
            onClick={() => setVp((s) => ({ ...s, scale: Math.max(0.6, s.scale / 1.25) }))}
            className="flex size-8 items-center justify-center rounded-md border border-border bg-card/80 text-foreground/80 hover:text-primary transition-colors"
          >
            −
          </button>
          <button
            onClick={reset}
            className="flex size-8 items-center justify-center rounded-md border border-border bg-card/80 text-foreground/80 hover:text-primary transition-colors"
          >
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
          <p className="mt-1 text-[10px] text-muted-foreground">
            Hover or select a node to inspect its connections
          </p>
        </div>
        <div className="min-h-0 flex-1 gdt-scroll overflow-y-auto p-3">
          {focusNode ? (
            <NodeInspector
              node={focusNode}
              connections={adjacency[focusNode.id] ?? []}
              nodeById={nodeById}
              onSelect={(id) => onNodeClick(id)}
            />
          ) : (
            <div className="space-y-3">
              <SectionLabel>Relation Types</SectionLabel>
              <div className="space-y-1.5">
                {Array.from(new Set(edges.map((e) => e.relation)))
                  .map((rel) => ({ rel, count: edges.filter((e) => e.relation === rel).length }))
                  .sort((a, b) => b.count - a.count)
                  .map(({ rel, count }) => (
                    <div
                      key={rel}
                      className="flex items-center justify-between rounded-md border border-border bg-background/40 px-2.5 py-1.5"
                    >
                      <span className="font-mono text-[10px] text-foreground/80">{rel}</span>
                      <span className="font-mono text-[10px] tnum text-muted-foreground">{count}</span>
                    </div>
                  ))}
                {edges.length === 0 && (
                  <div className="text-[10px] text-muted-foreground italic">No relationships in current view.</div>
                )}
              </div>
              <div className="rounded-lg border border-border bg-background/40 p-3 text-[11px] text-muted-foreground leading-relaxed">
                The knowledge graph connects every Entity through typed spatial, hydrological, and source-inferred
                relationships. It supports cross-graph reasoning for downstream intelligence systems.
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
  nodeById,
  onSelect,
}: {
  node: PositionedNode;
  connections: { node: string; relation: string; dir: "out" | "in"; inferredBy: string }[];
  nodeById: Record<string, PositionedNode>;
  onSelect: (id: string) => void;
}) {
  const col = entityColor(node.kind as EntityKind);
  const kindLabel = ENTITY_META[node.kind as keyof typeof ENTITY_META]?.label ?? node.kind.replace(/_/g, " ");

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-background/40 p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="size-2.5 rounded-full" style={{ background: col }} />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{kindLabel}</span>
        </div>
        <div className="text-[13px] font-semibold leading-snug">{node.label}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground font-mono">
          <span>deg: <span className="tnum text-foreground/80">{node.degree}</span></span>
          {node.regionId && <span>region: <span className="text-foreground/80">{node.regionId}</span></span>}
          <span className="truncate">
            ll: <span className="text-foreground/80 tnum">{node.centroid[0].toFixed(3)}, {node.centroid[1].toFixed(3)}</span>
          </span>
        </div>
      </div>

      <div>
        <SectionLabel className="mb-2">Connections ({connections.length})</SectionLabel>
        <div className="space-y-1">
          {connections.map((c, i) => {
            const n = nodeById[c.node];
            if (!n) return null;
            const cColor = entityColor(n.kind as EntityKind);
            return (
              <button
                key={i}
                onClick={() => onSelect(c.node)}
                className="group flex w-full items-center gap-2 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-left transition-colors hover:border-primary/40 hover:bg-card"
              >
                <span className="size-2 rounded-full shrink-0" style={{ background: cColor }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] truncate">{n.label}</div>
                  <div className="text-[9px] font-mono text-muted-foreground">
                    {c.dir === "out" ? "→" : "←"} {c.relation}
                    {c.inferredBy && c.inferredBy !== "spatial" && (
                      <span className="ml-1 opacity-70">· {c.inferredBy}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {connections.length === 0 && (
            <div className="text-[10px] text-muted-foreground italic">No direct relationships in current view.</div>
          )}
        </div>
      </div>
    </div>
  );
}
