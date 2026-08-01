// Ghana Digital Twin — Milestone 12.5: Governance Intelligence Seeding
// Registers governance agents, establishes precedents from existing court cases,
// creates institution reputations, and runs initial audits.

import { db } from "@/lib/db";
import {
  registerGovernanceAgent,
  establishPrecedent,
  registerInstitution,
  evaluateInstitution,
  runConstitutionalAudit,
} from "./engine";

let SEEDED = false;

export async function seedGovernanceIntel(): Promise<{ package: boolean; agents: number; precedents: number; institutions: number }> {
  if (SEEDED) return { package: false, agents: 0, precedents: 0, institutions: 0 };

  await registerPackage();

  const existingAgents = await db.governanceAgent.count();
  if (existingAgents > 0) {
    SEEDED = true;
    return { package: false, agents: 0, precedents: 0, institutions: 0 };
  }

  await seedAgents();
  await seedPrecedents();
  await seedInstitutions();
  await runInitialAudit();

  SEEDED = true;
  return { package: true, agents: 3, precedents: 2, institutions: 5 };
}

async function registerPackage(): Promise<void> {
  await db.governanceIntelligencePackage.upsert({
    where: { packageId: "governance-intelligence" },
    update: {},
    create: {
      packageId: "governance-intelligence",
      name: "Governance Intelligence & Institutional Memory",
      version: "1.0.0",
      provides: JSON.stringify([
        "governance.agent.audit",
        "governance.agent.research",
        "governance.agent.intelligence",
        "governance.precedent.system",
        "governance.institution.reputation",
      ]),
      requires: JSON.stringify([
        "capability:governance.constitution",
        "capability:governance.court",
      ]),
      subPackages: JSON.stringify([
        "constitutional-auditor",
        "court-research-agent",
        "council-intelligence-agent",
        "legal-precedents",
        "institutional-reputation",
      ]),
      active: true,
    },
  });
}

async function seedAgents(): Promise<void> {
  await registerGovernanceAgent({
    agentId: "constitutional-auditor",
    name: "Constitutional Auditor Agent",
    description: "Continuously audits packages, deployments, and proposals against the Intelligence Constitution. Checks Article 2 (agent safety boundaries), Article 5 (package suspension thresholds), Article 3 (AI decision override). Advisory only — never blocks deployments directly, but flags violations for council review.",
    agentType: "constitutional_auditor",
    capabilities: ["policy.compliance.check", "constitutional.violation.detect", "package.audit"],
    scope: "constitutional",
    authority: "monitor",
  });

  await registerGovernanceAgent({
    agentId: "court-research",
    name: "Court Research Agent",
    description: "Assists intelligence courts by searching legal precedents, finding similar past cases, and providing advisory recommendations. Analyzes evidence rooms, identifies relevant principles, and suggests applicable precedents. Not a judge — an advisor.",
    agentType: "court_research",
    capabilities: ["precedent.search", "case.similarity", "evidence.analysis", "ruling.recommendation"],
    scope: "judicial",
    authority: "advisory",
  });

  await registerGovernanceAgent({
    agentId: "council-intelligence",
    name: "Council Intelligence Agent",
    description: "Provides impact analysis before council votes. For each proposal, estimates expected impact, costs, and historical comparisons. Helps council members make informed decisions. Advisory only — never votes.",
    agentType: "council_intelligence",
    capabilities: ["impact.analysis", "cost.estimation", "historical.comparison", "budget.forecast"],
    scope: "legislative",
    authority: "advisory",
  });
}

async function seedPrecedents(): Promise<void> {
  // Establish precedents from existing court cases
  // Case 1: False enforcement (CASE-2026-0001)
  await establishPrecedent({
    caseId: "CASE-2026-0001",
    courtId: "court-ghana",
    caseTitle: "False enforcement: Mining Agent flagged licensed quarry as illegal mining",
    principleEstablished: "Autonomous agents must not create operational incidents below their stated confidence threshold. The agent developer is liable for insufficient safety boundary configuration.",
    principleSummary: "When an agent creates an incident below its confidence gate threshold, the developer bears responsibility for damages. Agents must enforce their own safety boundaries.",
    caseType: "false_enforcement",
    appliesTo: ["false_enforcement", "package_misconduct"],
    precedentLevel: "binding",
    courtLevel: "national",
    confidence: 0.92,
  });

  // Case 2: License violation (CASE-2026-0002)
  await establishPrecedent({
    caseId: "CASE-2026-0002",
    courtId: "court-ghana",
    caseTitle: "License violation: Gold Fields redistributed licensed intelligence package",
    principleEstablished: "Sharing API credentials with third parties constitutes redistribution under intelligence licensing law. License terms are constitutionally enforceable under Article 4 (Evidence Access Control).",
    principleSummary: "Credential sharing = redistribution. Commercial licenses with redistributionAllowed=false prohibit any form of access sharing, including API credentials. Violations result in license termination + damages.",
    caseType: "license_violation",
    appliesTo: ["license_violation", "attribution_dispute", "contract_breach"],
    precedentLevel: "binding",
    courtLevel: "national",
    confidence: 0.95,
  });
}

async function seedInstitutions(): Promise<void> {
  const institutions = [
    { id: "epa-ghana", name: "EPA Ghana", type: "government", country: "GH" },
    { id: "nadmo", name: "NADMO", type: "government", country: "GH" },
    { id: "dev-uog-ghana", name: "University of Ghana — AI Lab", type: "university", country: "GH" },
    { id: "dev-galamseyfree", name: "GalamseyFree Alliance", type: "ngo", country: "GH" },
    { id: "dev-kenya-wildlife", name: "Kenya Wildlife Service", type: "government", country: "KE" },
  ];

  for (const inst of institutions) {
    await registerInstitution({ institutionId: inst.id, name: inst.name, institutionType: inst.type, countryCode: inst.country });
    // Set initial scores based on existing data
    const packages = await db.oSIntelligencePackage.count({ where: { developerId: inst.id } }).catch(() => 0);
    const reviews = await db.packageReview.findMany({ where: { reviewerId: inst.id } }).catch(() => []);
    const cases = await db.courtCase.count({ where: { OR: [{ plaintiffId: inst.id }, { defendantId: inst.id }] } }).catch(() => 0);
    const casesWon = await db.courtCase.count({ where: { plaintiffId: inst.id, verdict: "for_plaintiff" } }).catch(() => 0);

    // Set reasonable initial scores
    const compliance = 70 + Math.floor(Math.random() * 25);
    const decisionQuality = 65 + Math.floor(Math.random() * 25);
    const transparency = Math.min(100, 50 + packages * 10);
    const publicTrust = reviews.length > 0 ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length * 20) : 60 + Math.floor(Math.random() * 20);
    const overall = Math.round(compliance * 0.30 + decisionQuality * 0.25 + transparency * 0.20 + publicTrust * 0.25);
    const tier = overall >= 80 ? "anchor" : overall >= 65 ? "trusted" : overall >= 45 ? "emerging" : "unproven";

    await db.institutionReputation.update({
      where: { institutionId: inst.id },
      data: {
        complianceScore: compliance, decisionQualityScore: decisionQuality,
        transparencyScore: transparency, publicTrustScore: publicTrust,
        overallScore: overall, trustTier: tier,
        packagesPublished: packages, totalCases: cases, casesWon,
        lastEvaluatedAt: new Date(),
      },
    });
  }
}

async function runInitialAudit(): Promise<void> {
  await runConstitutionalAudit({
    agentId: "constitutional-auditor",
    agentName: "Constitutional Auditor Agent",
  }).catch(() => null);
}
