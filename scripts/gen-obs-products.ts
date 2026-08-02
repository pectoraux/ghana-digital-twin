import { db } from "@/lib/db";
import { computeBaseline } from "@/lib/eo/baseline";
import { computeProduct } from "@/lib/eo/raster-products";

async function main() {
  const tile = "30PXS";
  const scene = await db.rasterScene.findFirst({ where: { mgrsTile: tile, cloudCover: { lte: 30 } }, orderBy: { datetime: "desc" } });
  if (!scene) { console.log("No scene"); process.exit(1); }
  console.log("Scene:", scene.stacId);

  // We already have vegetation_anomaly + bare_soil. Need NDWI baseline for water_anomaly.
  console.log("Computing NDWI baseline...");
  const t0 = Date.now();
  await computeBaseline({ mgrsTile: tile, indexName: "NDWI" });
  console.log(`  done ${((Date.now()-t0)/1000).toFixed(1)}s`);

  // Now compute water_anomaly + change_probability
  console.log("Computing water_anomaly...");
  const t1 = Date.now();
  const p1 = await computeProduct({ type: "water_anomaly", sceneId: scene.id, mgrsTile: tile });
  console.log(`  mean=${p1?.stats.mean?.toFixed(3)} conf=${(p1!.confidence*100).toFixed(0)}% ${((Date.now()-t1)/1000).toFixed(1)}s`);

  console.log("Computing change_probability...");
  const t2 = Date.now();
  const p2 = await computeProduct({ type: "change_probability", sceneId: scene.id, mgrsTile: tile });
  console.log(`  mean=${p2?.stats.mean?.toFixed(3)} conf=${(p2!.confidence*100).toFixed(0)}% ${((Date.now()-t2)/1000).toFixed(1)}s`);

  const products = await db.rasterProduct.findMany({ where: { mgrsTile: tile }, select: { type: true, confidence: true, meanValue: true } });
  console.log("\nProducts for tile", tile + ":");
  products.forEach(p => console.log(`  ${p.type}: mean=${p.meanValue?.toFixed(3)} conf=${(p.confidence*100).toFixed(0)}%`));

  await db.$disconnect();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
