"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  fetchKnowledgeGraph,
  useAsync,
  type KnowledgeGraph,
  type KnowledgeNodeRecord,
  type KnowledgeEdgeRecord,
} from "@/lib/gdt/api";
import { cn } from "@/lib/utils";
import { SectionLabel } from "@/components/gdt/atoms";
import { Network, Maximize2, Eye, Loader2, AlertTriangle, X } from "lucide-react";

const GW = 960;
const GH = 660;

// Map relation → edge color (per task spec)
function edgeColor(relation: string): string {
  switch (relation) {
    case "causes":
    case "often_precedes":
      return "#34d399"; // emerald
    case "correlates_with":
    case "affects":
      return "#2dd4bf"; // teal
    case "may_threaten":
      return "#f43f5e"; // rose
    default:
      return "#71717a"; // neutral gray for is_a / negatively_correlates / may_indicate / etc.
  }
}

interface PositionedNode extends KnowledgeNodeRecord {
  x: number;
  y: number;
  degree: number;
}

interface Layout {
  nodes: PositionedNode[];
  edges: KnowledgeEdgeRecord[];
  totalCount: number;
  totalEdges: number;
}

// Concentric ring layout: group by category, smallest group innermost.
// Within each ring, distribute nodes in a circle.
function computeLayout(data: KnowledgeGraph): Layout {
  const allNodes = data.nodes;
  const allEdges = data.edges;

  // degree map (across all edges — counts both endpoints)
  const deg: Record<string, number> = {};
  allEdges.forEach((e) => {
    deg[e.from.id] = (deg[e.from.id] ?? 0) + 1;
    deg[e.to.id] = (deg[e.to.id] ?? 0) + 1;
  });

  // group by category
  const groups: Record<string, KnowledgeNodeRecord[]> = {};
  allNodes.forEach((n) => {
    (groups[n.category] ??= []).push(n);
  });

  // smallest group first → innermost ring
  const groupCats = Object.keys(groups).sort(
    (a, b) => groups[a].length - groups[b].length
  );

  const cx = GW / 2;
  const cy = GH / 2;
  const baseR = 75;
  const ringSpacing = 85;

  const positioned: PositionedNode[] = [];
  groupCats.forEach((cat, ringIdx) => {
    const r = baseR + ringIdx * ringSpacing;
    const nodes = groups[cat];
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

  return {
    nodes: positioned,
    edges: allEdges,
    totalCount: allNodes.length,
    totalEdges: allEdges.length,
  };
}

// Node radius 16-22 based on degree
function nodeRadius(degree: number): number {
  if (degree >= 5) return 22;
  if (degree >= 3) return 20;
  if (degree >= 1) return 18;
  return 16;
}

interface ConnEntry {
  edge: KnowledgeEdgeRecord;
  otherId: string;
  dir: "out" | "in";
}

export function KnowledgeGraphView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [vp, setVp] = useState({ scale: 1, tx: 0, ty: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const { data, loading, error } = useAsync(() => fetchKnowledgeGraph(), []);

  const layout = useMemo<Layout | null>(() => {
    if (!data) return null;
    return computeLayout(data);
  }, [data]);

  const nodes = layout?.nodes ?? [];
  const edges = layout?.edges ?? [];

  const nodeById = useMemo(() => {
    const m: Record<string, PositionedNode> = {};
    nodes.forEach((n) => {
      m[n.id] = n;
    });
    return m;
  }, [nodes]);

  // adjacency (between all nodes)
  const adjacency = useMemo(() => {
    const m: Record<string, ConnEntry[]> = {};
    edges.forEach((e) => {
      (m[e.from.id] ??= []).push({ edge: e, otherId: e.to.id, dir: "out" });
      (m[e.to.id] ??= []).push({ edge: e, otherId: e.from.id, dir: "in" });
    });
    return m;
  }, [edges]);

  const focus = hovered ?? selected;
  const connectedSet = useMemo(() => {
    if (!focus) return null;
    const s = new Set<string>([focus]);
    (adjacency[focus] ?? []).forEach((c) => s.add(c.otherId));
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
  };

  const reset = () => setVp({ scale: 1, tx: 0, ty: 0 });

  const focusNode = focus ? nodeById[focus] : null;

  // legend: categories with colors (derived from visible nodes)
  const legendCategories = useMemo(() => {
    const seen: Record<string, { color: string; count: number }> = {};
    nodes.forEach((n) => {
      if (!seen[n.category]) {
        seen[n.category] = { color: n.color, count: 0 };
      }
      seen[n.category].count += 1;
    });
    return Object.entries(seen)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([category, info]) => ({
        category,
        color: info.color,
        count: info.count,
      }));
  }, [nodes]);

  // legend: relation types with colors
  const legendRelations = useMemo(() => {
    const seen: Record<string, number> = {};
    edges.forEach((e) => {
      seen[e.relation] = (seen[e.relation] ?? 0) + 1;
    });
    return Object.entries(seen)
      .sort((a, b) => b[1] - a[1])
      .map(([relation, count]) => ({
        relation,
        color: edgeColor(relation),
        count,
      }));
  }, [edges]);

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
            <span className="text-xs">Failed to load knowledge graph: {error}</span>
          </div>
        )}
        {!loading && !error && nodes.length === 0 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Network className="size-7 opacity-40" />
            <span className="text-xs">No domain concepts defined yet.</span>
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
              const s = nodeById[e.from.id];
              const t = nodeById[e.to.id];
              if (!s || !t) return null;
              const active = !focus || focus === e.from.id || focus === e.to.id;
              const midX = (s.x + t.x) / 2;
              const midY = (s.y + t.y) / 2;
              const col = edgeColor(e.relation);
              const opacity = 0.25 + e.confidence * 0.55;
              return (
                <g key={i} opacity={active ? (focus ? opacity : opacity * 0.85) : 0.06}>
                  <line
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke={col}
                    strokeWidth={active && focus ? 1.6 : 1}
                  />
                  {active && focus && (
                    <text
                      x={midX}
                      y={midY - 3}
                      fill={col}
                      fontSize={8}
                      textAnchor="middle"
                      opacity={0.85}
                      className="font-mono select-none"
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
              const col = n.color;
              const active = !focus || connectedSet?.has(n.id);
              const isFocus = focus === n.id;
              return (
                <g
                  key={n.id}
                  className="cursor-pointer transition-opacity"
                  opacity={active ? 1 : 0.2}
                  onPointerEnter={(e) => {
                    setHovered(n.id);
                    setTooltip({ x: e.clientX, y: e.clientY, text: n.description });
                  }}
                  onPointerMove={(e) => {
                    setTooltip({ x: e.clientX, y: e.clientY, text: n.description });
                  }}
                  onPointerLeave={() => {
                    setHovered(null);
                    setTooltip(null);
                  }}
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
                  <circle cx={n.x} cy={n.y} r={r} fill={`${col}22`} stroke={col} strokeWidth={1.4} />
                  <circle cx={n.x} cy={n.y} r={r - 5} fill={col} />
                  <text
                    x={n.x}
                    y={n.y + r + 12}
                    fill={isFocus ? "#fafafa" : "#a1a1aa"}
                    fontSize={10}
                    fontWeight={isFocus ? 600 : 400}
                    textAnchor="middle"
                    className="select-none"
                  >
                    {n.label.length > 22 ? n.label.slice(0, 20) + "…" : n.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* hover tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none fixed z-50 max-w-xs rounded-lg border border-border bg-card/95 backdrop-blur px-3 py-2 text-[11px] leading-relaxed text-foreground/90 shadow-xl"
            style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
          >
            {tooltip.text}
          </div>
        )}

        {/* header bar */}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card/85 backdrop-blur px-3 py-1.5">
            <Network className="size-4 text-primary" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold">Environmental Knowledge Graph</span>
              <span className="text-[10px] text-muted-foreground">
                Domain concepts and conceptual relationships
              </span>
            </div>
          </div>
          {layout && (
            <div className="flex w-fit items-center gap-2 rounded-lg border border-border bg-card/85 backdrop-blur px-3 py-1.5">
              <span className="text-[10px] text-muted-foreground font-mono tnum">
                {nodes.length} nodes · {edges.length} edges
              </span>
            </div>
          )}
        </div>

        {/* controls */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1">
          <button
            onClick={() => setVp((s) => ({ ...s, scale: Math.min(3.5, s.scale * 1.25) }))}
            className="flex size-8 items-center justify-center rounded-md border border-border bg-card/80 text-foreground/80 hover:text-primary transition-colors"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => setVp((s) => ({ ...s, scale: Math.max(0.6, s.scale / 1.25) }))}
            className="flex size-8 items-center justify-center rounded-md border border-border bg-card/80 text-foreground/80 hover:text-primary transition-colors"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            onClick={reset}
            className="flex size-8 items-center justify-center rounded-md border border-border bg-card/80 text-foreground/80 hover:text-primary transition-colors"
            aria-label="Reset view"
          >
            <Maximize2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Right inspector panel */}
      <div className="hidden w-[300px] shrink-0 flex-col border-l border-border bg-card/20 lg:flex">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-semibold">
              <Eye className="size-3.5 text-primary" /> Inspector
            </h3>
            {focusNode && (
              <button
                onClick={() => setSelected(null)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-3" /> overview
              </button>
            )}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {focusNode ? "Concept details and connections" : "Legend, stats, and overview"}
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
              {/* categories legend */}
              <div>
                <SectionLabel className="mb-2">Categories</SectionLabel>
                <div className="space-y-1 text-[10px]">
                  {legendCategories.map((c) => (
                    <div
                      key={c.category}
                      className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2.5 py-1.5"
                    >
                      <span
                        className="size-3.5 rounded-full"
                        style={{ background: `${c.color}33`, border: `1px solid ${c.color}` }}
                      />
                      <span className="flex-1 truncate text-muted-foreground capitalize">
                        {c.category.replace(/_/g, " ")}
                      </span>
                      <span className="font-mono tnum text-muted-foreground/80">{c.count}</span>
                    </div>
                  ))}
                  {legendCategories.length === 0 && (
                    <div className="text-[10px] text-muted-foreground italic">No concepts loaded.</div>
                  )}
                </div>
              </div>

              {/* relations legend */}
              <div>
                <SectionLabel className="mb-2">Relation Types</SectionLabel>
                <div className="space-y-1 text-[10px]">
                  {legendRelations.map((r) => (
                    <div
                      key={r.relation}
                      className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2.5 py-1.5"
                    >
                      <span className="h-0.5 w-4 rounded-full" style={{ background: r.color }} />
                      <span className="flex-1 truncate font-mono text-muted-foreground">{r.relation}</span>
                      <span className="font-mono tnum text-muted-foreground/80">{r.count}</span>
                    </div>
                  ))}
                  {legendRelations.length === 0 && (
                    <div className="text-[10px] text-muted-foreground italic">No relationships defined.</div>
                  )}
                </div>
              </div>

              {/* stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-card/40 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Nodes</div>
                  <div className="text-lg font-semibold tnum mt-0.5">{nodes.length}</div>
                </div>
                <div className="rounded-lg border border-border bg-card/40 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Edges</div>
                  <div className="text-lg font-semibold tnum mt-0.5">{edges.length}</div>
                </div>
              </div>

              {/* explanation */}
              <div className="rounded-lg border border-border bg-background/40 p-3 text-[11px] text-muted-foreground leading-relaxed">
                This graph represents domain knowledge — conceptual relationships between environmental
                concepts. Separate from the World Model which represents physical entities.
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
  connections: ConnEntry[];
  nodeById: Record<string, PositionedNode>;
  onSelect: (id: string) => void;
}) {
  const col = node.color;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-background/40 p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="size-2.5 rounded-full" style={{ background: col }} />
          <span
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
            style={{ color: col, background: `${col}1a`, border: `1px solid ${col}33` }}
          >
            {node.category.replace(/_/g, " ")}
          </span>
        </div>
        <div className="text-[13px] font-semibold leading-snug">{node.label}</div>
        {node.description && (
          <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">{node.description}</p>
        )}
        <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
          <span>
            degree: <span className="tnum text-foreground/80">{node.degree}</span>
          </span>
          <span className="truncate">
            conceptId: <span className="text-foreground/80">{node.conceptId}</span>
          </span>
        </div>
      </div>

      <div>
        <SectionLabel className="mb-2">Connections ({connections.length})</SectionLabel>
        <div className="space-y-1">
          {connections.map((c, i) => {
            const other = nodeById[c.otherId];
            if (!other) return null;
            const e = c.edge;
            const eColor = edgeColor(e.relation);
            return (
              <button
                key={i}
                onClick={() => onSelect(c.otherId)}
                className="group flex w-full items-center gap-2 rounded-md border border-border bg-background/40 px-2.5 py-1.5 text-left transition-colors hover:border-primary/40 hover:bg-card"
              >
                <span className="size-2 rounded-full shrink-0" style={{ background: other.color }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] truncate">{other.label}</div>
                  <div className="text-[9px] font-mono" style={{ color: eColor }}>
                    {c.dir === "out" ? "→" : "←"} {e.relation}
                    <span className="ml-1 text-muted-foreground">
                      · conf <span className="tnum">{(e.confidence * 100).toFixed(0)}%</span>
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
          {connections.length === 0 && (
            <div className="text-[10px] text-muted-foreground italic">No direct relationships.</div>
          )}
        </div>
      </div>
    </div>
  );
}
