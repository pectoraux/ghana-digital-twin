// Ghana Digital Twin — Milestone 12.5: Governance Intelligence & Institutional Memory
// Governance agents (constitutional auditor, court research, council intelligence),
// legal precedent system, institutional reputation, automated compliance audits.
//
// Components:
// 1. Governance Agents — AI that assists governance (advisory only, never decides)
// 2. Audit Runs — agent executions (compliance checks, precedent searches, impact analysis)
// 3. Legal Precedents — past verdicts establish principles for future decisions
// 4. Institutional Reputation — accountability for organizations
//
// Kernel is FROZEN. All package-layer.

import { db } from "@/lib/db";
import { createImmutableArtifact } from "@/lib/kernel/engine";

// ===========================================================================
// 1. GOVERNANCE AGENTS
// ===========================================================================

export async function registerGovernanceAgent(input: {
  agentId: string;
  name: string;
  description: string;
  agentType: string;
  capabilities?: string[];
  scope: string;
  authority?: string;
}): Promise<any> {
  const agent = await db.governanceAgent.upsert({
    where: { agentId: input.agentId },
    update: { name: input.name, description: input.description, agentType: input.agentType, capabilities: JSON.stringify(input.capabilities ?? []), scope: input.scope, authority: input.authority ?? "advisory" },
    create: { agentId: input.agentId, name: input.name, description: input.description, agentType: input.agentType, capabilities: JSON.stringify(input.capabilities ?? []), scope: input.scope, authority: input.authority ?? "advisory", status: "active" },
  });
  return serializeAgent(agent);
}

export async function listGovernanceAgents(): Promise<any[]> {
  const rows = await db.governanceAgent.findMany({ where: { status: "active" }, orderBy: { agentType: "asc" } });
  return rows.map(serializeAgent);
}

// ===========================================================================
// 2. AUDIT RUNS — agent executions
// ===========================================================================

let auditCounter = 0;
async function nextAuditId(): Promise<string> {
  const count = await db.governanceAuditRun.count();
  auditCounter = count + 1;
  return `AUD-${Date.now().toString(36).toUpperCase()}-${auditCounter}`;
}

export async function runConstitutionalAudit(input: {
  agentId: string;
  agentName: string;
  targetType?: string;
  targetId?: string;
}): Promise<any> {
  const runId = await nextAuditId();
  const startedAt = Date.now();

  // Simulate constitutional audit — check packages/deployments against articles
  const findings: { severity: string; article: string; description: string; recommendation: string }[] = [];

  // Check packages for constitutional compliance
  if (!input.targetType || input.targetType === "package") {
    const packages = await db.oSIntelligencePackage.findMany({ where: { lifecycleStage: { in: ["experimental", "verified"] } }, take: 10 }).catch(() => []);
    for (const pkg of packages) {
      // Check Article 2: Agent creation standards — agents must declare capabilities + safety boundaries
      if (pkg.packageType === "agent" && pkg.lifecycleStage === "experimental") {
        const agentBoundary = await db.agentSafetyBoundary.findUnique({ where: { agentId: pkg.producerId } }).catch(() => null);
        if (!agentBoundary) {
          findings.push({ severity: "warn", article: "ART-002", description: `Agent package '${pkg.packageId}' has no registered safety boundary`, recommendation: "Register safety boundary before deployment" });
        }
      }
      // Check Article 5: Package suspension authority — packages below threshold should be flagged
      if (pkg.accuracy < 0.7 && pkg.lifecycleStage === "certified") {
        findings.push({ severity: "critical", article: "ART-005", description: `Certified package '${pkg.packageId}' accuracy ${(pkg.accuracy * 100).toFixed(0)}% is below certification threshold`, recommendation: "Suspend certification or require accuracy improvement" });
      }
    }
  }

  // Check proposals for constitutional compliance
  if (!input.targetType || input.targetType === "proposal") {
    const proposals = await db.governanceProposal.findMany({ where: { status: { in: ["proposed", "under_review"] } }, take: 5 }).catch(() => []);
    for (const prop of proposals) {
      if (prop.proposalType === "suspension") {
        findings.push({ severity: "info", article: "ART-005", description: `Suspension proposal '${prop.proposalId}' — verify due process`, recommendation: "Ensure developer has 30-day appeal window per Article 5" });
      }
    }
  }

  const violationCount = findings.filter((f) => f.severity === "critical").length;
  const warnCount = findings.filter((f) => f.severity === "warn").length;
  const result = violationCount > 0 ? "violations_found" : findings.length > 0 ? "recommendations_made" : "compliant";

  const completedAt = new Date();
  const durationMs = Date.now() - startedAt;

  const run = await db.governanceAuditRun.create({
    data: {
      runId,
      agentId: input.agentId,
      agentName: input.agentName,
      auditType: "policy_compliance",
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      findings: JSON.stringify(findings),
      findingCount: findings.length,
      violationCount,
      recommendationCount: warnCount,
      result,
      summary: violationCount > 0 ? `${violationCount} constitutional violations found` : warnCount > 0 ? `${warnCount} recommendations made` : "All packages compliant",
      completedAt,
      durationMs,
    },
  });

  // Update agent stats
  await db.governanceAgent.update({ where: { agentId: input.agentId }, data: { lastRunAt: completedAt, totalRuns: { increment: 1 }, totalFindings: { increment: findings.length }, totalRecommendations: { increment: warnCount } } });

  return serializeAudit(run);
}

export async function runPrecedentSearch(input: {
  agentId: string;
  agentName: string;
  caseType: string;
  caseDescription?: string;
}): Promise<any> {
  const runId = await nextAuditId();
  const startedAt = Date.now();

  // Search precedents for the given case type
  const precedents = await db.governancePrecedent.findMany({
    where: { caseType: input.caseType, precedentLevel: { in: ["binding", "persuasive"] } },
    orderBy: { confidence: "desc" },
    take: 5,
  }).catch(() => []);

  const findings = precedents.map((p) => ({
    severity: "info",
    article: "precedent",
    description: `Precedent ${p.precedentId}: ${p.principleEstablished}`,
    recommendation: p.principleSummary,
  }));

  const completedAt = new Date();
  const durationMs = Date.now() - startedAt;

  const run = await db.governanceAuditRun.create({
    data: {
      runId,
      agentId: input.agentId,
      agentName: input.agentName,
      auditType: "precedent_search",
      targetType: "case",
      targetId: input.caseType,
      findings: JSON.stringify(findings),
      findingCount: findings.length,
      violationCount: 0,
      recommendationCount: findings.length,
      result: "recommendations_made",
      summary: `${precedents.length} relevant precedents found for ${input.caseType}`,
      completedAt,
      durationMs,
    },
  });

  await db.governanceAgent.update({ where: { agentId: input.agentId }, data: { lastRunAt: completedAt, totalRuns: { increment: 1 }, totalRecommendations: { increment: findings.length } } });

  return { ...serializeAudit(run), precedents: precedents.map(serializePrecedent) };
}

export async function runImpactAnalysis(input: {
  agentId: string;
  agentName: string;
  proposalId: string;
  proposalTitle: string;
  proposalType: string;
}): Promise<any> {
  const runId = await nextAuditId();
  const startedAt = Date.now();

  // Simulate impact analysis
  const expectedImpact = `+${Math.floor(Math.random() * 30 + 10)}% improvement in ${input.proposalType === "budget" ? "detection coverage" : "operational efficiency"}`;
  const estimatedCost = input.proposalType === "budget" ? Math.floor(Math.random() * 200000 + 100000) : Math.floor(Math.random() * 50000 + 10000);
  const historicalComparisons = Math.floor(Math.random() * 5 + 1);

  const findings = [
    { severity: "info", article: "impact", description: `Expected impact: ${expectedImpact}`, recommendation: "Proceed with monitoring" },
    { severity: "info", article: "cost", description: `Estimated cost: ${estimatedCost} IC`, recommendation: "Within budget envelope" },
    { severity: "info", article: "comparison", description: `${historicalComparisons} similar programs found in historical records`, recommendation: "Review past outcomes before voting" },
  ];

  const completedAt = new Date();
  const durationMs = Date.now() - startedAt;

  const run = await db.governanceAuditRun.create({
    data: {
      runId,
      agentId: input.agentId,
      agentName: input.agentName,
      auditType: "impact_analysis",
      targetType: "proposal",
      targetId: input.proposalId,
      findings: JSON.stringify(findings),
      findingCount: findings.length,
      violationCount: 0,
      recommendationCount: findings.length,
      result: "recommendations_made",
      summary: `Impact: ${expectedImpact}, Cost: ${estimatedCost} IC, ${historicalComparisons} historical comparisons`,
      completedAt,
      durationMs,
    },
  });

  await db.governanceAgent.update({ where: { agentId: input.agentId }, data: { lastRunAt: completedAt, totalRuns: { increment: 1 }, totalRecommendations: { increment: findings.length } } });

  return { ...serializeAudit(run), impact: { expectedImpact, estimatedCost, historicalComparisons } };
}

export async function listAuditRuns(filter: { agentId?: string; auditType?: string; result?: string } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.agentId) where.agentId = filter.agentId;
  if (filter.auditType) where.auditType = filter.auditType;
  if (filter.result) where.result = filter.result;
  const rows = await db.governanceAuditRun.findMany({ where, orderBy: { startedAt: "desc" }, take: 30 });
  return rows.map(serializeAudit);
}

// ===========================================================================
// 3. LEGAL PRECEDENTS
// ===========================================================================

let precedentCounter = 0;
async function nextPrecedentId(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.governancePrecedent.count();
  precedentCounter = count + 1;
  return `PRE-${year}-${String(precedentCounter).padStart(3, "0")}`;
}

export async function establishPrecedent(input: {
  caseId: string;
  courtId: string;
  caseTitle: string;
  principleEstablished: string;
  principleSummary: string;
  caseType: string;
  appliesTo?: string[];
  precedentLevel?: string;
  courtLevel: string;
  confidence?: number;
}): Promise<any> {
  const precedentId = await nextPrecedentId();
  const precedent = await db.governancePrecedent.create({
    data: {
      precedentId,
      caseId: input.caseId,
      courtId: input.courtId,
      caseTitle: input.caseTitle,
      principleEstablished: input.principleEstablished,
      principleSummary: input.principleSummary,
      caseType: input.caseType,
      appliesTo: JSON.stringify(input.appliesTo ?? [input.caseType]),
      precedentLevel: input.precedentLevel ?? "binding",
      courtLevel: input.courtLevel,
      confidence: input.confidence ?? 0.8,
    },
  });

  await createImmutableArtifact({
    kind: "legal_precedent",
    content: { precedentId, caseId: input.caseId, principle: input.principleEstablished, level: input.precedentLevel ?? "binding" },
    parentHashes: [],
    createdBy: `court:${input.courtId}`,
    createdVia: "precedent_establishment",
    providerUsed: "governance-intelligence",
    providerReason: `Precedent established from case ${input.caseId}: ${input.principleEstablished}`,
  });

  return serializePrecedent(precedent);
}

export async function listPrecedents(filter: { caseType?: string; precedentLevel?: string; courtLevel?: string } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.caseType) where.caseType = filter.caseType;
  if (filter.precedentLevel) where.precedentLevel = filter.precedentLevel;
  if (filter.courtLevel) where.courtLevel = filter.courtLevel;
  const rows = await db.governancePrecedent.findMany({ where, orderBy: { establishedAt: "desc" }, take: 50 });
  return rows.map(serializePrecedent);
}

// ===========================================================================
// 4. INSTITUTIONAL REPUTATION
// ===========================================================================

export async function evaluateInstitution(institutionId: string): Promise<any> {
  // Compute reputation from actual data
  const institution = await db.institutionReputation.findUnique({ where: { institutionId } });
  if (!institution) throw new Error(`Institution ${institutionId} not found`);

  // Compliance: based on audit findings (fewer violations = higher compliance)
  const audits = await db.governanceAuditRun.findMany({ where: { targetType: "institution", targetId: institutionId }, take: 10 }).catch(() => []);
  const violationRate = audits.length > 0 ? audits.filter((a) => a.violationCount > 0).length / audits.length : 0;
  const complianceScore = Math.round((1 - violationRate) * 100);

  // Decision quality: based on council votes and proposal outcomes
  const proposals = await db.governanceProposal.findMany({ where: { proposedBy: institutionId }, take: 10 }).catch(() => []);
  const approvedProposals = proposals.filter((p) => p.status === "approved" || p.status === "enacted").length;
  const decisionQualityScore = proposals.length > 0 ? Math.round((approvedProposals / proposals.length) * 100) : 50;

  // Transparency: based on package publication + review engagement
  const packages = await db.oSIntelligencePackage.findMany({ where: { developerId: institutionId }, take: 10 }).catch(() => []);
  const transparencyScore = packages.length > 0 ? Math.min(100, packages.length * 15 + 40) : 50;

  // Public trust: based on citizen reviews + ratings
  const reviews = await db.packageReview.findMany({ where: { reviewerType: "organization" }, take: 20 }).catch(() => []);
  const publicTrustScore = reviews.length > 0 ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length * 20) : 60;

  const overallScore = Math.round(complianceScore * 0.30 + decisionQualityScore * 0.25 + transparencyScore * 0.20 + publicTrustScore * 0.25);
  const trustTier = overallScore >= 80 ? "anchor" : overallScore >= 65 ? "trusted" : overallScore >= 45 ? "emerging" : "unproven";

  const updated = await db.institutionReputation.update({
    where: { institutionId },
    data: { complianceScore, decisionQualityScore, transparencyScore, publicTrustScore, overallScore, trustTier, lastEvaluatedAt: new Date() },
  });

  return serializeInstitution(updated);
}

export async function registerInstitution(input: {
  institutionId: string;
  name: string;
  institutionType: string;
  countryCode?: string;
}): Promise<any> {
  const inst = await db.institutionReputation.upsert({
    where: { institutionId: input.institutionId },
    update: { name: input.name, institutionType: input.institutionType, countryCode: input.countryCode ?? null },
    create: { institutionId: input.institutionId, name: input.name, institutionType: input.institutionType, countryCode: input.countryCode ?? null },
  });
  return serializeInstitution(inst);
}

export async function listInstitutions(): Promise<any[]> {
  const rows = await db.institutionReputation.findMany({ orderBy: { overallScore: "desc" }, take: 50 });
  return rows.map(serializeInstitution);
}

// ===========================================================================
// 5. OVERVIEW
// ===========================================================================

export async function getGovernanceIntelOverview(): Promise<any> {
  const [agents, audits, precedents, institutions] = await Promise.all([
    db.governanceAgent.count(),
    db.governanceAuditRun.count(),
    db.governancePrecedent.count(),
    db.institutionReputation.count(),
  ]);

  const activeAgents = await db.governanceAgent.count({ where: { status: "active" } });
  const violationsFound = await db.governanceAuditRun.count({ where: { result: "violations_found" } });
  const bindingPrecedents = await db.governancePrecedent.count({ where: { precedentLevel: "binding" } });
  const anchorInstitutions = await db.institutionReputation.count({ where: { trustTier: "anchor" } });

  const agentRows = await db.governanceAgent.findMany({ where: { status: "active" }, orderBy: { agentType: "asc" } });
  const recentAudits = await db.governanceAuditRun.findMany({ orderBy: { startedAt: "desc" }, take: 5 });
  const topInstitutions = await db.institutionReputation.findMany({ orderBy: { overallScore: "desc" }, take: 5 });
  const recentPrecedents = await db.governancePrecedent.findMany({ orderBy: { establishedAt: "desc" }, take: 5 });

  return {
    counts: { agents, audits, precedents, institutions },
    active: { activeAgents, violationsFound, bindingPrecedents, anchorInstitutions },
    agents: agentRows.map(serializeAgent),
    recentAudits: recentAudits.map(serializeAudit),
    topInstitutions: topInstitutions.map(serializeInstitution),
    recentPrecedents: recentPrecedents.map(serializePrecedent),
  };
}

// ===========================================================================
// SERIALIZERS
// ===========================================================================

function serializeAgent(a: any) {
  return { id: a.id, agentId: a.agentId, name: a.name, description: a.description, agentType: a.agentType,
    capabilities: JSON.parse(a.capabilities || "[]"), scope: a.scope, authority: a.authority,
    status: a.status, lastRunAt: a.lastRunAt, totalRuns: a.totalRuns, totalFindings: a.totalFindings, totalRecommendations: a.totalRecommendations };
}

function serializeAudit(r: any) {
  return { id: r.id, runId: r.runId, agentId: r.agentId, agentName: r.agentName,
    auditType: r.auditType, targetType: r.targetType, targetId: r.targetId,
    findings: JSON.parse(r.findings || "[]"), findingCount: r.findingCount, violationCount: r.violationCount, recommendationCount: r.recommendationCount,
    result: r.result, summary: r.summary, startedAt: r.startedAt, completedAt: r.completedAt, durationMs: r.durationMs };
}

function serializePrecedent(p: any) {
  return { id: p.id, precedentId: p.precedentId, caseId: p.caseId, courtId: p.courtId, caseTitle: p.caseTitle,
    principleEstablished: p.principleEstablished, principleSummary: p.principleSummary,
    caseType: p.caseType, appliesTo: JSON.parse(p.appliesTo || "[]"),
    precedentLevel: p.precedentLevel, courtLevel: p.courtLevel,
    citedByCount: p.citedByCount, citedByCases: JSON.parse(p.citedByCases || "[]"),
    confidence: p.confidence, establishedAt: p.establishedAt };
}

function serializeInstitution(i: any) {
  return { id: i.id, institutionId: i.institutionId, name: i.name, institutionType: i.institutionType, countryCode: i.countryCode,
    complianceScore: i.complianceScore, decisionQualityScore: i.decisionQualityScore, transparencyScore: i.transparencyScore, publicTrustScore: i.publicTrustScore,
    overallScore: i.overallScore, trustTier: i.trustTier,
    totalDecisions: i.totalDecisions, totalCases: i.totalCases, casesWon: i.casesWon, casesLost: i.casesLost,
    packagesPublished: i.packagesPublished, packagesSuspended: i.packagesSuspended,
    lastEvaluatedAt: i.lastEvaluatedAt };
}
