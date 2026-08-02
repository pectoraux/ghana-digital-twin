// Ghana Digital Twin — Milestone 13: Autonomous Intelligence Organizations (AIOs)
// Digital institutions native to the intelligence economy. Have identity, own
// assets, employ agents, receive funding, publish intelligence, execute
// workflows, are governed, audited, earn revenue, and can be dissolved.
//
// Components:
// 1. Organization Registry — create, list, dissolve AIOs
// 2. Treasury — institutional economics (income, expenses, balance, allocations)
// 3. Agent Employment — org contracts agents with roles, budgets, permissions
// 4. Objectives — goals with metrics, progress tracking
// 5. Charter — mini constitution per org
// 6. Services — org-offered intelligence in the marketplace
// 7. Reputation — institutional accountability
//
// Kernel is FROZEN. All package-layer.

import { db } from "@/lib/db";
import { createImmutableArtifact } from "@/lib/kernel/engine";

// ===========================================================================
// 1. ORGANIZATION REGISTRY
// ===========================================================================

export async function createOrganization(input: {
  orgId: string;
  name: string;
  displayName: string;
  description: string;
  orgType: string;
  mission: string;
  founderId: string;
  founderName: string;
  federationNodeId?: string;
}): Promise<any> {
  const org = await db.autonomousOrganization.upsert({
    where: { orgId: input.orgId },
    update: { name: input.name, displayName: input.displayName, description: input.description, mission: input.mission },
    create: {
      orgId: input.orgId, name: input.name, displayName: input.displayName,
      description: input.description, orgType: input.orgType, mission: input.mission,
      founderId: input.founderId, founderName: input.founderName,
      federationNodeId: input.federationNodeId ?? null,
      status: "active",
    },
  });

  // Create treasury
  await db.organizationTreasury.upsert({
    where: { orgId: input.orgId },
    update: {},
    create: { treasuryId: `TRS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`, orgId: input.orgId, balance: 0 },
  });

  // Create immutable artifact
  await createImmutableArtifact({
    kind: "organization_founded",
    content: { orgId: input.orgId, name: input.name, orgType: input.orgType, mission: input.mission, founderId: input.founderId },
    parentHashes: [],
    createdBy: `founder:${input.founderId}`,
    createdVia: "organization_creation",
    providerUsed: "autonomous-organizations",
    providerReason: `Organization founded: ${input.name}`,
  });

  return serializeOrg(org);
}

export async function listOrganizations(filter: { status?: string; orgType?: string } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.status) where.status = filter.status;
  if (filter.orgType) where.orgType = filter.orgType;
  const rows = await db.autonomousOrganization.findMany({ where, orderBy: { foundedAt: "desc" } });
  return rows.map(serializeOrg);
}

export async function getOrganization(orgId: string): Promise<any | null> {
  const org = await db.autonomousOrganization.findUnique({ where: { orgId } });
  if (!org) return null;
  const treasury = await db.organizationTreasury.findUnique({ where: { orgId } });
  const contracts = await db.agentContract.findMany({ where: { orgId, status: "active" }, orderBy: { contractedAt: "asc" } });
  const objectives = await db.organizationObjective.findMany({ where: { orgId }, orderBy: { createdAt: "desc" } });
  const charter = await db.organizationCharter.findUnique({ where: { orgId } });
  const services = await db.organizationService.findMany({ where: { orgId, status: "active" } });
  return {
    ...serializeOrg(org),
    treasury: treasury ? serializeTreasury(treasury) : null,
    agentContracts: contracts.map(serializeContract),
    objectives: objectives.map(serializeObjective),
    charter: charter ? serializeCharter(charter) : null,
    services: services.map(serializeService),
  };
}

export async function dissolveOrganization(orgId: string, reason: string): Promise<any> {
  const org = await db.autonomousOrganization.update({
    where: { orgId },
    data: { status: "dissolved", dissolvedAt: new Date() },
  });

  // Terminate all agent contracts
  await db.agentContract.updateMany({ where: { orgId, status: "active" }, data: { status: "terminated", terminatedAt: new Date() } });

  await createImmutableArtifact({
    kind: "organization_dissolved",
    content: { orgId, reason, dissolvedAt: org.dissolvedAt },
    parentHashes: [],
    createdBy: "governance",
    createdVia: "dissolution",
    providerUsed: "autonomous-organizations",
    providerReason: `Organization dissolved: ${reason}`,
  });

  return serializeOrg(org);
}

// ===========================================================================
// 2. TREASURY — institutional economics
// ===========================================================================

let txCounter = 0;
async function nextTxId(): Promise<string> {
  const count = await db.organizationTransaction.count();
  txCounter = count + 1;
  return `OTX-${Date.now().toString(36).toUpperCase()}-${txCounter}`;
}

export async function treasuryTransaction(input: {
  orgId: string;
  type: string; // income | expense | allocation | transfer
  category: string; // bounty | subscription | service | grant | agent_cost | data_cost | contributor_payout | infrastructure
  amount: number; // positive for income, negative for expense
  counterpartyId?: string;
  counterpartyName?: string;
  description: string;
}): Promise<any> {
  const treasury = await db.organizationTreasury.findUnique({ where: { orgId: input.orgId } });
  if (!treasury) throw new Error(`Treasury for ${input.orgId} not found`);

  const balanceAfter = treasury.balance + input.amount;
  const transactionId = await nextTxId();

  const tx = await db.organizationTransaction.create({
    data: {
      transactionId,
      orgId: input.orgId,
      type: input.type,
      category: input.category,
      amount: input.amount,
      balanceAfter,
      counterpartyId: input.counterpartyId ?? null,
      counterpartyName: input.counterpartyName ?? null,
      description: input.description,
    },
  });

  // Update treasury
  const updates: any = { balance: balanceAfter };
  if (input.amount > 0) {
    updates.totalIncome = { increment: input.amount };
    if (input.category === "bounty") updates.bountyIncome = { increment: input.amount };
    if (input.category === "subscription") updates.subscriptionIncome = { increment: input.amount };
    if (input.category === "service") updates.serviceIncome = { increment: input.amount };
    if (input.category === "grant") updates.grantIncome = { increment: input.amount };
  } else {
    updates.totalExpenses = { increment: Math.abs(input.amount) };
    if (input.category === "agent_cost") updates.agentCosts = { increment: Math.abs(input.amount) };
    if (input.category === "data_cost") updates.dataCosts = { increment: Math.abs(input.amount) };
    if (input.category === "contributor_payout") updates.contributorPayouts = { increment: Math.abs(input.amount) };
    if (input.category === "infrastructure") updates.infrastructureCosts = { increment: Math.abs(input.amount) };
  }

  await db.organizationTreasury.update({ where: { orgId: input.orgId }, data: updates });

  // Update org summary
  await db.autonomousOrganization.update({
    where: { orgId: input.orgId },
    data: {
      treasuryBalance: balanceAfter,
      totalRevenue: input.amount > 0 ? { increment: input.amount } : undefined,
      totalExpenses: input.amount < 0 ? { increment: Math.abs(input.amount) } : undefined,
    },
  });

  return serializeTx(tx);
}

export async function fundOrganization(orgId: string, amount: number, source: string, sourceName: string): Promise<any> {
  return treasuryTransaction({
    orgId, type: "income", category: "grant", amount,
    counterpartyId: source, counterpartyName: sourceName,
    description: `Funding from ${sourceName}: ${amount} IC`,
  });
}

export async function listTransactions(orgId?: string, limit = 30): Promise<any[]> {
  const where: any = {};
  if (orgId) where.orgId = orgId;
  return db.organizationTransaction.findMany({ where, orderBy: { processedAt: "desc" }, take: limit });
}

// ===========================================================================
// 3. AGENT EMPLOYMENT
// ===========================================================================

export async function employAgent(input: {
  orgId: string;
  agentId: string;
  agentName: string;
  agentType: string;
  role: string;
  budgetAllocation?: number;
  permissions?: string[];
}): Promise<any> {
  const contractId = `CON-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const contract = await db.agentContract.create({
    data: {
      contractId,
      orgId: input.orgId,
      agentId: input.agentId,
      agentName: input.agentName,
      agentType: input.agentType,
      role: input.role,
      budgetAllocation: input.budgetAllocation ?? 0,
      permissions: JSON.stringify(input.permissions ?? []),
      status: "active",
    },
  });

  await db.autonomousOrganization.update({ where: { orgId: input.orgId }, data: { agentCount: { increment: 1 } } });

  return serializeContract(contract);
}

export async function listContracts(orgId?: string): Promise<any[]> {
  const where: any = { status: "active" };
  if (orgId) where.orgId = orgId;
  return db.agentContract.findMany({ where, orderBy: { contractedAt: "asc" } }).then((rows) => rows.map(serializeContract));
}

// ===========================================================================
// 4. OBJECTIVES
// ===========================================================================

export async function createObjective(input: {
  orgId: string;
  title: string;
  description: string;
  targetMetric: string;
  targetValue: number;
  unit?: string;
  deadline?: string;
}): Promise<any> {
  const objectiveId = `OBJ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const obj = await db.organizationObjective.create({
    data: {
      objectiveId,
      orgId: input.orgId,
      title: input.title,
      description: input.description,
      targetMetric: input.targetMetric,
      targetValue: input.targetValue,
      unit: input.unit ?? "%",
      deadline: input.deadline ? new Date(input.deadline) : null,
      status: "active",
    },
  });

  await db.autonomousOrganization.update({ where: { orgId: input.orgId }, data: { objectiveCount: { increment: 1 } } });

  return serializeObjective(obj);
}

export async function recordProgress(objectiveId: string, measuredValue: number, note: string, measuredBy: string): Promise<any> {
  const obj = await db.organizationObjective.findUnique({ where: { objectiveId } });
  if (!obj) throw new Error(`Objective ${objectiveId} not found`);

  const progressPercent = Math.min(100, (measuredValue / obj.targetValue) * 100);
  const progressId = `PRG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

  const progress = await db.objectiveProgress.create({
    data: {
      progressId,
      objectiveId,
      orgId: obj.orgId,
      measuredValue,
      progressPercent,
      note,
      measuredBy,
    },
  });

  // Update objective
  const achieved = progressPercent >= 100;
  await db.organizationObjective.update({
    where: { objectiveId },
    data: {
      currentValue: measuredValue,
      progressPercent,
      status: achieved ? "achieved" : "active",
      achievedAt: achieved ? new Date() : undefined,
    },
  });

  return serializeProgress(progress);
}

export async function listObjectives(orgId?: string): Promise<any[]> {
  const where: any = {};
  if (orgId) where.orgId = orgId;
  return db.organizationObjective.findMany({ where, orderBy: { createdAt: "desc" } }).then((rows) => rows.map(serializeObjective));
}

// ===========================================================================
// 5. CHARTER — mini constitution
// ===========================================================================

export async function createCharter(input: {
  orgId: string;
  name: string;
  preamble: string;
  rules?: { number: number; title: string; body: string; category: string }[];
  governanceModel?: string;
  amendmentProcess?: string;
}): Promise<any> {
  const charterId = `CHARTER-${input.orgId}`;
  const rules = input.rules ?? [];
  const charter = await db.organizationCharter.upsert({
    where: { orgId: input.orgId },
    update: {
      name: input.name, preamble: input.preamble,
      rules: JSON.stringify(rules), ruleCount: rules.length,
      governanceModel: input.governanceModel ?? "founder_control",
      amendmentProcess: input.amendmentProcess ?? "founder_approval",
    },
    create: {
      charterId, orgId: input.orgId, name: input.name, preamble: input.preamble,
      rules: JSON.stringify(rules), ruleCount: rules.length,
      governanceModel: input.governanceModel ?? "founder_control",
      amendmentProcess: input.amendmentProcess ?? "founder_approval",
      status: "active",
    },
  });

  await db.autonomousOrganization.update({ where: { orgId: input.orgId }, data: { charterId } });

  return serializeCharter(charter);
}

export async function getCharter(orgId: string): Promise<any | null> {
  const row = await db.organizationCharter.findUnique({ where: { orgId } });
  return row ? serializeCharter(row) : null;
}

// ===========================================================================
// 6. SERVICES — org marketplace offerings
// ===========================================================================

export async function publishService(input: {
  orgId: string;
  orgName: string;
  name: string;
  description: string;
  serviceType: string;
  includes?: string[];
  pricingModel?: string;
  price?: number;
}): Promise<any> {
  const serviceId = `SVC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const service = await db.organizationService.create({
    data: {
      serviceId,
      orgId: input.orgId,
      orgName: input.orgName,
      name: input.name,
      description: input.description,
      serviceType: input.serviceType,
      includes: JSON.stringify(input.includes ?? []),
      pricingModel: input.pricingModel ?? "subscription",
      price: input.price ?? 0,
      status: "active",
    },
  });
  return serializeService(service);
}

export async function listServices(filter: { orgId?: string; serviceType?: string } = {}): Promise<any[]> {
  const where: any = { status: "active" };
  if (filter.orgId) where.orgId = filter.orgId;
  if (filter.serviceType) where.serviceType = filter.serviceType;
  return db.organizationService.findMany({ where, orderBy: { publishedAt: "desc" } }).then((rows) => rows.map(serializeService));
}

// ===========================================================================
// 7. OVERVIEW
// ===========================================================================

export async function getAioOverview(): Promise<any> {
  const [orgs, treasuries, transactions, contracts, objectives, charters, services] = await Promise.all([
    db.autonomousOrganization.count(),
    db.organizationTreasury.count(),
    db.organizationTransaction.count(),
    db.agentContract.count({ where: { status: "active" } }),
    db.organizationObjective.count(),
    db.organizationCharter.count(),
    db.organizationService.count({ where: { status: "active" } }),
  ]);

  const activeOrgs = await db.autonomousOrganization.count({ where: { status: "active" } });
  const totalTreasuryBalance = await db.organizationTreasury.aggregate({ _sum: { balance: true } });
  const totalOrgRevenue = await db.autonomousOrganization.aggregate({ _sum: { totalRevenue: true } });
  const activeObjectives = await db.organizationObjective.count({ where: { status: "active" } });
  const achievedObjectives = await db.organizationObjective.count({ where: { status: "achieved" } });
  const totalAgentsEmployed = await db.agentContract.count({ where: { status: "active" } });

  const orgRows = await db.autonomousOrganization.findMany({ where: { status: "active" }, orderBy: { trustScore: "desc" }, take: 5 });
  const recentTransactions = await db.organizationTransaction.findMany({ orderBy: { processedAt: "desc" }, take: 5 });

  return {
    counts: { orgs, treasuries, transactions, contracts, objectives, charters, services },
    active: { activeOrgs, activeObjectives, achievedObjectives, totalAgentsEmployed },
    economy: {
      totalTreasuryBalance: totalTreasuryBalance._sum.balance ?? 0,
      totalOrgRevenue: totalOrgRevenue._sum.totalRevenue ?? 0,
    },
    organizations: orgRows.map(serializeOrg),
    recentTransactions: recentTransactions.map(serializeTx),
  };
}

// ===========================================================================
// SERIALIZERS
// ===========================================================================

function serializeOrg(o: any) {
  return { id: o.id, orgId: o.orgId, name: o.name, displayName: o.displayName, description: o.description,
    orgType: o.orgType, mission: o.mission, founderId: o.founderId, founderName: o.founderName,
    status: o.status, dissolvedAt: o.dissolvedAt,
    trustScore: o.trustScore, reputationTier: o.reputationTier,
    treasuryBalance: o.treasuryBalance, totalRevenue: o.totalRevenue, totalExpenses: o.totalExpenses,
    agentCount: o.agentCount, humanMemberCount: o.humanMemberCount, partnerCount: o.partnerCount,
    objectiveCount: o.objectiveCount, charterId: o.charterId, federationNodeId: o.federationNodeId,
    foundedAt: o.foundedAt };
}

function serializeTreasury(t: any) {
  return { id: t.id, treasuryId: t.treasuryId, orgId: t.orgId,
    balance: t.balance, totalIncome: t.totalIncome, totalExpenses: t.totalExpenses,
    bountyIncome: t.bountyIncome, subscriptionIncome: t.subscriptionIncome, serviceIncome: t.serviceIncome, grantIncome: t.grantIncome,
    agentCosts: t.agentCosts, dataCosts: t.dataCosts, contributorPayouts: t.contributorPayouts, infrastructureCosts: t.infrastructureCosts,
    allocations: JSON.parse(t.allocations || "{}") };
}

function serializeTx(t: any) {
  return { id: t.id, transactionId: t.transactionId, orgId: t.orgId,
    type: t.type, category: t.category, amount: t.amount, balanceAfter: t.balanceAfter,
    counterpartyId: t.counterpartyId, counterpartyName: t.counterpartyName,
    description: t.description, processedAt: t.processedAt };
}

function serializeContract(c: any) {
  return { id: c.id, contractId: c.contractId, orgId: c.orgId,
    agentId: c.agentId, agentName: c.agentName, agentType: c.agentType,
    role: c.role, status: c.status,
    budgetAllocation: c.budgetAllocation, totalSpent: c.totalSpent,
    permissions: JSON.parse(c.permissions || "[]"),
    assignedObjectives: JSON.parse(c.assignedObjectives || "[]"),
    performanceScore: c.performanceScore,
    contractedAt: c.contractedAt, terminatedAt: c.terminatedAt };
}

function serializeObjective(o: any) {
  return { id: o.id, objectiveId: o.objectiveId, orgId: o.orgId,
    title: o.title, description: o.description,
    targetMetric: o.targetMetric, targetValue: o.targetValue, currentValue: o.currentValue, unit: o.unit,
    deadline: o.deadline, progressPercent: o.progressPercent, status: o.status, achievedAt: o.achievedAt,
    createdAt: o.createdAt };
}

function serializeProgress(p: any) {
  return { id: p.id, progressId: p.progressId, objectiveId: p.objectiveId, orgId: p.orgId,
    measuredValue: p.measuredValue, progressPercent: p.progressPercent,
    note: p.note, measuredBy: p.measuredBy, measuredAt: p.measuredAt };
}

function serializeCharter(c: any) {
  return { id: c.id, charterId: c.charterId, orgId: c.orgId, name: c.name, preamble: c.preamble,
    rules: JSON.parse(c.rules || "[]"), ruleCount: c.ruleCount,
    governanceModel: c.governanceModel, amendmentProcess: c.amendmentProcess,
    status: c.status, ratifiedAt: c.ratifiedAt };
}

function serializeService(s: any) {
  return { id: s.id, serviceId: s.serviceId, orgId: s.orgId, orgName: s.orgName,
    name: s.name, description: s.description, serviceType: s.serviceType,
    includes: JSON.parse(s.includes || "[]"),
    pricingModel: s.pricingModel, price: s.price,
    subscribers: s.subscribers, activeDeployments: s.activeDeployments, totalRevenue: s.totalRevenue,
    status: s.status, publishedAt: s.publishedAt };
}
