import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
console.log("Clearing AIO data...");
await db.objectiveProgress.deleteMany({});
await db.organizationObjective.deleteMany({});
await db.organizationService.deleteMany({});
await db.organizationCharter.deleteMany({});
await db.agentContract.deleteMany({});
await db.organizationTransaction.deleteMany({});
await db.organizationTreasury.deleteMany({});
await db.autonomousOrganization.deleteMany({});
await db.aioPackage.deleteMany({});
console.log("Cleared. Now calling seedAIO()...");
await db.$disconnect();

// Re-import seed fresh
const { seedAIO } = await import("./src/lib/aio/seed.ts");
try {
  const r = await seedAIO();
  console.log("seedAIO returned:", r);
} catch (e) {
  console.error("seedAIO threw:", e.message);
  console.error(e.stack);
}

// Verify
const db2 = new PrismaClient();
console.log("---");
console.log("orgs:", await db2.autonomousOrganization.count());
console.log("treasuries:", await db2.organizationTreasury.count());
console.log("transactions:", await db2.organizationTransaction.count());
console.log("contracts:", await db2.agentContract.count());
console.log("objectives:", await db2.organizationObjective.count());
console.log("charters:", await db2.organizationCharter.count());
console.log("services:", await db2.organizationService.count());
await db2.$disconnect();
