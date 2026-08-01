// Ghana Digital Twin — Raster Intelligence Computation
// Computes seasonal baselines + raster intelligence products for Ghana MGRS tiles.
// Run: bun run scripts/raster-intelligence.ts

import { ensureAllSourcesRegistered } from "@/lib/connectors/registry";
import { db } from "@/lib/db";
import { computeBaseline } from "@/lib/eo/baseline";
import { computeProduct } from "@/lib/eo/raster-products";
import type { IndexName } from "@/lib/eo/spectral";

async function main() {
  console.log("=== Ghana Digital Twin — Raster Intelligence Computation ===\n");

  // 1. Find tiles with the most scenes (best baselines)
  const tiles = await db.rasterScene.groupBy({
    by: ["mgrsTile"],
    _count: { mgrsTile: true },
    orderBy: { _count: { mgrsTile: "desc" } },
    take: 5,
  });
  console.log("Top MGRS tiles by scene count:");
  tiles.forEach((t) => console.log(`  ${t.mgrsTile}: ${t._count.mgrsTile} scenes`));
  console.log("");

  // 2. For the top 3 tiles, compute baselines for NDVI + NDWI + NBR
  const targetTiles = tiles.slice(0, 3).map((t) => t.mgrsTile);
  const indices: IndexName[] = ["NDVI", "NDWI", "NBR"];

  for (const tile of targetTiles) {
    console.log(`\n--- Baselines for ${tile} ---`);
    for (const idx of indices) {
      const t0 = Date.now();
      const result = await computeBaseline({ mgrsTile: tile, indexName: idx });
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      if (result) {
        console.log(`  ${idx}: ${result.sampleCount} scenes, uncertainty ±${(result.uncertaintyGrid.values.filter(Number.isFinite).reduce((a, b) => a + b, 0) / result.uncertaintyGrid.values.filter(Number.isFinite).length).toFixed(4)}, ${dt}s`);
      } else {
        console.log(`  ${idx}: FAILED (insufficient data), ${dt}s`);
      }
    }
  }

  // 3. For the top tile, find the latest scene and compute raster products
  const topTile = targetTiles[0];
  console.log(`\n--- Raster Products for latest scene in ${topTile} ---`);
  const latestScene = await db.rasterScene.findFirst({
    where: { mgrsTile: topTile, cloudCover: { lte: 30 } },
    orderBy: { datetime: "desc" },
  });
  if (!latestScene) {
    console.log("  No suitable scene found");
    return;
  }
  console.log(`  Scene: ${latestScene.stacId} (${latestScene.datetime.toISOString().slice(0, 10)}, cloud ${latestScene.cloudCover?.toFixed(1)}%)`);

  const productTypes = ["vegetation_anomaly", "water_anomaly", "bare_soil", "burn_severity", "change_probability"] as const;
  for (const pt of productTypes) {
    const t0 = Date.now();
    const result = await computeProduct({ type: pt, sceneId: latestScene.id, mgrsTile: topTile });
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    if (result) {
      console.log(`  ${pt}: mean=${result.stats.mean?.toFixed(3)} min=${result.stats.min?.toFixed(3)} max=${result.stats.max?.toFixed(3)} conf=${(result.confidence * 100).toFixed(0)}% ${dt}s`);
    } else {
      console.log(`  ${pt}: FAILED ${dt}s`);
    }
  }

  // 4. Summary
  const [baselines, products] = await Promise.all([
    db.seasonalBaseline.count(),
    db.rasterProduct.count(),
  ]);
  console.log(`\n=== Summary ===`);
  console.log(`  Baselines: ${baselines}`);
  console.log(`  Raster products: ${products}`);

  await db.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
