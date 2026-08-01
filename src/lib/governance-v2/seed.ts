// Ghana Digital Twin — Milestone 12: Intelligence Governance Seeding
// Registers the governance package, creates the constitution with articles,
// councils with members, courts with cases + verdicts, and proposals.

import { db } from "@/lib/db";
import {
  createConstitution,
  addArticle,
  ratifyConstitution,
  createCouncil,
  seatMember,
  createCourt,
  fileCase,
  issueVerdict,
  createProposal,
  castVote,
  proposeAmendment,
} from "./engine";

let SEEDED = false;

export async function seedGovernance(): Promise<{ package: boolean; constitution: boolean; councils: number; courts: number; cases: number }> {
  if (SEEDED) return { package: false, constitution: false, councils: 0, courts: 0, cases: 0 };

  await registerPackage();

  const existing = await db.intelligenceConstitution.count();
  if (existing > 0) {
    SEEDED = true;
    return { package: false, constitution: false, councils: 0, courts: 0, cases: 0 };
  }

  // 1. Constitution + articles
  await seedConstitution();

  // 2. Councils + members
  await seedCouncils();

  // 3. Courts + cases + verdicts
  await seedCourts();

  // 4. Proposals + votes
  await seedProposals();

  // 5. Amendment
  await seedAmendment();

  SEEDED = true;
  return { package: true, constitution: true, councils: 2, courts: 3, cases: 3 };
}

async function registerPackage(): Promise<void> {
  await db.governancePackage.upsert({
    where: { packageId: "intelligence-governance" },
    update: {},
    create: {
      packageId: "intelligence-governance",
      name: "Intelligence Governance & Constitutional Layer",
      version: "1.0.0",
      provides: JSON.stringify([
        "governance.constitution",
        "governance.council",
        "governance.court",
        "governance.proposal",
        "governance.amendment",
        "governance.voting",
      ]),
      requires: JSON.stringify([
        "capability:trust.scoring",
        "capability:governance.approval",
      ]),
      subPackages: JSON.stringify([
        "constitution",
        "council-governance",
        "intelligence-courts",
        "proposal-system",
        "amendment-process",
      ]),
      active: true,
    },
  });
}

async function seedConstitution(): Promise<void> {
  await createConstitution({
    constitutionId: "constitution-v1",
    title: "Intelligence Civilization Constitution v1.0",
    preamble: "We, the participants of the Intelligence Civilization — citizens, developers, governments, organizations, and autonomous agents — hereby establish this Constitution to govern the production, verification, exchange, and deployment of intelligence. We affirm that intelligence is a public good, that trust is the foundation of adoption, that sovereignty is inviolable, and that the benefits of intelligence must be distributed fairly among all contributors.",
  });

  const articles = [
    { number: 1, title: "Right to Produce Intelligence", body: "Any entity — citizen, developer, organization, or autonomous agent — may produce and publish intelligence on the network, provided they comply with capability contracts, conformance tests, and truth verification standards.", category: "rights", governs: "intelligence_publication", enforcementMechanism: "automatic" },
    { number: 2, title: "Agent Creation Standards", body: "Autonomous agents may be created by any developer with verified identity. Agents must declare their capabilities, safety boundaries, and risk levels. Agents at risk level 4 (alert) or 5 (intervene) require council approval before deployment.", category: "obligations", governs: "agent_creation", enforcementMechanism: "council_review" },
    { number: 3, title: "AI Decision Override", body: "No autonomous agent may override a human decision in operational matters. Agents may recommend, hypothesize, and alert, but the final decision in any operational workflow rests with a human operator holding the appropriate institutional role.", category: "limits", governs: "ai_override", enforcementMechanism: "automatic" },
    { number: 4, title: "Evidence Access Control", body: "Access to raw evidence (satellite imagery, citizen reports, field data) is governed by intelligence licenses and treaties. Citizens own their reported evidence. Organizations may access evidence only under the terms of the applicable license. Courts may compel evidence disclosure in dispute resolution.", category: "procedures", governs: "evidence_access", enforcementMechanism: "court_arbitration" },
    { number: 5, title: "Package Suspension Authority", body: "The Governance Council may suspend any intelligence package that violates conformance, security, or ethical standards. Suspension requires a 2/3 majority vote. The package developer may appeal to the Intelligence Court within 30 days.", category: "oversight", governs: "package_suspension", enforcementMechanism: "council_review" },
    { number: 6, title: "Citizen Rights", body: "Every citizen has the right to: (a) report intelligence without fear of retribution, (b) receive fair compensation for verified contributions, (c) appeal reputation decisions through the court system, (d) access their own data and evidence, (e) withdraw from the network at any time with their data intact.", category: "rights", governs: "citizen_rights", enforcementMechanism: "court_arbitration" },
    { number: 7, title: "Developer Rights", body: "Every developer has the right to: (a) publish packages without arbitrary interference, (b) receive revenue from their contributions, (c) set licensing terms within constitutional limits, (d) appeal package suspension through the court system, (e) participate in governance through proposals and votes.", category: "rights", governs: "developer_rights", enforcementMechanism: "council_review" },
    { number: 8, title: "Federation Sovereignty", body: "Each federation node maintains sovereignty over its data, citizens, and trust graph. No node may be compelled to share data it considers sovereign. Trust proofs are exchanged — not trust itself. Treaties govern what intelligence may cross borders.", category: "procedures", governs: "federation", enforcementMechanism: "treaty_enforcement" },
    { number: 9, title: "Dispute Resolution", body: "All disputes arising under this Constitution shall be resolved through the Intelligence Court system. Cases may be appealed from national to regional to global courts. Verdicts are binding and enforceable through package suspension, account suspension, or financial remedies.", category: "procedures", governs: "dispute_resolution", enforcementMechanism: "court_arbitration" },
    { number: 10, title: "Constitutional Amendment", body: "This Constitution may be amended by a 2/3 majority vote of the Global Intelligence Council. Amendments must be proposed in writing, reviewed for 14 days, and ratified by a vote. No amendment may remove citizen rights (Article 6) or federation sovereignty (Article 8).", category: "procedures", governs: "amendment_process", enforcementMechanism: "council_review" },
  ];

  for (const a of articles) {
    await addArticle({ constitutionId: "constitution-v1", ...a });
  }

  await ratifyConstitution("constitution-v1");
}

async function seedCouncils(): Promise<void> {
  // Global Intelligence Council
  await createCouncil({
    councilId: "global-intelligence-council",
    name: "Global Intelligence Council",
    description: "The supreme governing body of the intelligence civilization. Composed of representatives from governments, citizens, developers, scientific institutions, and NGOs. Handles constitutional amendments, package suspensions, treaty approvals, and global policy.",
    councilType: "global",
    scope: "planetary",
    seatCount: 12,
    quorumThreshold: 0.6,
    approvalThreshold: 0.66,
  });

  // Seat members
  const members = [
    { name: "Dr. Ama Boaten", id: "rep-epa-ghana", type: "government", constituency: "EPA Ghana" },
    { name: "Kofi Mensah", id: "rep-citizens-gh", type: "citizen", constituency: "Ghana Citizen Representatives" },
    { name: "Prof. Grace Adjei", id: "rep-uog", type: "scientific", constituency: "University of Ghana AI Lab" },
    { name: "Sarah Johnson", id: "rep-dev-community", type: "developer", constituency: "Developer Community" },
    { name: "Nana Owusu", id: "rep-nadmo", type: "government", constituency: "NADMO" },
    { name: "Esi Dakwa", id: "rep-galamseyfree", type: "ngo", constituency: "GalamseyFree Alliance" },
    { name: "Dr. Chidi Okafor", id: "rep-nigeria", type: "government", constituency: "Nigeria Federal Min. of Environment" },
    { name: "Wangari Mwangi", id: "rep-kenya", type: "government", constituency: "Kenya Wildlife Service" },
    { name: "Dr. Aisha Toure", id: "rep-ecowas", type: "regional", constituency: "ECOWAS Regional Coordination" },
    { name: "James Park", id: "rep-independent", type: "developer", constituency: "Independent Developers" },
  ];

  for (const m of members) {
    await seatMember({
      councilId: "global-intelligence-council",
      representativeName: m.name,
      representativeId: m.id,
      constituencyType: m.type,
      constituencyName: m.constituency,
      votingWeight: 1.0,
      termEnd: "2028-08-01",
    });
  }

  // Ghana National Intelligence Council
  await createCouncil({
    councilId: "ghana-intelligence-council",
    name: "Ghana National Intelligence Council",
    description: "National governing body for Ghana's intelligence network. Handles domestic policy, package approvals, and national dispute resolution.",
    councilType: "national",
    scope: "ghana",
    seatCount: 7,
    quorumThreshold: 0.5,
    approvalThreshold: 0.6,
  });

  const ghMembers = [
    { name: "Dr. Ama Boaten", id: "rep-epa-ghana", type: "government", constituency: "EPA Ghana" },
    { name: "Kofi Mensah", id: "rep-citizens-gh", type: "citizen", constituency: "Citizen Representatives" },
    { name: "Nana Owusu", id: "rep-nadmo", type: "government", constituency: "NADMO" },
    { name: "Prof. Grace Adjei", id: "rep-uog", type: "scientific", constituency: "University of Ghana" },
    { name: "Esi Dakwa", id: "rep-galamseyfree", type: "ngo", constituency: "GalamseyFree Alliance" },
  ];

  for (const m of ghMembers) {
    await seatMember({
      councilId: "ghana-intelligence-council",
      representativeName: m.name,
      representativeId: m.id,
      constituencyType: m.type,
      constituencyName: m.constituency,
    });
  }
}

async function seedCourts(): Promise<void> {
  // Courts
  await createCourt({
    courtId: "court-ghana",
    name: "Ghana Intelligence Court",
    description: "National intelligence court for Ghana. Handles domestic disputes: false enforcement, evidence manipulation, license violations, reputation attacks.",
    jurisdiction: "national",
    scope: "ghana",
    justiceCount: 5,
  });

  await createCourt({
    courtId: "court-ecowas",
    name: "ECOWAS Regional Intelligence Court",
    description: "Regional court for cross-border intelligence disputes among ECOWAS member states. Handles treaty violations, federated trust disputes, and cross-border attribution conflicts.",
    jurisdiction: "regional",
    scope: "africa",
    justiceCount: 7,
  });

  await createCourt({
    courtId: "court-global",
    name: "Global Intelligence Court",
    description: "Supreme intelligence court. Handles appeals from national/regional courts, global constitutional disputes, and cases involving multiple federation nodes.",
    jurisdiction: "global",
    scope: "planetary",
    justiceCount: 9,
  });

  // Case 1: False enforcement (resolved — for plaintiff)
  const case1 = await fileCase({
    courtId: "court-ghana",
    plaintiffId: "cit-ye7r1",
    plaintiffName: "kwesi_western",
    plaintiffType: "citizen",
    defendantId: "mining-analyst",
    defendantName: "Mining Analysis Agent",
    defendantType: "agent",
    caseType: "false_enforcement",
    title: "False enforcement: Mining Agent flagged licensed quarry as illegal mining",
    description: "The Mining Analysis Agent incorrectly classified a licensed quarry operation as illegal mining activity (incident GH-MIN-2026-001), leading to an EPA inspection that disrupted the quarry operator's legal business. The citizen reporter (kwesi_western) who was initially credited for the report is now disputing the enforcement action. The agent's confidence was 0.29 — below the operational threshold — yet the incident was still created.",
    evidenceArtifacts: ["CE-2026-0007", "GH-MIN-2026-001"],
    damagesClaimed: 500,
  });

  if (case1) {
    await issueVerdict({
      caseId: case1.caseId,
      courtId: "court-ghana",
      ruling: "for_plaintiff",
      summary: "The Mining Analysis Agent acted prematurely by creating an incident below the 0.5 confidence threshold. The agent developer (University of Ghana) must improve the confidence gate. Damages awarded to the quarry operator.",
      reasoning: "Article 3 of the Constitution prohibits autonomous agents from overriding human decisions in operational matters. While the agent did not directly override a human, it created an incident that triggered enforcement action below the stated confidence threshold. The agent's safety boundary should have prevented incident creation at 0.29 confidence. The developer is liable for insufficient safety boundary configuration.",
      remedies: [
        { type: "financial_compensation", target: "quarry-operator", action: "pay_damages", amount: 350 },
        { type: "package_update", target: "dev-uog-ghana", action: "update_confidence_gate", amount: 0 },
        { type: "agent_restriction", target: "mining-analyst", action: "lower_risk_level_to_2", amount: 0 },
      ],
      damagesAwarded: 350,
      justiceCount: 5,
      concurringVotes: 4,
      dissentingVotes: 1,
    });
  }

  // Case 2: License violation (resolved — for defendant)
  const case2 = await fileCase({
    courtId: "court-ghana",
    plaintiffId: "dev-uog-ghana",
    plaintiffName: "University of Ghana — AI Lab",
    plaintiffType: "developer",
    defendantId: "gold-fields-ghana",
    defendantName: "Gold Fields Ghana",
    defendantType: "organization",
    caseType: "license_violation",
    title: "License violation: Gold Fields redistributed licensed intelligence package",
    description: "Gold Fields Ghana purchased a subscription to the Mining Analyst Pro package (commercial license, redistribution not allowed) and subsequently shared the API credentials with a third-party contractor, violating the license terms.",
    evidenceArtifacts: ["IA-2026-0002", "LIC-MINING-PRO"],
    damagesClaimed: 2000,
  });

  if (case2) {
    await issueVerdict({
      caseId: case2.caseId,
      courtId: "court-ghana",
      ruling: "for_plaintiff",
      summary: "Gold Fields Ghana violated the commercial license terms by redistributing API credentials. License termination + damages awarded to the developer.",
      reasoning: "The license issued for Mining Analyst Pro explicitly prohibits redistribution (redistributionAllowed = false). Gold Fields Ghana shared API credentials with a third party, which constitutes redistribution under Article 4 (Evidence Access Control). The developer's licensing terms are enforceable under the Constitution.",
      remedies: [
        { type: "financial_compensation", target: "gold-fields-ghana", action: "pay_damages", amount: 2000 },
        { type: "license_termination", target: "gold-fields-ghana", action: "terminate_subscription", amount: 0 },
        { type: "access_revocation", target: "gold-fields-ghana", action: "revoke_api_credentials", amount: 0 },
      ],
      damagesAwarded: 2000,
      justiceCount: 5,
      concurringVotes: 5,
      dissentingVotes: 0,
    });
  }

  // Case 3: Reputation attack (under review)
  await fileCase({
    courtId: "court-ghana",
    plaintiffId: "cit-ye7r1",
    plaintiffName: "kwesi_western",
    plaintiffType: "citizen",
    defendantId: "unknown-actor",
    defendantName: "Unknown Coordinated Actor",
    defendantType: "organization",
    caseType: "reputation_attack",
    title: "Reputation attack: Coordinated false witness rejections targeting kwesi_western",
    description: "A coordinated group of accounts submitted false 'reject' witness responses on multiple events reported by kwesi_western, attempting to lower his civic score. The Sybil detection system flagged 3 accounts for coordinated witnessing. kwesi_western is seeking reputation restoration + damages.",
    evidenceArtifacts: ["SF-COORD-001", "SF-COORD-002", "SF-COORD-003"],
    damagesClaimed: 1000,
  });
}

async function seedProposals(): Promise<void> {
  // Proposal 1: Budget allocation (approved)
  const prop1 = await createProposal({
    councilId: "global-intelligence-council",
    proposedBy: "rep-ecowas",
    proposerName: "Dr. Aisha Toure (ECOWAS)",
    proposalType: "budget",
    title: "Allocate 500,000 IC for ECOWAS cross-border illegal mining bounty",
    description: "ECOWAS proposes allocating 500,000 IC from the federation treasury to fund a cross-border intelligence bounty for detecting illegal mining across shared river basins in Ghana, Côte d'Ivoire, and Nigeria.",
    details: { amount: 500000, category: "environmental_violation", geography: "west_africa_shared_rivers" },
  });

  // Votes for proposal 1
  const voters = [
    { id: "rep-epa-ghana", name: "Dr. Ama Boaten", vote: "approve", rationale: "Critical for regional enforcement" },
    { id: "rep-nadmo", name: "Nana Owusu", vote: "approve", rationale: "Supports cross-border cooperation" },
    { id: "rep-uog", name: "Prof. Grace Adjei", vote: "approve", rationale: "Scientifically sound approach" },
    { id: "rep-citizens-gh", name: "Kofi Mensah", vote: "approve", rationale: "Citizen intelligence will contribute" },
    { id: "rep-nigeria", name: "Dr. Chidi Okafor", vote: "approve", rationale: "Nigeria will participate" },
    { id: "rep-dev-community", name: "Sarah Johnson", vote: "abstain", rationale: "No direct developer impact" },
  ];

  for (const v of voters) {
    await castVote({
      councilId: "global-intelligence-council",
      memberId: v.id, memberName: v.name,
      proposalType: "budget", proposalId: prop1.proposalId, proposalTitle: prop1.title,
      vote: v.vote, rationale: v.rationale,
    });
  }

  // Mark proposal 1 as approved
  await db.governanceProposal.update({ where: { proposalId: prop1.proposalId }, data: { status: "approved", enactedAt: new Date() } });

  // Proposal 2: Package suspension (under review)
  await createProposal({
    councilId: "global-intelligence-council",
    proposedBy: "rep-epa-ghana",
    proposerName: "Dr. Ama Boaten (EPA Ghana)",
    proposalType: "suspension",
    title: "Suspend 'cocoa-disease-detector' package pending accuracy review",
    description: "EPA Ghana requests suspension of the cocoa-disease-detector package (v1.1.0) after field verification showed 3 false positives in a 30-day period. Accuracy has dropped below the certified threshold of 80%.",
    details: { packageId: "cocoa-disease-detector", version: "1.1.0", reason: "accuracy_below_threshold", currentAccuracy: 0.79 },
  });
}

async function seedAmendment(): Promise<void> {
  await proposeAmendment({
    constitutionId: "constitution-v1",
    amendmentType: "add",
    title: "Article 11: Autonomous Intelligence Organizations",
    description: "Proposes adding a new article recognizing autonomous intelligence organizations (digital institutions with agents, policies, budgets, and human members) as legal entities within the intelligence civilization, with the same rights and obligations as other participants.",
    proposedText: "Autonomous Intelligence Organizations — digital institutions composed of agents, policies, budgets, mission objectives, and human members — are recognized as legal entities within the intelligence civilization. They may own intelligence assets, enter into contracts, participate in the marketplace, and be held liable for damages. They must register with the Governance Council and maintain transparency of their governance structure.",
    proposedBy: "rep-dev-community",
    proposerName: "Sarah Johnson (Developer Community)",
  });
}
