import { db } from "@/lib/db";
import { computeBaseline } from "@/lib/eo/baseline";
import { computeProduct } from "@/lib/eo/raster-products";
import { runObservationScan } from "@/lib/observation/engine";
import { generateHypotheses } from "@/lib/intelligence/engine";
import { runTemporalMerge } from "@/lib/temporal/engine";
import { ensureAllSourcesRegistered } from "@/lib/connectors/registry";

async function main() {
  console.log("=== Full Pipeline Regeneration on Neon ===\n");
  await ensureAllSourcesRegistered();

  // Process top 3 tiles
  const tiles = await db.rasterScene.groupBy({
    by: ["mgrsTile"],
    _count: { mgrsTile: true },
    orderBy: { _count: { mgrsTile: "desc" } },
    take: 3,
  });

  let totalObs = 0;
  let totalHyp = 0;

  for (const tile of tiles) {
    const tileId = tile.mgrsTile;
    console.log(`\n--- Processing tile: ${tileId} (${tile._count.mgrsTile} scenes) ---`);

    // 1. Baseline (if not exists)
    let bl = await db.seasonalBaseline.findFirst({ where: { mgrsTile: tileId, indexName: "NDVI" } });
    if (!bl) {
      console.log("  Computing NDVI baseline...");
      try {
        const result = await computeBaseline({ mgrsTile: tileId, indexName: "NDVI" });
        console.log(`  Baseline: ${result?.sampleCount} scenes`);
      } catch (e) { console.log(`  Baseline FAILED: ${String(e).slice(0, 80)}`); }
    } else {
      console.log("  Baseline exists");
    }

    // 2. Find latest scene
    const scene = await db.rasterScene.findFirst({
      where: { mgrsTile: tileId, cloudCover: { lte: 40 } },
      orderBy: { datetime: "desc" },
    });
    if (!scene) { console.log("  No suitable scene"); continue; }
    console.log(`  Scene: ${scene.stacId} (${scene.datetime.toISOString().slice(0, 10)}, cloud ${scene.cloudCover?.toFixed(1)}%)`);

    // 3. Compute products (if not exist)
    for (const pt of ["vegetation_anomaly", "bare_soil"] as const) {
      const existing = await db.rasterProduct.findFirst({ where: { sceneId: scene.id, type: pt } });
      if (existing) { console.log(`  ${pt}: exists (mean=${existing.meanValue?.toFixed(3)})`); continue; }
      try {
        // Check if baseline exists for vegetation_anomaly
        if (pt === "vegetation_anomaly" && !bl) {
          console.log(`  ${pt}: skipped (no baseline)`);
          continue;
        }
        const p = await computeProduct({ type: pt, sceneId: scene.id, mgrsTile: tileId });
        console.log(`  ${pt}: mean=${p?.stats.mean?.toFixed(3)} conf=${(p!.confidence * 100).toFixed(0)}%`);
      } catch (e) { console.log(`  ${pt}: FAILED - ${String(e).slice(0, 80)}`); }
    }

    // 4. Generate observations
    console.log("  Generating observations...");
    try {
      const obsResult = await runObservationScan({ mgrsTile: tileId });
      console.log(`  Observations: created=${obsResult.observationsCreated} updated=${obsResult.observationsUpdated}`);
      totalObs += obsResult.observationsCreated;

      // 5. Generate hypotheses for new observations
      if (obsResult.observationsCreated > 0) {
        const newObs = await db.observation.findMany({
          where: { mgrsTile: tileId },
          take: obsResult.observationsCreated,
          orderBy: { observedAt: "desc" },
          select: { id: true },
        });
        for (const o of newObs) {
          try {
            const r = await generateHypotheses(o.id);
            totalHyp += r.hypothesesCreated;
          } catch (e) { /* skip */ }
        }
      }
    } catch (e) { console.log(`  Obs FAILED: ${String(e).slice(0, 80)}`); }
  }

  // 6. Temporal merge
  console.log("\n--- Temporal merge ---");
  try {
    const merge = await runTemporalMerge();
    console.log(`  Phenomena created: ${merge.phenomenaCreated}`);
  } catch (e) { console.log(`  Merge FAILED: ${String(e).slice(0, 80)}`); }

  // 7. Summary
  const counts = await Promise.all([
    db.entity.count(), db.rasterScene.count(), db.observation.count(),
    db.hypothesis.count(), db.phenomenon.count(), db.evidence.count(),
    db.rasterProduct.count(), db.seasonalBaseline.count(),
  ]);
  console.log("\n=== Final Neon DB State ===");
  console.log(`  Entities: ${counts[0]} | Scenes: ${counts[1]} | Observations: ${counts[2]}`);
  console.log(`  Hypotheses: ${counts[3]} | Phenomena: ${counts[4]} | Evidence: ${counts[5]}`);
  console.log(`  Products: ${counts[6]} | Baselines: ${counts[7]}`);

  await db.$disconnect();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
