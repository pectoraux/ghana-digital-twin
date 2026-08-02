// Ghana Digital Twin — Milestone 8: National Intelligence Command Center
// Package-layer operational engine. The kernel is FROZEN. This module consumes
// intelligence (observations, hypotheses, agent reasoning, arbitration) and turns
// it into operational state: incidents, workflows, decisions, actions, outcomes.
//
// The loop: Assessment → Decision → Workflow → Human Action → Outcome → Learning ↺
//
// NO kernel modifications. Uses existing: db, ImmutableArtifact, EventBus, Policy.

import { db } from "@/lib/db";
import { createImmutableArtifact } from "@/lib/kernel/engine";

// ===========================================================================
// TYPES
// ===========================================================================

export type IncidentStatus =
  | "detected" | "reviewed" | "assigned" | "investigated"
  | "resolved" | "closed" | "learned";

export type IncidentSeverity = "low" | "moderate" | "high" | "critical";
export type IncidentType =
  | "illegal_mining" | "flood_risk" | "deforestation"
  | "cocoa_disease" | "water_pollution" | "land_degradation";

export const INCIDENT_LIFECYCLE: IncidentStatus[] = [
  "detected", "reviewed", "assigned", "investigated", "resolved", "closed", "learned",
];

export interface IncidentInput {
  type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  summary: string;
  regionId?: string;
  location?: { lng: number; lat: number };
  areaAffectedHa?: number;
  evidence?: string[]; // observation IDs, scene IDs
  assessmentId?: string;
  confidence: number;
  agentsInvolved?: string[];
  arbitrationId?: string;
  createdBy?: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: "human_review" | "evidence_package" | "assign_inspector"
      | "field_verification" | "resolution" | "notify" | "drone_verification";
  requiredRole: string;
  sla?: string; // "24h"
  condition?: string; // optional gate
  description?: string;
}

export interface WorkflowDef {
  workflowId: string;
  name: string;
  description: string;
  triggerType: IncidentType;
  triggerCondition: { confidence?: string; severity?: IncidentSeverity[] };
  steps: WorkflowStep[];
  owningRole: string;
  packageId?: string;
  version?: string;
}

export interface DecisionInput {
  incidentId?: string;
  workflowExecutionId?: string;
  actorId: string;
  actorRole: string;
  decisionType: string;
  decision: string;
  rationale: string;
  basedOn: string[]; // assessment hashes, observation IDs, arbitration IDs
  permissionsUsed?: string[];
}

export interface OperationalActionInput {
  incidentId: string;
  decisionId?: string;
  actionType: string;
  description: string;
  assignedTo: string;
  assignedRole: string;
  scheduledAt?: string;
  cost?: number;
}

// ===========================================================================
// 1. INCIDENT MANAGEMENT
// ===========================================================================

let incidentCounter = 0;
async function nextIncidentId(type: IncidentType): Promise<string> {
  const prefix = INCIDENT_CODE_PREFIX[type] ?? "INC";
  const year = new Date().getFullYear();
  const count = await db.incidentArtifact.count({ where: { type } });
  incidentCounter = count + 1;
  return `GH-${prefix}-${year}-${String(incidentCounter).padStart(3, "0")}`;
}

const INCIDENT_CODE_PREFIX: Record<IncidentType, string> = {
  illegal_mining: "MIN",
  flood_risk: "FLD",
  deforestation: "FOR",
  cocoa_disease: "COC",
  water_pollution: "WAT",
  land_degradation: "LND",
};

export async function createIncident(input: IncidentInput): Promise<any> {
  const incidentId = await nextIncidentId(input.type);

  // Auto-select a workflow based on type
  const workflow = await db.operationalWorkflow.findFirst({
    where: { triggerType: input.type, active: true },
  });

  const incident = await db.incidentArtifact.create({
    data: {
      incidentId,
      type: input.type,
      severity: input.severity,
      title: input.title,
      summary: input.summary,
      regionId: input.regionId ?? null,
      location: JSON.stringify(input.location ?? {}),
      areaAffectedHa: input.areaAffectedHa ?? null,
      evidence: JSON.stringify(input.evidence ?? []),
      assessmentId: input.assessmentId ?? null,
      confidence: input.confidence,
      agentsInvolved: JSON.stringify(input.agentsInvolved ?? []),
      arbitrationId: input.arbitrationId ?? null,
      workflowId: workflow?.workflowId ?? null,
      status: "detected",
      detectedAt: new Date(),
      createdBy: input.createdBy ?? "system",
    },
  });

  // Create an immutable artifact recording the incident opening (provenance)
  const artifact = await createImmutableArtifact({
    kind: "incident_opened",
    content: {
      incidentId,
      type: input.type,
      severity: input.severity,
      title: input.title,
      confidence: input.confidence,
      evidence: input.evidence ?? [],
      assessmentId: input.assessmentId,
    },
    parentHashes: input.assessmentId ? [input.assessmentId] : [],
    createdBy: input.createdBy ?? "system",
    createdVia: "command_center",
    providerUsed: "national-command-center",
    providerReason: `Incident opened from ${input.assessmentId ? "assessment" : "agent detection"}`,
  });

  // Emit a situation event
  await emitSituationEvent({
    kind: "incident_opened",
    severity: input.severity === "critical" ? "crit" : input.severity === "high" ? "warn" : "info",
    title: `Incident ${incidentId} opened`,
    detail: input.title,
    regionId: input.regionId,
    incidentId,
    artifactHash: artifact.hash,
  });

  // If a workflow matched and the trigger condition is met, start it
  if (workflow && matchesTrigger(workflow, input)) {
    await startWorkflowExecution(workflow.workflowId, incidentId);
  }

  return serializeIncident(incident);
}

export async function listIncidents(filter: {
  status?: IncidentStatus;
  type?: IncidentType;
  severity?: IncidentSeverity;
  regionId?: string;
  limit?: number;
} = {}): Promise<any[]> {
  const where: any = {};
  if (filter.status) where.status = filter.status;
  if (filter.type) where.type = filter.type;
  if (filter.severity) where.severity = filter.severity;
  if (filter.regionId) where.regionId = filter.regionId;

  const rows = await db.incidentArtifact.findMany({
    where,
    orderBy: { detectedAt: "desc" },
    take: filter.limit ?? 100,
  });
  return rows.map(serializeIncident);
}

export async function getIncident(incidentId: string): Promise<any | null> {
  const row = await db.incidentArtifact.findUnique({ where: { incidentId } });
  return row ? serializeIncident(row) : null;
}

export async function transitionIncident(
  incidentId: string,
  toStatus: IncidentStatus,
  actor?: string,
  note?: string
): Promise<any> {
  const incident = await db.incidentArtifact.findUnique({ where: { incidentId } });
  if (!incident) throw new Error(`Incident ${incidentId} not found`);

  const now = new Date();
  const data: any = { status: toStatus, updatedAt: now };
  switch (toStatus) {
    case "reviewed": data.reviewedAt = now; break;
    case "assigned": data.assignedAt = now; break;
    case "investigated": data.investigatedAt = now; break;
    case "resolved": data.resolvedAt = now; data.resolution = note ?? data.resolution; break;
    case "closed": data.closedAt = now; break;
    case "learned": data.learnedAt = now; break;
  }

  const updated = await db.incidentArtifact.update({ where: { incidentId }, data });

  // Record transition as decision artifact if actor provided
  if (actor) {
    await createDecision({
      incidentId,
      actorId: actor,
      actorRole: "system",
      decisionType: `transition_${toStatus}`,
      decision: `Incident transitioned to ${toStatus}`,
      rationale: note ?? `Lifecycle transition to ${toStatus}`,
      basedOn: incident.assessmentId ? [incident.assessmentId] : [],
    });
  }

  await emitSituationEvent({
    kind: "incident_transition",
    severity: "info",
    title: `Incident ${incidentId} → ${toStatus}`,
    detail: note ?? `Transitioned to ${toStatus}`,
    incidentId,
  });

  return serializeIncident(updated);
}

export async function assignIncident(
  incidentId: string,
  assignedTo: string[],
  role: string
): Promise<any> {
  const updated = await db.incidentArtifact.update({
    where: { incidentId },
    data: {
      assignedTo: JSON.stringify(assignedTo),
      status: "assigned",
      assignedAt: new Date(),
    },
  });

  await emitSituationEvent({
    kind: "incident_assigned",
    severity: "info",
    title: `Incident ${incidentId} assigned to ${role}`,
    detail: `Assigned to: ${assignedTo.join(", ")}`,
    incidentId,
  });

  return serializeIncident(updated);
}

export async function resolveIncident(
  incidentId: string,
  outcome: string,
  resolution: string,
  actor: string
): Promise<any> {
  const updated = await db.incidentArtifact.update({
    where: { incidentId },
    data: {
      status: "resolved",
      outcome,
      resolution,
      resolvedAt: new Date(),
    },
  });

  await emitSituationEvent({
    kind: "incident_resolved",
    severity: "info",
    title: `Incident ${incidentId} resolved: ${outcome}`,
    detail: resolution,
    incidentId,
  });

  return serializeIncident(updated);
}

// ===========================================================================
// 2. WORKFLOW ENGINE (Human-in-the-Loop)
// ===========================================================================

function matchesTrigger(workflow: any, input: IncidentInput): boolean {
  try {
    const cond = typeof workflow.triggerCondition === "string"
      ? JSON.parse(workflow.triggerCondition) : workflow.triggerCondition;
    if (cond.severity && !cond.severity.includes(input.severity)) return false;
    if (cond.confidence) {
      // simple ">0.85" parsing
      const m = String(cond.confidence).match(/(>=|>|<=|<)([\d.]+)/);
      if (m) {
        const op = m[1]; const val = parseFloat(m[2]);
        if (op === ">" && !(input.confidence > val)) return false;
        if (op === ">=" && !(input.confidence >= val)) return false;
        if (op === "<" && !(input.confidence < val)) return false;
        if (op === "<=" && !(input.confidence <= val)) return false;
      }
    }
    return true;
  } catch {
    return true;
  }
}

export async function registerWorkflow(def: WorkflowDef): Promise<any> {
  const row = await db.operationalWorkflow.upsert({
    where: { workflowId: def.workflowId },
    update: {
      name: def.name,
      description: def.description,
      triggerType: def.triggerType,
      triggerCondition: JSON.stringify(def.triggerCondition),
      steps: JSON.stringify(def.steps),
      owningRole: def.owningRole,
      packageId: def.packageId ?? "national-command-center",
      version: def.version ?? "1.0.0",
      active: true,
    },
    create: {
      workflowId: def.workflowId,
      name: def.name,
      description: def.description,
      triggerType: def.triggerType,
      triggerCondition: JSON.stringify(def.triggerCondition),
      steps: JSON.stringify(def.steps),
      owningRole: def.owningRole,
      packageId: def.packageId ?? "national-command-center",
      version: def.version ?? "1.0.0",
      active: true,
    },
  });
  return serializeWorkflow(row);
}

export async function listWorkflows(): Promise<any[]> {
  const rows = await db.operationalWorkflow.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  return rows.map(serializeWorkflow);
}

export async function startWorkflowExecution(workflowId: string, incidentId: string): Promise<any> {
  const workflow = await db.operationalWorkflow.findUnique({ where: { workflowId } });
  if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

  const steps = JSON.parse(workflow.steps || "[]") as WorkflowStep[];
  const executionId = `WFE-${Date.now().toString(36).toUpperCase()}`;

  const stepStates = steps.map((s, i) => ({
    stepId: s.id,
    stepName: s.name,
    stepType: s.type,
    requiredRole: s.requiredRole,
    sla: s.sla ?? null,
    status: i === 0 ? "active" : "pending",
    actor: null,
    startedAt: i === 0 ? new Date().toISOString() : null,
    completedAt: null,
    decision: null,
    artifactHash: null,
  }));

  const execution = await db.workflowExecution.create({
    data: {
      executionId,
      workflowId,
      incidentId,
      currentStep: 0,
      stepStates: JSON.stringify(stepStates),
      status: "running",
    },
  });

  await db.incidentArtifact.update({
    where: { incidentId },
    data: { workflowId, workflowExecutionId: executionId },
  });

  await emitSituationEvent({
    kind: "workflow_started",
    severity: "info",
    title: `Workflow ${workflow.name} started`,
    detail: `For incident ${incidentId} · ${steps.length} steps`,
    incidentId,
  });

  return serializeExecution(execution, steps);
}

export async function listExecutions(incidentId?: string): Promise<any[]> {
  const where: any = {};
  if (incidentId) where.incidentId = incidentId;
  const rows = await db.workflowExecution.findMany({ where, orderBy: { startedAt: "desc" } });
  const out: any[] = [];
  for (const row of rows) {
    const wf = await db.operationalWorkflow.findUnique({ where: { workflowId: row.workflowId } });
    const steps = wf ? (JSON.parse(wf.steps || "[]") as WorkflowStep[]) : [];
    out.push(serializeExecution(row, steps));
  }
  return out;
}

export async function getExecution(executionId: string): Promise<any | null> {
  const row = await db.workflowExecution.findUnique({ where: { executionId } });
  if (!row) return null;
  const wf = await db.operationalWorkflow.findUnique({ where: { workflowId: row.workflowId } });
  const steps = wf ? (JSON.parse(wf.steps || "[]") as WorkflowStep[]) : [];
  return serializeExecution(row, steps);
}

export async function advanceWorkflowStep(
  executionId: string,
  actor: string,
  decision: string,
  artifactHash?: string,
  skip?: boolean
): Promise<any> {
  const exec = await db.workflowExecution.findUnique({ where: { executionId } });
  if (!exec) throw new Error(`Execution ${executionId} not found`);
  if (exec.status !== "running") throw new Error(`Execution ${executionId} is ${exec.status}`);

  const wf = await db.operationalWorkflow.findUnique({ where: { workflowId: exec.workflowId } });
  const steps = wf ? (JSON.parse(wf.steps || "[]") as WorkflowStep[]) : [];
  const stepStates = JSON.parse(exec.stepStates || "[]") as any[];

  const currentIdx = exec.currentStep;
  if (currentIdx >= stepStates.length) throw new Error("Workflow already complete");

  const now = new Date().toISOString();
  stepStates[currentIdx].status = skip ? "skipped" : "completed";
  stepStates[currentIdx].actor = actor;
  stepStates[currentIdx].completedAt = now;
  stepStates[currentIdx].decision = decision;
  stepStates[currentIdx].artifactHash = artifactHash ?? null;

  const nextIdx = currentIdx + 1;
  const isComplete = nextIdx >= stepStates.length;

  if (!isComplete) {
    stepStates[nextIdx].status = "active";
    stepStates[nextIdx].startedAt = now;
  }

  const updated = await db.workflowExecution.update({
    where: { executionId },
    data: {
      currentStep: isComplete ? currentIdx : nextIdx,
      stepStates: JSON.stringify(stepStates),
      status: isComplete ? "completed" : "running",
      completedAt: isComplete ? new Date() : null,
    },
  });

  // Record the decision
  await createDecision({
    incidentId: exec.incidentId,
    workflowExecutionId: executionId,
    actorId: actor,
    actorRole: steps[currentIdx]?.requiredRole ?? "operator",
    decisionType: skip ? "skip_step" : "complete_step",
    decision: `${skip ? "Skipped" : "Completed"} step: ${steps[currentIdx]?.name ?? currentIdx}`,
    rationale: decision,
    basedOn: [],
  });

  if (isComplete) {
    await emitSituationEvent({
      kind: "workflow_completed",
      severity: "info",
      title: `Workflow ${wf?.name ?? exec.workflowId} completed`,
      detail: `For incident ${exec.incidentId}`,
      incidentId: exec.incidentId,
    });
  }

  return serializeExecution(updated, steps);
}

// ===========================================================================
// 3. DECISION ARTIFACTS (Human Decisions = Immutable Provenance)
// ===========================================================================

let decisionCounter = 0;
async function nextDecisionId(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.decisionArtifact.count();
  decisionCounter = count + 1;
  return `DEC-${year}-${String(decisionCounter).padStart(4, "0")}`;
}

export async function createDecision(input: DecisionInput): Promise<any> {
  const decisionId = await nextDecisionId();

  // Authority check: does the actor's role permit this decision type?
  const role = await db.institutionalRole.findUnique({ where: { roleId: input.actorRole } });
  const permissions = role ? (JSON.parse(role.permissions || "[]") as any[]) : [];
  const policyChecked = role ? permissions.some((p) =>
    input.decisionType.startsWith(p.id) || p.id === "*" || (p.scope && input.decisionType.includes(p.scope))
  ) : true; // if no role registered, allow (system decisions)

  const decision = await db.decisionArtifact.create({
    data: {
      decisionId,
      incidentId: input.incidentId ?? null,
      workflowExecutionId: input.workflowExecutionId ?? null,
      actorId: input.actorId,
      actorRole: input.actorRole,
      decisionType: input.decisionType,
      decision: input.decision,
      rationale: input.rationale,
      basedOn: JSON.stringify(input.basedOn),
      permissionsUsed: JSON.stringify(input.permissionsUsed ?? permissions.map((p) => p.id)),
      policyChecked,
    },
  });

  // Decisions are immutable artifacts — full reproducibility
  const artifact = await createImmutableArtifact({
    kind: "decision",
    content: {
      decisionId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      decisionType: input.decisionType,
      decision: input.decision,
      rationale: input.rationale,
      basedOn: input.basedOn,
      incidentId: input.incidentId,
    },
    parentHashes: input.basedOn,
    createdBy: `user:${input.actorId}`,
    createdVia: "human_decision",
    providerUsed: "national-command-center",
    providerReason: `Human decision by ${input.actorRole}`,
  });

  await emitSituationEvent({
    kind: "decision_made",
    severity: "info",
    title: `Decision: ${input.decision}`,
    detail: `By ${input.actorRole} (${input.actorId})`,
    incidentId: input.incidentId,
    artifactHash: artifact.hash,
  });

  return { ...serializeDecision(decision), artifactHash: artifact.hash };
}

export async function listDecisions(filter: { incidentId?: string; actorId?: string; limit?: number } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.incidentId) where.incidentId = filter.incidentId;
  if (filter.actorId) where.actorId = filter.actorId;
  const rows = await db.decisionArtifact.findMany({ where, orderBy: { decidedAt: "desc" }, take: filter.limit ?? 100 });
  return rows.map(serializeDecision);
}

// ===========================================================================
// 4. INSTITUTIONAL ROLES (Governance Package)
// ===========================================================================

export interface RoleDef {
  roleId: string;
  name: string;
  description: string;
  institution: string;
  permissions: { id: string; name: string; scope: string }[];
  maxSeverity?: IncidentSeverity;
  canEscalate?: boolean;
  requiresApproval?: string[];
  packageId?: string;
}

export async function registerRole(def: RoleDef): Promise<any> {
  const row = await db.institutionalRole.upsert({
    where: { roleId: def.roleId },
    update: {
      name: def.name,
      description: def.description,
      institution: def.institution,
      permissions: JSON.stringify(def.permissions),
      maxSeverity: def.maxSeverity ?? "critical",
      canEscalate: def.canEscalate ?? true,
      requiresApproval: JSON.stringify(def.requiresApproval ?? []),
      packageId: def.packageId ?? "institutional-roles",
      active: true,
    },
    create: {
      roleId: def.roleId,
      name: def.name,
      description: def.description,
      institution: def.institution,
      permissions: JSON.stringify(def.permissions),
      maxSeverity: def.maxSeverity ?? "critical",
      canEscalate: def.canEscalate ?? true,
      requiresApproval: JSON.stringify(def.requiresApproval ?? []),
      packageId: def.packageId ?? "institutional-roles",
      active: true,
    },
  });
  return serializeRole(row);
}

export async function listRoles(): Promise<any[]> {
  const rows = await db.institutionalRole.findMany({ where: { active: true }, orderBy: { institution: "asc" } });
  return rows.map(serializeRole);
}

export async function checkPermission(roleId: string, decisionType: string): Promise<{ allowed: boolean; reason: string }> {
  const role = await db.institutionalRole.findUnique({ where: { roleId } });
  if (!role) return { allowed: false, reason: `Role ${roleId} not registered` };
  if (!role.active) return { allowed: false, reason: `Role ${roleId} inactive` };
  const permissions = JSON.parse(role.permissions || "[]") as any[];
  const matched = permissions.some((p) =>
    decisionType.startsWith(p.id) || p.id === "*" || (p.scope && decisionType.includes(p.scope))
  );
  if (!matched) return { allowed: false, reason: `Role ${roleId} lacks permission for ${decisionType}` };
  const needsApproval = (JSON.parse(role.requiresApproval || "[]") as string[]).includes(decisionType);
  return { allowed: true, reason: needsApproval ? `Allowed but requires supervisor approval` : `Allowed by ${role.name}` };
}

// ===========================================================================
// 5. OPERATIONAL ACTIONS & OUTCOMES
// ===========================================================================

let actionCounter = 0;
async function nextActionId(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.operationalAction.count();
  actionCounter = count + 1;
  return `ACT-${year}-${String(actionCounter).padStart(4, "0")}`;
}

export async function createAction(input: OperationalActionInput): Promise<any> {
  const actionId = await nextActionId();
  const action = await db.operationalAction.create({
    data: {
      actionId,
      incidentId: input.incidentId,
      decisionId: input.decisionId ?? null,
      actionType: input.actionType,
      description: input.description,
      assignedTo: input.assignedTo,
      assignedRole: input.assignedRole,
      status: "dispatched",
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      dispatchedAt: new Date(),
      cost: input.cost ?? 0,
    },
  });

  // Link action to the authoring decision
  if (input.decisionId) {
    const decision = await db.decisionArtifact.findUnique({ where: { decisionId: input.decisionId } });
    if (decision) {
      const actionIds = JSON.parse(decision.actionIds || "[]") as string[];
      actionIds.push(actionId);
      await db.decisionArtifact.update({ where: { decisionId: input.decisionId }, data: { actionIds: JSON.stringify(actionIds) } });
    }
  }

  await emitSituationEvent({
    kind: "action_dispatched",
    severity: "warn",
    title: `Action dispatched: ${input.actionType}`,
    detail: `${input.description} → ${input.assignedTo}`,
    incidentId: input.incidentId,
  });

  return serializeAction(action);
}

export async function listActions(filter: { incidentId?: string; status?: string } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.incidentId) where.incidentId = filter.incidentId;
  if (filter.status) where.status = filter.status;
  const rows = await db.operationalAction.findMany({ where, orderBy: { dispatchedAt: "desc" } });
  return rows.map(serializeAction);
}

export async function completeAction(actionId: string, result: string, evidenceCollected: string[] = [], cost?: number): Promise<any> {
  const updated = await db.operationalAction.update({
    where: { actionId },
    data: {
      status: "completed",
      completedAt: new Date(),
      result,
      evidenceCollected: JSON.stringify(evidenceCollected),
      ...(cost !== undefined ? { cost } : {}),
    },
  });

  await emitSituationEvent({
    kind: "action_completed",
    severity: "info",
    title: `Action ${actionId} completed`,
    detail: result,
    incidentId: updated.incidentId,
  });

  return serializeAction(updated);
}

// ===========================================================================
// 6. OUTCOME REPORTS (→ Learning Loop)
// ===========================================================================

let outcomeCounter = 0;
async function nextOutcomeId(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.outcomeReport.count();
  outcomeCounter = count + 1;
  return `OUT-${year}-${String(outcomeCounter).padStart(4, "0")}`;
}

export async function recordOutcome(input: {
  incidentId: string;
  result: string;
  groundTruth?: boolean;
  summary: string;
  fieldFindings?: Record<string, any>;
  timeToResolveH?: number;
  totalCost?: number;
}): Promise<any> {
  const outcomeId = await nextOutcomeId();

  // Determine ground truth from result
  const groundTruth = input.groundTruth ?? (input.result === "confirmed");

  const outcome = await db.outcomeReport.create({
    data: {
      outcomeId,
      incidentId: input.incidentId,
      result: input.result,
      groundTruth,
      summary: input.summary,
      fieldFindings: JSON.stringify(input.fieldFindings ?? {}),
      timeToResolveH: input.timeToResolveH ?? null,
      totalCost: input.totalCost ?? 0,
    },
  });

  // Close the learning loop: create a feedback artifact for the Learning Agent
  const incident = await db.incidentArtifact.findUnique({ where: { incidentId: input.incidentId } });
  const feedbackArtifact = await createImmutableArtifact({
    kind: "outcome_feedback",
    content: {
      outcomeId,
      incidentId: input.incidentId,
      incidentType: incident?.type,
      originalConfidence: incident?.confidence,
      groundTruth,
      result: input.result,
      timeToResolveH: input.timeToResolveH,
      totalCost: input.totalCost,
      summary: input.summary,
    },
    parentHashes: incident?.assessmentId ? [incident.assessmentId] : [],
    createdBy: "command-center",
    createdVia: "outcome_report",
    providerUsed: "national-command-center",
    providerReason: "Outcome feedback to close the learning loop",
  });

  await db.outcomeReport.update({
    where: { outcomeId },
    data: { feedbackSent: true, feedbackArtifact: feedbackArtifact.hash },
  });

  // Transition incident to learned
  if (incident) {
    await db.incidentArtifact.update({
      where: { incidentId: input.incidentId },
      data: {
        status: "learned",
        learnedAt: new Date(),
        outcome: input.result,
        learningFeedback: feedbackArtifact.hash,
      },
    });
  }

  await emitSituationEvent({
    kind: "outcome_reported",
    severity: "info",
    title: `Outcome: ${input.result}`,
    detail: `${input.incidentId} · ground truth: ${groundTruth ? "confirmed" : "false positive"} · feedback → learning`,
    incidentId: input.incidentId,
    artifactHash: feedbackArtifact.hash,
  });

  return serializeOutcome(outcome, feedbackArtifact.hash);
}

export async function listOutcomes(incidentId?: string): Promise<any[]> {
  const where: any = {};
  if (incidentId) where.incidentId = incidentId;
  const rows = await db.outcomeReport.findMany({ where, orderBy: { reportedAt: "desc" } });
  return rows.map((r) => serializeOutcome(r, r.feedbackArtifact));
}

// ===========================================================================
// 7. SITUATION ROOM (Live Event Stream)
// ===========================================================================

export async function emitSituationEvent(input: {
  kind: string;
  severity: "info" | "warn" | "crit";
  title: string;
  detail: string;
  regionId?: string;
  incidentId?: string;
  agentId?: string;
  artifactHash?: string;
  occurredAt?: Date;
}): Promise<any> {
  const eventId = `EVT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const row = await db.situationEvent.create({
    data: {
      eventId,
      kind: input.kind,
      severity: input.severity,
      title: input.title,
      detail: input.detail,
      regionId: input.regionId ?? null,
      incidentId: input.incidentId ?? null,
      agentId: input.agentId ?? null,
      artifactHash: input.artifactHash ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    },
  });
  return serializeEvent(row);
}

export async function listSituationEvents(filter: { limit?: number; kind?: string; severity?: string } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.kind) where.kind = filter.kind;
  if (filter.severity) where.severity = filter.severity;
  const rows = await db.situationEvent.findMany({
    where,
    orderBy: { occurredAt: "desc" },
    take: filter.limit ?? 80,
  });
  return rows.map(serializeEvent);
}

// ===========================================================================
// 8. NATIONAL OVERVIEW DASHBOARD
// ===========================================================================

export async function getNationalOverview(): Promise<any> {
  const incidents = await db.incidentArtifact.findMany();
  const active = incidents.filter((i) => !["closed", "learned"].includes(i.status));
  const highConfidence = incidents.filter((i) => i.confidence >= 0.85 && !["closed", "learned"].includes(i.status));

  // by region
  const byRegion: Record<string, number> = {};
  for (const i of active) {
    const r = i.regionId ?? "unknown";
    byRegion[r] = (byRegion[r] ?? 0) + 1;
  }

  // by type
  const byType: Record<string, number> = {};
  for (const i of active) byType[i.type] = (byType[i.type] ?? 0) + 1;

  // by status
  const byStatus: Record<string, number> = {};
  for (const i of incidents) byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;

  // by severity (active only)
  const bySeverity: Record<string, number> = {};
  for (const i of active) bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;

  // environmental risk level
  const critCount = active.filter((i) => i.severity === "critical").length;
  const highCount = active.filter((i) => i.severity === "high").length;
  const envRisk = critCount > 3 ? "critical" : critCount > 0 || highCount > 5 ? "high" : highCount > 0 ? "medium" : "low";

  // decisions & actions
  const decisionCount = await db.decisionArtifact.count();
  const actionCount = await db.operationalAction.count();
  const completedActions = await db.operationalAction.count({ where: { status: "completed" } });
  const outcomeCount = await db.outcomeReport.count();
  const confirmedCount = await db.outcomeReport.count({ where: { groundTruth: true } });
  const falsePositiveCount = await db.outcomeReport.count({ where: { groundTruth: false } });

  const accuracy = outcomeCount > 0 ? confirmedCount / outcomeCount : null;

  // recent situation events
  const recentEvents = await db.situationEvent.findMany({ orderBy: { occurredAt: "desc" }, take: 8 });

  return {
    incidents: {
      total: incidents.length,
      active: active.length,
      highConfidence: highConfidence.length,
      byRegion,
      byType,
      byStatus,
      bySeverity,
    },
    operations: {
      decisions: decisionCount,
      actions: actionCount,
      actionsCompleted: completedActions,
      outcomes: outcomeCount,
      confirmed: confirmedCount,
      falsePositives: falsePositiveCount,
      accuracy,
    },
    environmentalRisk: envRisk,
    recentEvents: recentEvents.map(serializeEvent),
  };
}

// ===========================================================================
// 9. COMMAND CENTER PACKAGE MANIFEST
// ===========================================================================

export async function registerCommandCenterPackage(): Promise<any> {
  const row = await db.commandCenterPackage.upsert({
    where: { packageId: "national-command-center" },
    update: {
      name: "National Intelligence Command Center",
      version: "1.0.0",
      requires: JSON.stringify([
        "capability:intelligence.assessment",
        "capability:alert.management",
        "capability:workflow.execution",
        "capability:report.generation",
      ]),
      provides: JSON.stringify([
        "dashboard.command",
        "workflow.operational",
        "reporting.executive",
        "incident.management",
        "evidence.room",
      ]),
      subPackages: JSON.stringify([
        "incident-management",
        "workflow-engine",
        "evidence-room",
        "institutional-roles",
        "situation-room",
        "decision-provenance",
        "outcome-learning",
      ]),
      active: true,
    },
    create: {
      packageId: "national-command-center",
      name: "National Intelligence Command Center",
      version: "1.0.0",
      requires: JSON.stringify([
        "capability:intelligence.assessment",
        "capability:alert.management",
        "capability:workflow.execution",
        "capability:report.generation",
      ]),
      provides: JSON.stringify([
        "dashboard.command",
        "workflow.operational",
        "reporting.executive",
        "incident.management",
        "evidence.room",
      ]),
      subPackages: JSON.stringify([
        "incident-management",
        "workflow-engine",
        "evidence-room",
        "institutional-roles",
        "situation-room",
        "decision-provenance",
        "outcome-learning",
      ]),
      active: true,
    },
  });
  return {
    packageId: row.packageId,
    name: row.name,
    version: row.version,
    requires: JSON.parse(row.requires || "[]"),
    provides: JSON.parse(row.provides || "[]"),
    subPackages: JSON.parse(row.subPackages || "[]"),
    active: row.active,
    installedAt: row.installedAt,
  };
}

export async function getCommandCenterPackage(): Promise<any | null> {
  const row = await db.commandCenterPackage.findUnique({ where: { packageId: "national-command-center" } });
  if (!row) return null;
  return {
    packageId: row.packageId,
    name: row.name,
    version: row.version,
    requires: JSON.parse(row.requires || "[]"),
    provides: JSON.parse(row.provides || "[]"),
    subPackages: JSON.parse(row.subPackages || "[]"),
    active: row.active,
    installedAt: row.installedAt,
  };
}

// ===========================================================================
// SERIALIZERS
// ===========================================================================

function serializeIncident(r: any) {
  return {
    id: r.id,
    incidentId: r.incidentId,
    type: r.type,
    severity: r.severity,
    title: r.title,
    summary: r.summary,
    regionId: r.regionId,
    location: JSON.parse(r.location || "{}"),
    areaAffectedHa: r.areaAffectedHa,
    evidence: JSON.parse(r.evidence || "[]"),
    assessmentId: r.assessmentId,
    confidence: r.confidence,
    agentsInvolved: JSON.parse(r.agentsInvolved || "[]"),
    arbitrationId: r.arbitrationId,
    assignedTo: JSON.parse(r.assignedTo || "[]"),
    workflowId: r.workflowId,
    workflowExecutionId: r.workflowExecutionId,
    resolution: r.resolution,
    outcome: r.outcome,
    learningFeedback: r.learningFeedback,
    status: r.status,
    detectedAt: r.detectedAt,
    reviewedAt: r.reviewedAt,
    assignedAt: r.assignedAt,
    investigatedAt: r.investigatedAt,
    resolvedAt: r.resolvedAt,
    closedAt: r.closedAt,
    learnedAt: r.learnedAt,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function serializeWorkflow(r: any) {
  return {
    id: r.id,
    workflowId: r.workflowId,
    name: r.name,
    description: r.description,
    triggerType: r.triggerType,
    triggerCondition: JSON.parse(r.triggerCondition || "{}"),
    steps: JSON.parse(r.steps || "[]"),
    owningRole: r.owningRole,
    packageId: r.packageId,
    version: r.version,
    active: r.active,
  };
}

function serializeExecution(r: any, steps: WorkflowStep[]) {
  return {
    id: r.id,
    executionId: r.executionId,
    workflowId: r.workflowId,
    incidentId: r.incidentId,
    currentStep: r.currentStep,
    stepStates: JSON.parse(r.stepStates || "[]"),
    steps,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    status: r.status,
    abortReason: r.abortReason,
  };
}

function serializeDecision(r: any) {
  return {
    id: r.id,
    decisionId: r.decisionId,
    incidentId: r.incidentId,
    workflowExecutionId: r.workflowExecutionId,
    actorId: r.actorId,
    actorRole: r.actorRole,
    decisionType: r.decisionType,
    decision: r.decision,
    rationale: r.rationale,
    basedOn: JSON.parse(r.basedOn || "[]"),
    permissionsUsed: JSON.parse(r.permissionsUsed || "[]"),
    policyChecked: r.policyChecked,
    actionIds: JSON.parse(r.actionIds || "[]"),
    decidedAt: r.decidedAt,
  };
}

function serializeRole(r: any) {
  return {
    id: r.id,
    roleId: r.roleId,
    name: r.name,
    description: r.description,
    institution: r.institution,
    permissions: JSON.parse(r.permissions || "[]"),
    maxSeverity: r.maxSeverity,
    canEscalate: r.canEscalate,
    requiresApproval: JSON.parse(r.requiresApproval || "[]"),
    packageId: r.packageId,
    active: r.active,
  };
}

function serializeAction(r: any) {
  return {
    id: r.id,
    actionId: r.actionId,
    incidentId: r.incidentId,
    decisionId: r.decisionId,
    actionType: r.actionType,
    description: r.description,
    assignedTo: r.assignedTo,
    assignedRole: r.assignedRole,
    status: r.status,
    scheduledAt: r.scheduledAt,
    dispatchedAt: r.dispatchedAt,
    completedAt: r.completedAt,
    result: r.result,
    evidenceCollected: JSON.parse(r.evidenceCollected || "[]"),
    cost: r.cost,
  };
}

function serializeOutcome(r: any, feedbackHash: string | null) {
  return {
    id: r.id,
    outcomeId: r.outcomeId,
    incidentId: r.incidentId,
    result: r.result,
    groundTruth: r.groundTruth,
    summary: r.summary,
    fieldFindings: JSON.parse(r.fieldFindings || "{}"),
    timeToResolveH: r.timeToResolveH,
    totalCost: r.totalCost,
    feedbackSent: r.feedbackSent,
    feedbackArtifact: feedbackHash ?? r.feedbackArtifact,
    reportedAt: r.reportedAt,
  };
}

function serializeEvent(r: any) {
  return {
    id: r.id,
    eventId: r.eventId,
    kind: r.kind,
    severity: r.severity,
    title: r.title,
    detail: r.detail,
    regionId: r.regionId,
    incidentId: r.incidentId,
    agentId: r.agentId,
    artifactHash: r.artifactHash,
    occurredAt: r.occurredAt,
  };
}
