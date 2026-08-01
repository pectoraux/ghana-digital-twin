"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

// Deterministic pseudo-random for stable terrain noise
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type SceneType =
  | "forest_clearing"
  | "excavation"
  | "turbidity"
  | "waterbody_new"
  | "settlement_growth"
  | "deforestation"
  | "generic";

function terrainBlobs(rng: () => number, count: number, color: string, opacity: number) {
  return Array.from({ length: count }, (_, i) => ({
    cx: rng() * 100,
    cy: rng() * 100,
    r: 8 + rng() * 22,
    color,
    opacity: opacity * (0.5 + rng() * 0.5),
    key: i,
  }));
}

/**
 * Procedural "satellite tile" rendering. Looks like a true-color Sentinel-2
 * snippet. `after` toggles whether the change is visible.
 */
export function SyntheticImagery({
  scene,
  after = false,
  seed = 1,
  className,
}: {
  scene: SceneType;
  after?: boolean;
  seed?: number;
  className?: string;
}) {
  const blobs = useMemo(() => {
    const rng = mulberry32(seed);
    return {
      base: terrainBlobs(rng, 6, "#3a4a35", 0.5),
      dark: terrainBlobs(rng, 4, "#27331f", 0.45),
      light: terrainBlobs(rng, 5, "#5a6b3f", 0.35),
    };
  }, [seed]);

  const sceneConfig: Record<SceneType, { before: React.ReactNode; after: React.ReactNode }> = {
    forest_clearing: {
      before: <ellipse cx={62} cy={48} rx={20} ry={16} fill="#2f5a2a" opacity={0.9} />,
      after: (
        <>
          <ellipse cx={62} cy={48} rx={20} ry={16} fill="#6b5535" opacity={0.95} />
          <ellipse cx={62} cy={48} rx={14} ry={11} fill="#8a6a3c" opacity={0.8} />
          <path d="M50 48 L74 48 M62 36 L62 60" stroke="#5a4428" strokeWidth={0.6} opacity={0.5} />
        </>
      ),
    },
    excavation: {
      before: <ellipse cx={58} cy={52} rx={16} ry={13} fill="#3a5a2a" opacity={0.8} />,
      after: (
        <>
          <ellipse cx={58} cy={52} rx={16} ry={13} fill="#7a6240" opacity={0.9} />
          <circle cx={54} cy={50} r={3.2} fill="#1d3a4a" />
          <circle cx={61} cy={55} r={2.6} fill="#1d3a4a" />
          <circle cx={64} cy={48} r={2} fill="#264654" />
          <path d="M44 52 Q58 50 72 54" stroke="#c9a86a" strokeWidth={0.8} fill="none" opacity={0.6} />
        </>
      ),
    },
    turbidity: {
      before: <rect x={20} y={30} width={60} height={40} fill="#16384a" opacity={0.85} />,
      after: <rect x={20} y={30} width={60} height={40} fill="#7a6a3a" opacity={0.8} />,
    },
    waterbody_new: {
      before: <ellipse cx={50} cy={50} rx={10} ry={8} fill="#6b5535" opacity={0.9} />,
      after: (
        <>
          <ellipse cx={50} cy={50} rx={12} ry={9} fill="#1d3a4a" />
          <ellipse cx={50} cy={50} rx={8} ry={6} fill="#2a5566" opacity={0.8} />
        </>
      ),
    },
    settlement_growth: {
      before: <rect x={30} y={35} width={40} height={30} fill="#3a5a2a" opacity={0.7} />,
      after: (
        <>
          <rect x={30} y={35} width={40} height={30} fill="#4a4030" opacity={0.5} />
          <rect x={36} y={42} width={5} height={5} fill="#9a8a6a" />
          <rect x={46} y={40} width={6} height={6} fill="#8a7a5a" />
          <rect x={56} y={44} width={5} height={5} fill="#9a8a6a" />
          <rect x={40} y={52} width={5} height={4} fill="#8a7a5a" />
          <rect x={52} y={54} width={6} height={5} fill="#9a8a6a" />
        </>
      ),
    },
    deforestation: {
      before: <ellipse cx={50} cy={50} rx={22} ry={18} fill="#2f5a2a" opacity={0.9} />,
      after: (
        <>
          <ellipse cx={50} cy={50} rx={22} ry={18} fill="#6b5535" opacity={0.85} />
          <ellipse cx={50} cy={50} rx={16} ry={13} fill="#7a6240" opacity={0.7} />
          <path d="M34 50 L66 50 M50 34 L50 66" stroke="#4a3820" strokeWidth={0.5} opacity={0.4} />
        </>
      ),
    },
    generic: {
      before: null,
      after: null,
    },
  };

  const cfg = sceneConfig[scene];

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className={cn("block h-full w-full", className)}
    >
      {/* base terrain */}
      <rect width={100} height={100} fill="#2a3326" />
      {blobs.base.map((b) => (
        <ellipse key={`b${b.key}`} cx={b.cx} cy={b.cy} rx={b.r} ry={b.r * 0.8} fill={b.color} opacity={b.opacity} />
      ))}
      {blobs.dark.map((b) => (
        <ellipse key={`d${b.key}`} cx={b.cx} cy={b.cy} rx={b.r} ry={b.r * 0.7} fill={b.color} opacity={b.opacity} />
      ))}
      {blobs.light.map((b) => (
        <ellipse key={`l${b.key}`} cx={b.cx} cy={b.cy} rx={b.r * 0.7} ry={b.r * 0.6} fill={b.color} opacity={b.opacity} />
      ))}

      {after ? cfg.after : cfg.before}

      {/* subtle vignette + grain */}
      <rect width={100} height={100} fill="url(#vig)" opacity={0.5} />
      <defs>
        <radialGradient id="vig" cx="50%" cy="50%" r="75%">
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.4" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export function EvidencePanel({
  scene,
  seed,
  beforeDate,
  afterDate,
  changeLabel,
}: {
  scene: SceneType;
  seed: number;
  beforeDate: string;
  afterDate: string;
  changeLabel: string;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <Tile label="BEFORE" date={beforeDate}>
          <SyntheticImagery scene={scene} after={false} seed={seed} />
        </Tile>
        <Tile label="AFTER" date={afterDate} highlight>
          <SyntheticImagery scene={scene} after seed={seed} />
        </Tile>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
        <span>Sentinel-2 L2A · B4/B3/B2</span>
        <span className="text-primary">{changeLabel}</span>
      </div>
    </div>
  );
}

function Tile({
  label,
  date,
  highlight,
  children,
}: {
  label: string;
  date: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-md border border-border bg-black/40">
      {children}
      <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
        <span
          className={cn(
            "rounded px-1 py-0.5 text-[9px] font-mono font-semibold",
            highlight ? "bg-rose-500/90 text-white" : "bg-black/70 text-foreground/80"
          )}
        >
          {label}
        </span>
      </div>
      <div className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1 py-0.5 text-[9px] font-mono text-foreground/80">
        {new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
      </div>
      {highlight && (
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-rose-500/40" />
      )}
    </div>
  );
}
