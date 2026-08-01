"use client";

import { useGDT } from "@/lib/gdt/store";
import type { ViewId } from "@/lib/gdt/types";
import { cn } from "@/lib/utils";
import {
  Map as MapIcon,
  Eye,
  Clock,
  Brain,
  Crosshair,
  ShieldCheck,
  Puzzle,
  Radar,
  CheckCircle2,
  Layers3,
  Boxes,
  Share2,
  Database,
  Satellite,
  Grid3x3,
  RadioTower,
  Users,
  Network,
  Store,
  Coins,
  Globe,
  Activity,
  Scale,
  Terminal,
  Settings,
  HelpCircle,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const NAV: { id: ViewId; label: string; icon: React.ElementType; hint: string }[] = [
  { id: "atlas", label: "Atlas", icon: MapIcon, hint: "Geospatial world view" },
  { id: "observations", label: "Observations", icon: Eye, hint: "Fused evidence observations" },
  { id: "phenomena", label: "Phenomena", icon: Clock, hint: "Evolving events tracked over time" },
  { id: "intelligence", label: "Intelligence", icon: Brain, hint: "Ranked hypotheses, Bayesian reasoning, scenarios" },
  { id: "missions", label: "Missions", icon: Crosshair, hint: "Autonomous mission planning & data acquisition" },
  { id: "validation", label: "Validation", icon: ShieldCheck, hint: "Replay testing, scientific evaluation & observability" },
  { id: "extensions", label: "Extensions", icon: Puzzle, hint: "Domain extensions: mining, flood, agriculture, forestry" },
  { id: "continuous", label: "Continuous", icon: Radar, hint: "Nationwide pipeline & learning engine" },
  { id: "groundtruth", label: "Ground Truth", icon: CheckCircle2, hint: "Active learning, calibration & drift detection" },
  { id: "multimodal", label: "Multi-Modal", icon: Layers3, hint: "Multi-modal evidence fusion & feature store" },
  { id: "entities", label: "Entities", icon: Boxes, hint: "Entity registry" },
  { id: "graph", label: "Entity Graph", icon: Share2, hint: "Entity relationship graph" },
  { id: "knowledge", label: "Env Knowledge", icon: Brain, hint: "Domain knowledge graph" },
  { id: "eo", label: "Earth Observation", icon: Satellite, hint: "Sentinel-2 imagery & spectral indices" },
  { id: "raster", label: "Raster Intelligence", icon: Grid3x3, hint: "Anomaly maps, baselines & uncertainty" },
  { id: "sources", label: "Data Sources", icon: Database, hint: "Pipeline & connectors" },
  { id: "command", label: "Command Center", icon: RadioTower, hint: "National intelligence command: incidents, workflows, decisions, evidence rooms" },
  { id: "community", label: "Community", icon: Users, hint: "Citizen intelligence network: events, witnesses, civic scores, rewards" },
  { id: "civic-trust", label: "Civic Trust", icon: Network, hint: "Trust graph, propagation, Sybil resistance, identity vouching" },
  { id: "marketplace", label: "Marketplace", icon: Store, hint: "Intelligence marketplace: requests, assets, bounties, value attribution" },
  { id: "finance", label: "Finance", icon: Coins, hint: "Intelligence finance: credits, licensing, royalties, agent economy, insurance" },
  { id: "federation", label: "Federation", icon: Globe, hint: "Federated intelligence network: nodes, trust proofs, cross-border markets, treaties" },
  { id: "os", label: "OS Marketplace", icon: Boxes, hint: "Intelligence OS: package registry, developers, solutions, intelligence graph" },
  { id: "reality", label: "Reality Feed", icon: Activity, hint: "Continuous ingestion, freshness monitoring, automatic observation triggers" },
  { id: "governance", label: "Governance", icon: Scale, hint: "Constitution, council, courts, proposals — who governs the intelligence civilization" },
  { id: "gov-intel", label: "Gov Intelligence", icon: Brain, hint: "Governance agents, legal precedents, institutional reputation, compliance audits" },
  { id: "api", label: "API", icon: Terminal, hint: "Programmatic access" },
];

export function NavRail() {
  const view = useGDT((s) => s.view);
  const setView = useGDT((s) => s.setView);
  const setPaletteOpen = useGDT((s) => s.setPaletteOpen);

  return (
    <TooltipProvider delayDuration={200}>
      <nav className="flex w-[56px] shrink-0 flex-col items-center border-r border-border bg-sidebar/60 py-2">
        {/* Logo mark */}
        <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary/15 border border-primary/30 text-primary">
          <svg viewBox="0 0 24 24" className="size-5" fill="none">
            <path
              d="M12 2 3 7v10l9 5 9-5V7l-9-5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M12 2v20M3 7l9 5 9-5" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
          </svg>
        </div>

        <div className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = view === item.id;
            const Icon = item.icon;
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setView(item.id)}
                    className={cn(
                      "group relative flex size-10 items-center justify-center rounded-lg transition-all",
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {active && (
                      <span className="absolute left-[-10px] top-1/2 h-5 -translate-y-1/2 w-[3px] rounded-full bg-primary" />
                    )}
                    <Icon className="size-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <div className="font-medium">{item.label}</div>
                  <div className="text-[10px] text-muted-foreground">{item.hint}</div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <div className="mt-auto flex flex-col gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setPaletteOpen(true)}
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <kbd className="text-[9px] font-mono border border-border rounded px-1 py-0.5">⌘K</kbd>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Command palette
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <Settings className="size-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Settings
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <HelpCircle className="size-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Documentation
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>
    </TooltipProvider>
  );
}
