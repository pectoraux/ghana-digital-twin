// Ghana Digital Twin — Milestone 12: Intelligence Governance & Constitutional Layer
// Who governs the intelligence civilization? Constitution (rules), Council
// (federated governance), Courts (dispute resolution), Proposals (change process).
//
// Components:
// 1. Intelligence Constitution — foundational rules (articles governing rights, obligations, procedures)
// 2. Constitution Amendments — change process requiring council approval
// 3. Governance Council — federated body of representatives (gov, citizens, devs, scientists, NGOs)
// 4. Council Voting — proposals, amendments, suspensions, budgets, treaties
// 5. Intelligence Courts — dispute resolution (false enforcement, evidence manipulation, license violations)
// 6. Court Verdicts — formal rulings with remedies + damages
// 7. Governance Proposals — any matter before the council
//
// Kernel is FROZEN. All package-layer.

import { db } from "@/lib/db";
import { createImmutableArtifact } from "@/lib/kernel/engine";

// ===========================================================================
// 1. CONSTITUTION
// ===========================================================================

export async function createConstitution(input: {
  constitutionId: string;
  title: string;
  preamble: string;
  version?: string;
}): Promise<any> {
  const constitution = await db.intelligenceConstitution.upsert({
    where: { constitutionId: input.constitutionId },
    update: { title: input.title, preamble: input.preamble, version: input.version ?? "1.0.0" },
    create: { constitutionId: input.constitutionId, title: input.title, preamble: input.preamble, version: input.version ?? "1.0.0", status: "draft" },
  });
  return serializeConstitution(constitution);
}

export async function ratifyConstitution(constitutionId: string): Promise<any> {
  const articles = await db.constitutionArticle.count({ where: { constitutionId } });
  const constitution = await db.intelligenceConstitution.update({
    where: { constitutionId },
    data: { status: "ratified", ratifiedAt: new Date(), articleCount: articles },
  });

  // Create immutable artifact
  await createImmutableArtifact({
    kind: "constitution_ratified",
    content: { constitutionId, title: constitution.title, articles, ratifiedAt: constitution.ratifiedAt },
    parentHashes: [],
    createdBy: "governance-council",
    createdVia: "ratification",
    providerUsed: "intelligence-governance",
    providerReason: `Constitution ${constitutionId} ratified with ${articles} articles`,
  });

  return serializeConstitution(constitution);
}

export async function getConstitution(constitutionId: string): Promise<any | null> {
  const c = await db.intelligenceConstitution.findUnique({ where: { constitutionId } });
  if (!c) return null;
  const articles = await db.constitutionArticle.findMany({ where: { constitutionId, status: "active" }, orderBy: { number: "asc" } });
  const amendments = await db.constitutionAmendment.findMany({ where: { constitutionId }, orderBy: { proposedAt: "desc" }, take: 5 });
  return { ...serializeConstitution(c), articles: articles.map(serializeArticle), recentAmendments: amendments.map(serializeAmendment) };
}

export async function addArticle(input: {
  constitutionId: string;
  number: number;
  title: string;
  body: string;
  category: string;
  governs: string;
  enforcementMechanism?: string;
}): Promise<any> {
  const articleId = `ART-${String(input.number).padStart(3, "0")}`;
  const article = await db.constitutionArticle.create({
    data: {
      articleId,
      constitutionId: input.constitutionId,
      number: input.number,
      title: input.title,
      body: input.body,
      category: input.category,
      governs: input.governs,
      enforcementMechanism: input.enforcementMechanism ?? "council_review",
      status: "active",
    },
  });
  await db.intelligenceConstitution.update({ where: { constitutionId: input.constitutionId }, data: { articleCount: { increment: 1 } } });
  return serializeArticle(article);
}

export async function listConstitutions(): Promise<any[]> {
  const rows = await db.intelligenceConstitution.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(serializeConstitution);
}

// ===========================================================================
// 2. AMENDMENTS
// ===========================================================================

export async function proposeAmendment(input: {
  constitutionId: string;
  articleId?: string;
  amendmentType: string; // add | modify | repeal
  title: string;
  description: string;
  proposedText?: string;
  proposedBy: string;
  proposerName: string;
}): Promise<any> {
  const amendmentId = `AMD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const amendment = await db.constitutionAmendment.create({
    data: {
      amendmentId,
      constitutionId: input.constitutionId,
      articleId: input.articleId ?? null,
      amendmentType: input.amendmentType,
      title: input.title,
      description: input.description,
      proposedText: input.proposedText ?? null,
      proposedBy: input.proposedBy,
      proposerName: input.proposerName,
      status: "proposed",
    },
  });

  await createImmutableArtifact({
    kind: "amendment_proposed",
    content: { amendmentId, constitutionId: input.constitutionId, type: input.amendmentType, title: input.title, proposedBy: input.proposedBy },
    parentHashes: [],
    createdBy: `council:${input.proposedBy}`,
    createdVia: "amendment_process",
    providerUsed: "intelligence-governance",
    providerReason: `Amendment proposed: ${input.title}`,
  });

  return serializeAmendment(amendment);
}

export async function listAmendments(constitutionId?: string): Promise<any[]> {
  const where: any = {};
  if (constitutionId) where.constitutionId = constitutionId;
  return db.constitutionAmendment.findMany({ where, orderBy: { proposedAt: "desc" }, take: 50 });
}

// ===========================================================================
// 3. GOVERNANCE COUNCIL
// ===========================================================================

export async function createCouncil(input: {
  councilId: string;
  name: string;
  description: string;
  councilType: string;
  scope: string;
  seatCount?: number;
  quorumThreshold?: number;
  approvalThreshold?: number;
}): Promise<any> {
  const council = await db.governanceCouncil.upsert({
    where: { councilId: input.councilId },
    update: { name: input.name, description: input.description, seatCount: input.seatCount ?? 12 },
    create: {
      councilId: input.councilId, name: input.name, description: input.description,
      councilType: input.councilType, scope: input.scope,
      seatCount: input.seatCount ?? 12,
      quorumThreshold: input.quorumThreshold ?? 0.6, approvalThreshold: input.approvalThreshold ?? 0.66,
    },
  });
  return serializeCouncil(council);
}

export async function listCouncils(): Promise<any[]> {
  const rows = await db.governanceCouncil.findMany({ where: { status: "active" }, orderBy: { establishedAt: "asc" } });
  return rows.map(serializeCouncil);
}

export async function getCouncil(councilId: string): Promise<any | null> {
  const c = await db.governanceCouncil.findUnique({ where: { councilId } });
  if (!c) return null;
  const members = await db.councilMember.findMany({ where: { councilId, status: "active" }, orderBy: { seatedAt: "asc" } });
  return { ...serializeCouncil(c), members: members.map(serializeMember) };
}

// ===========================================================================
// 4. COUNCIL MEMBERS
// ===========================================================================

export async function seatMember(input: {
  councilId: string;
  representativeName: string;
  representativeId: string;
  constituencyType: string;
  constituencyName: string;
  votingWeight?: number;
  termEnd?: string;
}): Promise<any> {
  const memberId = `MEM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const member = await db.councilMember.create({
    data: {
      memberId,
      councilId: input.councilId,
      representativeName: input.representativeName,
      representativeId: input.representativeId,
      constituencyType: input.constituencyType,
      constituencyName: input.constituencyName,
      votingWeight: input.votingWeight ?? 1.0,
      termEnd: input.termEnd ? new Date(input.termEnd) : null,
    },
  });
  await db.governanceCouncil.update({ where: { councilId: input.councilId }, data: { memberCount: { increment: 1 } } });
  return serializeMember(member);
}

export async function listMembers(councilId?: string): Promise<any[]> {
  const where: any = { status: "active" };
  if (councilId) where.councilId = councilId;
  const rows = await db.councilMember.findMany({ where, orderBy: { seatedAt: "asc" } });
  return rows.map(serializeMember);
}

// ===========================================================================
// 5. COUNCIL VOTING + PROPOSALS
// ===========================================================================

export async function createProposal(input: {
  councilId: string;
  proposedBy: string;
  proposerName: string;
  proposalType: string;
  title: string;
  description: string;
  details?: any;
}): Promise<any> {
  const proposalId = `PROP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const proposal = await db.governanceProposal.create({
    data: {
      proposalId,
      councilId: input.councilId,
      proposedBy: input.proposedBy,
      proposerName: input.proposerName,
      proposalType: input.proposalType,
      title: input.title,
      description: input.description,
      details: JSON.stringify(input.details ?? {}),
      status: "proposed",
    },
  });

  await createImmutableArtifact({
    kind: "governance_proposal",
    content: { proposalId, type: input.proposalType, title: input.title, councilId: input.councilId },
    parentHashes: [],
    createdBy: `council:${input.proposedBy}`,
    createdVia: "proposal_process",
    providerUsed: "intelligence-governance",
    providerReason: `Proposal: ${input.title}`,
  });

  return serializeProposal(proposal);
}

export async function castVote(input: {
  councilId: string;
  memberId: string;
  memberName: string;
  proposalType: string;
  proposalId: string;
  proposalTitle: string;
  vote: string; // approve | reject | abstain
  rationale?: string;
  votingWeight?: number;
}): Promise<any> {
  const voteId = `VOT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const weight = input.votingWeight ?? 1.0;
  const vote = await db.councilVote.create({
    data: {
      voteId,
      councilId: input.councilId,
      memberId: input.memberId,
      memberName: input.memberName,
      proposalType: input.proposalType,
      proposalId: input.proposalId,
      proposalTitle: input.proposalTitle,
      vote: input.vote,
      rationale: input.rationale ?? null,
      votingWeight: weight,
    },
  });

  // Update proposal vote counts
  const proposal = await db.governanceProposal.findUnique({ where: { proposalId: input.proposalId } });
  if (proposal) {
    const updates: any = { voteCount: { increment: 1 } };
    if (input.vote === "approve") { updates.approveCount = { increment: 1 }; updates.weightedApprove = { increment: weight }; }
    if (input.vote === "reject") { updates.rejectCount = { increment: 1 }; updates.weightedReject = { increment: weight }; }
    if (input.vote === "abstain") { updates.abstainCount = { increment: 1 }; }
    await db.governanceProposal.update({ where: { proposalId: input.proposalId }, data: updates });
  }

  return serializeVote(vote);
}

export async function listProposals(filter: { councilId?: string; status?: string; proposalType?: string } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.councilId) where.councilId = filter.councilId;
  if (filter.status) where.status = filter.status;
  if (filter.proposalType) where.proposalType = filter.proposalType;
  return db.governanceProposal.findMany({ where, orderBy: { proposedAt: "desc" }, take: 50 });
}

export async function getProposal(proposalId: string): Promise<any | null> {
  const p = await db.governanceProposal.findUnique({ where: { proposalId } });
  if (!p) return null;
  const votes = await db.councilVote.findMany({ where: { proposalType: p.proposalType, proposalId }, orderBy: { votedAt: "desc" } });
  return { ...serializeProposal(p), votes: votes.map(serializeVote) };
}

export async function listVotes(proposalType?: string, proposalId?: string): Promise<any[]> {
  const where: any = {};
  if (proposalType) where.proposalType = proposalType;
  if (proposalId) where.proposalId = proposalId;
  return db.councilVote.findMany({ where, orderBy: { votedAt: "desc" }, take: 50 });
}

// ===========================================================================
// 6. INTELLIGENCE COURTS
// ===========================================================================

export async function createCourt(input: {
  courtId: string;
  name: string;
  description: string;
  jurisdiction: string;
  scope: string;
  justiceCount?: number;
}): Promise<any> {
  const court = await db.intelligenceCourt.upsert({
    where: { courtId: input.courtId },
    update: { name: input.name, description: input.description },
    create: { courtId: input.courtId, name: input.name, description: input.description, jurisdiction: input.jurisdiction, scope: input.scope, justiceCount: input.justiceCount ?? 5 },
  });
  return serializeCourt(court);
}

export async function listCourts(): Promise<any[]> {
  const rows = await db.intelligenceCourt.findMany({ where: { status: "active" }, orderBy: { establishedAt: "asc" } });
  return rows.map(serializeCourt);
}

// ===========================================================================
// 7. COURT CASES
// ===========================================================================

let caseCounter = 0;
async function nextCaseId(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.courtCase.count();
  caseCounter = count + 1;
  return `CASE-${year}-${String(caseCounter).padStart(4, "0")}`;
}

export async function fileCase(input: {
  courtId: string;
  plaintiffId: string;
  plaintiffName: string;
  plaintiffType: string;
  defendantId: string;
  defendantName: string;
  defendantType: string;
  caseType: string;
  title: string;
  description: string;
  evidenceArtifacts?: string[];
  damagesClaimed?: number;
}): Promise<any> {
  const caseId = await nextCaseId();
  const caseRow = await db.courtCase.create({
    data: {
      caseId,
      courtId: input.courtId,
      plaintiffId: input.plaintiffId, plaintiffName: input.plaintiffName, plaintiffType: input.plaintiffType,
      defendantId: input.defendantId, defendantName: input.defendantName, defendantType: input.defendantType,
      caseType: input.caseType, title: input.title, description: input.description,
      evidenceArtifacts: JSON.stringify(input.evidenceArtifacts ?? []),
      damagesClaimed: input.damagesClaimed ?? 0,
      status: "filed",
    },
  });

  await createImmutableArtifact({
    kind: "court_case_filed",
    content: { caseId, courtId: input.courtId, caseType: input.caseType, title: input.title, plaintiff: input.plaintiffName, defendant: input.defendantName },
    parentHashes: input.evidenceArtifacts ?? [],
    createdBy: `plaintiff:${input.plaintiffId}`,
    createdVia: "court_filing",
    providerUsed: "intelligence-governance",
    providerReason: `Case filed: ${input.title}`,
  });

  return serializeCase(caseRow);
}

export async function listCases(filter: { courtId?: string; caseType?: string; status?: string } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.courtId) where.courtId = filter.courtId;
  if (filter.caseType) where.caseType = filter.caseType;
  if (filter.status) where.status = filter.status;
  return db.courtCase.findMany({ where, orderBy: { filedAt: "desc" }, take: 50 });
}

export async function getCase(caseId: string): Promise<any | null> {
  const c = await db.courtCase.findUnique({ where: { caseId } });
  if (!c) return null;
  const verdict = await db.courtVerdict.findFirst({ where: { caseId }, orderBy: { ruledAt: "desc" } });
  return { ...serializeCase(c), verdict: verdict ? serializeVerdict(verdict) : null };
}

// ===========================================================================
// 8. COURT VERDICTS
// ===========================================================================

export async function issueVerdict(input: {
  caseId: string;
  courtId: string;
  ruling: string; // for_plaintiff | for_defendant | settled | dismissed
  summary: string;
  reasoning: string;
  remedies?: { type: string; target: string; action: string; amount?: number }[];
  damagesAwarded?: number;
  justiceCount?: number;
  concurringVotes?: number;
  dissentingVotes?: number;
}): Promise<any> {
  const verdictId = `VRD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const verdict = await db.courtVerdict.create({
    data: {
      verdictId,
      caseId: input.caseId,
      courtId: input.courtId,
      ruling: input.ruling,
      summary: input.summary,
      reasoning: input.reasoning,
      remedies: JSON.stringify(input.remedies ?? []),
      damagesAwarded: input.damagesAwarded ?? 0,
      justiceCount: input.justiceCount ?? 5,
      concurringVotes: input.concurringVotes ?? 4,
      dissentingVotes: input.dissentingVotes ?? 1,
    },
  });

  // Update case status
  await db.courtCase.update({
    where: { caseId: input.caseId },
    data: {
      status: "ruled",
      verdict: input.ruling,
      verdictSummary: input.summary,
      damagesAwarded: input.damagesAwarded ?? 0,
      ruledAt: new Date(),
    },
  });

  await createImmutableArtifact({
    kind: "court_verdict",
    content: { verdictId, caseId: input.caseId, ruling: input.ruling, summary: input.summary, damagesAwarded: input.damagesAwarded ?? 0 },
    parentHashes: [],
    createdBy: `court:${input.courtId}`,
    createdVia: "judicial_ruling",
    providerUsed: "intelligence-governance",
    providerReason: `Verdict: ${input.ruling} — ${input.summary}`,
  });

  return serializeVerdict(verdict);
}

export async function listVerdicts(limit = 20): Promise<any[]> {
  const rows = await db.courtVerdict.findMany({ orderBy: { ruledAt: "desc" }, take: limit });
  return rows.map(serializeVerdict);
}

// ===========================================================================
// 9. OVERVIEW
// ===========================================================================

export async function getGovernanceOverview(): Promise<any> {
  const [constitutions, articles, amendments, councils, members, proposals, courts, cases, verdicts, votes] = await Promise.all([
    db.intelligenceConstitution.count(),
    db.constitutionArticle.count(),
    db.constitutionAmendment.count(),
    db.governanceCouncil.count(),
    db.councilMember.count({ where: { status: "active" } }),
    db.governanceProposal.count(),
    db.intelligenceCourt.count(),
    db.courtCase.count(),
    db.courtVerdict.count(),
    db.councilVote.count(),
  ]);

  const ratifiedConstitutions = await db.intelligenceConstitution.count({ where: { status: "ratified" } });
  const activeCouncils = await db.governanceCouncil.count({ where: { status: "active" } });
  const openProposals = await db.governanceProposal.count({ where: { status: { in: ["proposed", "under_review", "voting"] } } });
  const openCases = await db.courtCase.count({ where: { status: { in: ["filed", "under_review", "hearing"] } } });
  const ruledCases = await db.courtCase.count({ where: { status: "ruled" } });

  const constitution = await db.intelligenceConstitution.findFirst({ where: { status: "ratified" }, orderBy: { ratifiedAt: "desc" } });
  const constitutionArticles = constitution ? await db.constitutionArticle.findMany({ where: { constitutionId: constitution.constitutionId, status: "active" }, orderBy: { number: "asc" }, take: 10 }) : [];
  const recentCases = await db.courtCase.findMany({ orderBy: { filedAt: "desc" }, take: 5 });
  const recentProposals = await db.governanceProposal.findMany({ orderBy: { proposedAt: "desc" }, take: 5 });

  return {
    counts: { constitutions, articles, amendments, councils, members, proposals, courts, cases, verdicts, votes },
    active: { ratifiedConstitutions, activeCouncils, openProposals, openCases, ruledCases },
    constitution: constitution ? serializeConstitution(constitution) : null,
    constitutionArticles: constitutionArticles.map(serializeArticle),
    recentCases: recentCases.map(serializeCase),
    recentProposals: recentProposals.map(serializeProposal),
  };
}

// ===========================================================================
// SERIALIZERS
// ===========================================================================

function serializeConstitution(c: any) {
  return { id: c.id, constitutionId: c.constitutionId, version: c.version, title: c.title, preamble: c.preamble,
    status: c.status, ratifiedAt: c.ratifiedAt, articleCount: c.articleCount, amendmentCount: c.amendmentCount,
    createdAt: c.createdAt };
}

function serializeArticle(a: any) {
  return { id: a.id, articleId: a.articleId, constitutionId: a.constitutionId, number: a.number, title: a.title,
    body: a.body, category: a.category, governs: a.governs, enforcementMechanism: a.enforcementMechanism,
    status: a.status, ratifiedAt: a.ratifiedAt };
}

function serializeAmendment(a: any) {
  return { id: a.id, amendmentId: a.amendmentId, constitutionId: a.constitutionId, articleId: a.articleId,
    amendmentType: a.amendmentType, title: a.title, description: a.description, proposedText: a.proposedText,
    proposedBy: a.proposedBy, proposerName: a.proposerName,
    voteCount: a.voteCount, approveCount: a.approveCount, rejectCount: a.rejectCount,
    status: a.status, ratifiedAt: a.ratifiedAt, proposedAt: a.proposedAt };
}

function serializeCouncil(c: any) {
  return { id: c.id, councilId: c.councilId, name: c.name, description: c.description,
    councilType: c.councilType, scope: c.scope,
    memberCount: c.memberCount, seatCount: c.seatCount,
    quorumThreshold: c.quorumThreshold, approvalThreshold: c.approvalThreshold,
    status: c.status, establishedAt: c.establishedAt };
}

function serializeMember(m: any) {
  return { id: m.id, memberId: m.memberId, councilId: m.councilId,
    representativeName: m.representativeName, representativeId: m.representativeId,
    constituencyType: m.constituencyType, constituencyName: m.constituencyName,
    votingWeight: m.votingWeight, termStart: m.termStart, termEnd: m.termEnd,
    status: m.status, seatedAt: m.seatedAt };
}

function serializeVote(v: any) {
  return { id: v.id, voteId: v.voteId, councilId: v.councilId, memberId: v.memberId, memberName: v.memberName,
    proposalType: v.proposalType, proposalId: v.proposalId, proposalTitle: v.proposalTitle,
    vote: v.vote, rationale: v.rationale, votingWeight: v.votingWeight, votedAt: v.votedAt };
}

function serializeProposal(p: any) {
  return { id: p.id, proposalId: p.proposalId, councilId: p.councilId,
    proposedBy: p.proposedBy, proposerName: p.proposerName,
    proposalType: p.proposalType, title: p.title, description: p.description,
    details: JSON.parse(p.details || "{}"),
    voteCount: p.voteCount, approveCount: p.approveCount, rejectCount: p.rejectCount, abstainCount: p.abstainCount,
    weightedApprove: p.weightedApprove, weightedReject: p.weightedReject,
    status: p.status, enactedAt: p.enactedAt, proposedAt: p.proposedAt };
}

function serializeCourt(c: any) {
  return { id: c.id, courtId: c.courtId, name: c.name, description: c.description,
    jurisdiction: c.jurisdiction, scope: c.scope, justiceCount: c.justiceCount,
    status: c.status, establishedAt: c.establishedAt };
}

function serializeCase(c: any) {
  return { id: c.id, caseId: c.caseId, courtId: c.courtId,
    plaintiffId: c.plaintiffId, plaintiffName: c.plaintiffName, plaintiffType: c.plaintiffType,
    defendantId: c.defendantId, defendantName: c.defendantName, defendantType: c.defendantType,
    caseType: c.caseType, title: c.title, description: c.description,
    evidenceArtifacts: JSON.parse(c.evidenceArtifacts || "[]"),
    damagesClaimed: c.damagesClaimed,
    verdict: c.verdict, verdictSummary: c.verdictSummary, damagesAwarded: c.damagesAwarded,
    status: c.status, filedAt: c.filedAt, ruledAt: c.ruledAt, closedAt: c.closedAt };
}

function serializeVerdict(v: any) {
  return { id: v.id, verdictId: v.verdictId, caseId: v.caseId, courtId: v.courtId,
    ruling: v.ruling, summary: v.summary, reasoning: v.reasoning,
    remedies: JSON.parse(v.remedies || "[]"), damagesAwarded: v.damagesAwarded,
    justiceCount: v.justiceCount, concurringVotes: v.concurringVotes, dissentingVotes: v.dissentingVotes,
    ruledAt: v.ruledAt };
}
