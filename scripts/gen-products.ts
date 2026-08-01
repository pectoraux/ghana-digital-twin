import { db } from "@/lib/db";
import { computeProduct } from "@/lib/eo/raster-products";

async function main() {
  const tile = "30PXS";
  const scene = await db.rasterScene.findFirst({ where: { mgrsTile: tile, cloudCover: { lte: 30 } }, orderBy: { datetime: "desc" } });
  console.log("Scene:", scene?.stacId);
  
  console.log("Computing vegetation_anomaly...");
  const t0 = Date.now();
  const p1 = await computeProduct({ type: "vegetation_anomaly", sceneId: scene!.id, mgrsTile: tile });
  console.log(`  mean=${p1?.stats.mean?.toFixed(3)} min=${p1?.stats.min?.toFixed(3)} max=${p1?.stats.max?.toFixed(3)} conf=${(p1!.confidence*100).toFixed(0)}% ${((Date.now()-t0)/1000).toFixed(1)}s`);

  console.log("Computing bare_soil...");
  const t1 = Date.now();
  const p2 = await computeProduct({ type: "bare_soil", sceneId: scene!.id, mgrsTile: tile });
  console.log(`  mean=${p2?.stats.mean?.toFixed(3)} conf=${(p2!.confidence*100).toFixed(0)}% ${((Date.now()-t1)/1000).toFixed(1)}s`);

  console.log("Done. Products:", await db.rasterProduct.count());
  await db.$disconnect();
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
