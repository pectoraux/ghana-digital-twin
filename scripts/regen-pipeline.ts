import { db } from "@/lib/db";
import { computeBaseline } from "@/lib/eo/baseline";
import { computeProduct } from "@/lib/eo/raster-products";
import { runObservationScan } from "@/lib/observation/engine";
import { generateHypotheses } from "@/lib/intelligence/engine";
import { runTemporalMerge } from "@/lib/temporal/engine";

async function main() {
  console.log("=== Re-running downstream pipeline on Neon ===\n");

  // 1. Find MGRS tiles with scenes
  const tiles = await db.rasterScene.groupBy({
    by: ["mgrsTile"],
    _count: { mgrsTile: true },
    orderBy: { _count: { mgrsTile: "desc" } },
    take: 3,
  });
  console.log("Top MGRS tiles:", tiles.map(t => `${t.mgrsTile}=${t._count.mgrsTile}`).join(", "));

  // 2. For the top tile, compute NDVI baseline
  const topTile = tiles[0]?.mgrsTile;
  if (!topTile) { console.log("No tiles found"); process.exit(1); }

  console.log(`\n--- Computing NDVI baseline for ${topTile} ---`);
  const bl = await computeBaseline({ mgrsTile: topTile, indexName: "NDVI" });
  console.log(`  Baseline: ${bl?.sampleCount} scenes, uncertainty ±${bl?.uncertaintyGrid.values.filter(Number.isFinite).reduce((a,b)=>a+b,0)/Math.max(1,bl?.uncertaintyGrid.values.filter(Number.isFinite).length)}`);

  // 3. Find latest scene for this tile
  const scene = await db.rasterScene.findFirst({
    where: { mgrsTile: topTile, cloudCover: { lte: 30 } },
    orderBy: { datetime: "desc" },
  });
  if (!scene) { console.log("No suitable scene"); process.exit(1); }
  console.log(`  Scene: ${scene.stacId} (${scene.datetime.toISOString().slice(0,10)})`);

  // 4. Compute raster products
  console.log("\n--- Computing raster products ---");
  for (const pt of ["vegetation_anomaly", "bare_soil"] as const) {
    try {
      const p = await computeProduct({ type: pt, sceneId: scene.id, mgrsTile: topTile });
      console.log(`  ${pt}: mean=${p?.stats.mean?.toFixed(3)} conf=${(p!.confidence*100).toFixed(0)}%`);
    } catch(e) { console.log(`  ${pt}: FAILED - ${String(e).slice(0,80)}`); }
  }

  // 5. Generate observations
  console.log("\n--- Generating observations ---");
  const obsResult = await runObservationScan({ mgrsTile: topTile });
  console.log(`  Created: ${obsResult.observationsCreated}, Updated: ${obsResult.observationsUpdated}`);

  // 6. Generate hypotheses
  console.log("\n--- Generating hypotheses ---");
  const observations = await db.observation.findMany({ take: 5, select: { id: true } });
  let hypCount = 0;
  for (const o of observations) {
    try {
      const r = await generateHypotheses(o.id);
      hypCount += r.hypothesesCreated;
    } catch(e) { /* skip */ }
  }
  console.log(`  Hypotheses: ${hypCount}`);

  // 7. Run temporal merge
  console.log("\n--- Temporal merge ---");
  const mergeResult = await runTemporalMerge();
  console.log(`  Phenomena created: ${mergeResult.phenomenaCreated}`);

  // 8. Summary
  const [e,s,o,h,p,ev,rp] = await Promise.all([
    db.entity.count(), db.rasterScene.count(), db.observation.count(),
    db.hypothesis.count(), db.phenomenon.count(), db.evidence.count(),
    db.rasterProduct.count()
  ]);
  console.log("\n=== Final Neon DB State ===");
  console.log(`  Entities: ${e} | Scenes: ${s} | Observations: ${o} | Hypotheses: ${h}`);
  console.log(`  Phenomena: ${p} | Evidence: ${ev} | Products: ${rp}`);

  await db.$disconnect();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
