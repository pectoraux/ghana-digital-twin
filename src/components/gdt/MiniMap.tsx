"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  GHANA_OUTLINE,
  project,
  type LngLat,
} from "@/lib/gdt/geo";
import {
  Loader2,
  MapPin,
  AlertTriangle,
  Eye,
  Target,
  Navigation,
} from "lucide-react";

const MARKER_COLORS: Record<string, string> = {
  ALERT: "#f43f5e",
  REPORT: "#fbbf24",
  MISSION: "#22d3ee",
  illegal_mining: "#f43f5e",
  flood_risk: "#38bdf8",
  deforestation: "#84cc16",
  water_pollution: "#22d3ee",
  cocoa_disease: "#fbbf24",
  land_degradation: "#fb923c",
  other: "#a1a1aa",
};

interface Marker {
  id: string;
  kind: "feed" | "event";
  type: string;
  title: string;
  region: string;
  confidence: number;
  status?: string;
  lng: number;
  lat: number;
}

interface MiniMapProps {
  onMarkerClick?: (marker: Marker) => void;
  height?: number;
}

export function MiniMap({ onMarkerClick, height = 260 }: MiniMapProps) {
  const { data: session } = useSession();
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [userRegion, setUserRegion] = useState<string>("");
  const [userCentroid, setUserCentroid] = useState<{ lng: number; lat: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<Marker | null>(null);

  useEffect(() => {
    const userId = (session?.user as any)?.id;
    fetch(`/api/home/map-data${userId ? `?userId=${userId}` : ""}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setMarkers(data.markers || []);
          setUserRegion(data.userRegion || "");
          setUserCentroid(data.userRegionCentroid || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  const width = 320;
  const h = height;
  const outlinePath = GHANA_OUTLINE
    .map((coord, i) => `${i === 0 ? "M" : "L"} ${project(coord, width, h)[0].toFixed(1)} ${project(coord, width, h)[1].toFixed(1)}`)
    .join(" ") + " Z";

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <Navigation className="size-5 text-primary" />
        <h2 className="text-[20px] font-semibold">Activity Map</h2>
        <span className="ml-auto text-[13px] text-muted-foreground">
          {markers.length} active {markers.length === 1 ? "marker" : "markers"}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-border bg-background" style={{ height: h }}>
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${h}`}
            className="h-full w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Ghana outline */}
            <path
              d={outlinePath}
              fill="hsl(var(--card) / 0.5)"
              stroke="hsl(var(--border))"
              strokeWidth="1"
              className="opacity-80"
            />

            {/* User region indicator */}
            {userCentroid && (() => {
              const [x, y] = project([userCentroid.lng, userCentroid.lat], width, h);
              return (
                <g>
                  <circle cx={x} cy={y} r="14" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.3">
                    <animate attributeName="r" values="10;18;10" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={x} cy={y} r="5" fill="#3b82f6" opacity="0.6" />
                </g>
              );
            })()}

            {/* Markers */}
            {markers.map((m) => {
              const [x, y] = project([m.lng, m.lat], width, h);
              const color = MARKER_COLORS[m.type] ?? "#a1a1aa";
              const isEvent = m.kind === "event";
              const r = isEvent ? 5 : 4;
              return (
                <g key={m.id}>
                  {/* Pulsing ring for urgent items */}
                  {(m.type === "ALERT" || m.type === "illegal_mining" || m.status === "witnessing") && (
                    <circle cx={x} cy={y} r={r + 4} fill="none" stroke={color} strokeWidth="1" opacity="0.3">
                      <animate attributeName="r" values={`${r};${r + 6};${r}`} dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r={r}
                    fill={color}
                    stroke="white"
                    strokeWidth="1.5"
                    className="cursor-pointer transition-all hover:opacity-80"
                    onClick={() => onMarkerClick?.(m)}
                    onMouseEnter={() => setHovered(m)}
                    onMouseLeave={() => setHovered(null)}
                  />
                </g>
              );
            })}
          </svg>
        )}

        {/* Hover tooltip */}
        {hovered && (
          <div className="pointer-events-none absolute left-2 top-2 max-w-[220px] rounded-lg border border-border bg-card/95 p-2 shadow-lg backdrop-blur">
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                style={{ color: MARKER_COLORS[hovered.type] ?? "#a1a1aa", background: `${MARKER_COLORS[hovered.type] ?? "#a1a1aa"}15` }}
              >
                {hovered.type.replace(/_/g, " ")}
              </span>
              {hovered.status && (
                <span className="text-[10px] text-muted-foreground">{hovered.status}</span>
              )}
            </div>
            <p className="text-[13px] font-medium line-clamp-2">{hovered.title}</p>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <MapPin className="size-3" /> {hovered.region}
              </span>
              {hovered.confidence > 0 && (
                <span>{(hovered.confidence * 100).toFixed(0)}% conf</span>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-2 right-2 flex items-center gap-2 rounded-md border border-border bg-card/80 px-2 py-1 backdrop-blur">
          {[
            { color: "#f43f5e", label: "Alert" },
            { color: "#fbbf24", label: "Report" },
            { color: "#22d3ee", label: "Mission" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ background: l.color }} />
              <span className="text-[10px] text-muted-foreground">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Region label */}
      {userRegion && (
        <p className="text-[13px] text-muted-foreground mt-2 flex items-center gap-1">
          <MapPin className="size-3.5" /> Showing activity near {userRegion}
        </p>
      )}
    </div>
  );
}
