import { db } from "@/lib/db";
import { computeBaseline } from "@/lib/eo/baseline";
import { computeProduct } from "@/lib/eo/raster-products";

async function main() {
  // Use tile 30PXS (21 scenes) — but the baseline engine limits to cloudCover <= 40
  const tile = "30PXS";
  console.log("=== Quick Raster Intelligence: tile", tile, "===\n");

  // 1. NDVI baseline
  console.log("Computing NDVI baseline...");
  const t0 = Date.now();
  const bl = await computeBaseline({ mgrsTile: tile, indexName: "NDVI" });
  console.log(`  ${bl?.sampleCount} scenes, ${((Date.now()-t0)/1000).toFixed(1)}s`);
  if (bl) {
    const unc = bl.uncertaintyGrid.values.filter(Number.isFinite).reduce((a,b)=>a+b,0) / Math.max(1, bl.uncertaintyGrid.values.filter(Number.isFinite).length);
    console.log(`  mean uncertainty: ±${unc.toFixed(4)}`);
  }

  // 2. Find latest scene
  const scene = await db.rasterScene.findFirst({ where: { mgrsTile: tile, cloudCover: { lte: 30 } }, orderBy: { datetime: "desc" } });
  console.log(`\nLatest scene: ${scene?.stacId} cloud=${scene?.cloudCover?.toFixed(1)}%`);

  // 3. Vegetation anomaly
  console.log("\nComputing vegetation_anomaly...");
  const t2 = Date.now();
  const p1 = await computeProduct({ type: "vegetation_anomaly", sceneId: scene!.id, mgrsTile: tile });
  console.log(`  mean=${p1?.stats.mean?.toFixed(3)} min=${p1?.stats.min?.toFixed(3)} max=${p1?.stats.max?.toFixed(3)} conf=${(p1!.confidence*100).toFixed(0)}% ${((Date.now()-t2)/1000).toFixed(1)}s`);

  // 4. Bare soil
  console.log("\nComputing bare_soil...");
  const t3 = Date.now();
  const p2 = await computeProduct({ type: "bare_soil", sceneId: scene!.id, mgrsTile: tile });
  console.log(`  mean=${p2?.stats.mean?.toFixed(3)} conf=${(p2!.confidence*100).toFixed(0)}% ${((Date.now()-t3)/1000).toFixed(1)}s`);

  const [bCount, pCount] = await Promise.all([db.seasonalBaseline.count(), db.rasterProduct.count()]);
  console.log(`\nDone. Baselines: ${bCount}, Products: ${pCount}`);
  await db.$disconnect();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
