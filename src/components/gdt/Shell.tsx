"use client";

import { useGDT } from "@/lib/gdt/store";
import { CommandBar } from "./CommandBar";
import { NavRail } from "./NavRail";
import { Inspector } from "./Inspector";
import { StatusBar } from "./StatusBar";
import { CommandPalette } from "./CommandPalette";
import { LiveEngine } from "./LiveEngine";
import { AtlasView } from "./views/AtlasView";
import { ObservationsView } from "./views/ObservationsView";
import { EntitiesView } from "./views/EntitiesView";
import { GraphView } from "./views/GraphView";
import { SourcesView } from "./views/SourcesView";
import { EOView } from "./views/EOView";
import { RasterIntelligenceView } from "./views/RasterIntelligenceView";
import { ApiView } from "./views/ApiView";
import { motion, AnimatePresence } from "framer-motion";

export function Shell() {
  const view = useGDT((s) => s.view);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <CommandBar />
      <div className="flex min-h-0 flex-1">
        <NavRail />
        <main className="relative min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute inset-0"
            >
              {view === "atlas" && <AtlasView />}
              {view === "observations" && <ObservationsView />}
              {view === "entities" && <EntitiesView />}
              {view === "graph" && <GraphView />}
              {view === "sources" && <SourcesView />}
              {view === "eo" && <EOView />}
              {view === "raster" && <RasterIntelligenceView />}
              {view === "api" && <ApiView />}
            </motion.div>
          </AnimatePresence>
        </main>
        <Inspector />
      </div>
      <StatusBar />

      {/* Global overlays */}
      <CommandPalette />
      <LiveEngine />
    </div>
  );
}
