"use client";

import { useGDT } from "@/lib/gdt/store";
import { CommandBar } from "./CommandBar";
import { NavRail } from "./NavRail";
import { MobileBottomNav } from "./MobileBottomNav";
import { Inspector } from "./Inspector";
import { StatusBar } from "./StatusBar";
import { CommandPalette } from "./CommandPalette";
import { ReportModal } from "./ReportModal";
import { FeedItemDetail } from "./FeedItemDetail";
import { LiveEngine } from "./LiveEngine";
import { HomeView } from "./views/HomeView";
import { FeedView } from "./views/FeedView";
import { AtlasView } from "./views/AtlasView";
import { ObservationsView } from "./views/ObservationsView";
import { PhenomenaView } from "./views/PhenomenaView";
import { IntelligenceView } from "./views/IntelligenceView";
import { MissionsView } from "./views/MissionsView";
import { MissionsConsumerView } from "./views/MissionsConsumerView";
import { ValidationView } from "./views/ValidationView";
import { ExtensionsView } from "./views/ExtensionsView";
import { ContinuousView } from "./views/ContinuousView";
import { GroundTruthView } from "./views/GroundTruthView";
import { MultiModalView } from "./views/MultiModalView";
import { EntitiesView } from "./views/EntitiesView";
import { GraphView } from "./views/GraphView";
import { KnowledgeGraphView } from "./views/KnowledgeGraphView";
import { SourcesView } from "./views/SourcesView";
import { EOView } from "./views/EOView";
import { RasterIntelligenceView } from "./views/RasterIntelligenceView";
import { CommandCenterView } from "./views/CommandCenterView";
import { CommunityView } from "./views/CommunityView";
import { CommunityConsumerView } from "./views/CommunityConsumerView";
import { CivicTrustView } from "./views/CivicTrustView";
import { MarketplaceView } from "./views/MarketplaceView";
import { FinanceView } from "./views/FinanceView";
import { FederationView } from "./views/FederationView";
import { OSMarketplaceView } from "./views/OSMarketplaceView";
import { RealityFeedView } from "./views/RealityFeedView";
import { GovernanceView } from "./views/GovernanceView";
import { GovernanceIntelView } from "./views/GovernanceIntelView";
import { AioView } from "./views/AioView";
import { ProfileView } from "./views/ProfileView";
import { RewardsView } from "./views/RewardsView";
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
              {view === "home" && <HomeView />}
              {view === "feed" && <FeedView />}
              {view === "atlas" && <AtlasView />}
              {view === "observations" && <ObservationsView />}
              {view === "phenomena" && <PhenomenaView />}
              {view === "intelligence" && <IntelligenceView />}
              {view === "missions" && <MissionsConsumerView />}
              {view === "validation" && <ValidationView />}
              {view === "extensions" && <ExtensionsView />}
              {view === "continuous" && <ContinuousView />}
              {view === "groundtruth" && <GroundTruthView />}
              {view === "multimodal" && <MultiModalView />}
              {view === "entities" && <EntitiesView />}
              {view === "graph" && <GraphView />}
              {view === "knowledge" && <KnowledgeGraphView />}
              {view === "sources" && <SourcesView />}
              {view === "eo" && <EOView />}
              {view === "raster" && <RasterIntelligenceView />}
              {view === "command" && <CommandCenterView />}
              {view === "community" && <CommunityConsumerView />}
              {view === "civic-trust" && <CivicTrustView />}
              {view === "marketplace" && <MarketplaceView />}
              {view === "finance" && <FinanceView />}
              {view === "federation" && <FederationView />}
              {view === "os" && <OSMarketplaceView />}
              {view === "reality" && <RealityFeedView />}
              {view === "governance" && <GovernanceView />}
              {view === "gov-intel" && <GovernanceIntelView />}
              {view === "aio" && <AioView />}
              {view === "profile" && <ProfileView />}
              {view === "rewards" && <RewardsView />}
              {view === "api" && <ApiView />}
            </motion.div>
          </AnimatePresence>
        </main>
        <Inspector />
      </div>
      <StatusBar />
      <MobileBottomNav />

      {/* Global overlays */}
      <CommandPalette />
      <GlobalReportModal />
      <GlobalFeedItemDetail />
      <LiveEngine />
    </div>
  );
}

// Global report modal — reads from store so any component can trigger it
function GlobalReportModal() {
  const reportOpen = useGDT((s) => s.reportOpen);
  const setReportOpen = useGDT((s) => s.setReportOpen);
  return <ReportModal open={reportOpen} onOpenChange={setReportOpen} />;
}

// Global feed item detail — reads from store so any feed card can open it
function GlobalFeedItemDetail() {
  const selectedFeedItemId = useGDT((s) => s.selectedFeedItemId);
  const setSelectedFeedItemId = useGDT((s) => s.setSelectedFeedItemId);
  return (
    <FeedItemDetail
      feedItemId={selectedFeedItemId}
      onOpenChange={(open) => { if (!open) setSelectedFeedItemId(null); }}
    />
  );
}
