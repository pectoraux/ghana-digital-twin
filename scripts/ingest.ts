// Ghana Digital Twin — Initial World Model Ingestion
// Fetches real authoritative data (geoBoundaries + OpenStreetMap) and builds
// the versioned entity store + spatial relationship graph.
//
// Run: bun run scripts/ingest.ts

import { ensureAllSourcesRegistered } from "@/lib/connectors/registry";
import { runConnector, listConnectors, getConnector } from "@/lib/worldmodel/connector-framework";
import { db } from "@/lib/db";

async function main() {
  console.log("=== Ghana Digital Twin — World Model Ingestion ===\n");

  // 1. register all dataset sources (provenance)
  await ensureAllSourcesRegistered();
  const liveIds = listConnectors().filter((id) => getConnector(id)?.live);
  console.log(`Registered ${listConnectors().length} connectors (${liveIds.length} live): ${liveIds.join(", ")}\n`);

  // 2. run each live connector (or a single one if arg provided)
  const onlyArg = process.argv[2];
  const toRun = onlyArg ? [onlyArg] : liveIds;
  for (const id of toRun) {
    if (!getConnector(id)) {
      console.log(`No connector: ${id}\n`);
      continue;
    }
    console.log(`--- Running connector: ${id} ---`);
    const t0 = Date.now();
    const result = await runConnector(id);
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
      `  ${result.success ? "✓ SUCCESS" : "✗ FAILED"} · read=${result.recordsRead} written=${result.recordsWritten} · ${dt}s` +
        (result.error ? ` · error: ${result.error}` : "")
    );
    const evByType: Record<string, number> = {};
    for (const e of result.runEvents) evByType[e.type] = (evByType[e.type] ?? 0) + 1;
    console.log("  events:", JSON.stringify(evByType));
    console.log("");
  }

  // 3. summary
  const [entities, rels, versions, sources] = await Promise.all([
    db.entity.count(),
    db.relationship.count(),
    db.entityVersion.count(),
    db.datasetSource.findMany({ select: { sourceId: true, name: true, status: true, recordCount: true } }),
  ]);
  console.log("=== World Model Summary ===");
  console.log(`  Entities:      ${entities}`);
  console.log(`  Versions:      ${versions}`);
  console.log(`  Relationships: ${rels}`);
  console.log(`  Sources:`);
  for (const s of sources) {
    console.log(`    ${s.status.padEnd(9)} ${String(s.recordCount).padStart(5)}  ${s.name}`);
  }
  console.log("\nDone.");
  await db.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
