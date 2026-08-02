// Ghana Digital Twin — Milestone 8: Command Center Seeding
// Registers the command center package, operational workflows, institutional
// roles, and creates real incidents from existing intelligence (observations +
// hypotheses + agents). NO kernel modifications.

import { db } from "@/lib/db";
import {
  registerCommandCenterPackage,
  registerWorkflow,
  registerRole,
  createIncident,
  emitSituationEvent,
  transitionIncident,
  assignIncident,
  createDecision,
  createAction,
  completeAction,
  recordOutcome,
  type WorkflowDef,
  type RoleDef,
} from "./engine";

let SEEDED = false;

export async function seedCommandCenter(): Promise<{ package: any; workflows: number; roles: number; incidents: number }> {
  if (SEEDED) {
    // Return quick summary if already seeded this process
    const pkg = await registerCommandCenterPackage();
    return { package: pkg, workflows: 0, roles: 0, incidents: 0 };
  }

  // 1. Register the command center package
  const pkg = await registerCommandCenterPackage();

  // 2. Register workflows (only if none exist yet)
  const existingWf = await db.operationalWorkflow.count();
  if (existingWf === 0) {
    for (const wf of WORKFLOW_DEFS) await registerWorkflow(wf);
  }

  // 3. Register institutional roles (only if none exist yet)
  const existingRoles = await db.institutionalRole.count();
  if (existingRoles === 0) {
    for (const role of ROLE_DEFS) await registerRole(role);
  }

  // 4. Create incidents from existing intelligence (only if none exist yet)
  const existingIncidents = await db.incidentArtifact.count();
  if (existingIncidents === 0) {
    await createIncidentsFromIntelligence();
  }

  SEEDED = true;

  return {
    package: pkg,
    workflows: WORKFLOW_DEFS.length,
    roles: ROLE_DEFS.length,
    incidents: 5,
  };
}

// ===========================================================================
// WORKFLOW DEFINITIONS — declarative human-in-the-loop processes
// ===========================================================================

const WORKFLOW_DEFS: WorkflowDef[] = [
  {
    workflowId: "environmental-enforcement",
    name: "Environmental Enforcement Workflow",
    description: "Illegal mining / pollution enforcement: review → evidence package → inspector → field verification → resolution",
    triggerType: "illegal_mining",
    triggerCondition: { confidence: ">0.7", severity: ["high", "critical"] },
    owningRole: "environmental_regulator",
    steps: [
      { id: "s1", name: "Human Review of Assessment", type: "human_review", requiredRole: "environmental_regulator", sla: "4h", description: "EPA officer reviews the fused intelligence assessment" },
      { id: "s2", name: "Evidence Package Generation", type: "evidence_package", requiredRole: "intelligence_analyst", sla: "2h", description: "Assemble the legal-style evidence file (Evidence Room)" },
      { id: "s3", name: "Inspector Assignment", type: "assign_inspector", requiredRole: "environmental_regulator", sla: "12h", description: "Assign a field inspector from the nearest district office" },
      { id: "s4", name: "Field Verification", type: "field_verification", requiredRole: "field_inspector", sla: "72h", description: "On-site verification — collect photographic + GPS evidence" },
      { id: "s5", name: "Resolution & Enforcement Notice", type: "resolution", requiredRole: "environmental_regulator", sla: "48h", description: "Issue enforcement notice or close as false positive" },
      { id: "s6", name: "Notify Stakeholders", type: "notify", requiredRole: "environmental_regulator", sla: "24h", description: "Notify Ministry, local assembly, and affected communities" },
    ],
  },
  {
    workflowId: "flood-response",
    name: "Flood Response Coordination",
    description: "Flood risk → alert → coordinate evacuation/response → recovery",
    triggerType: "flood_risk",
    triggerCondition: { confidence: ">0.6", severity: ["high", "critical"] },
    owningRole: "disaster_manager",
    steps: [
      { id: "s1", name: "Situation Assessment", type: "human_review", requiredRole: "disaster_manager", sla: "1h", description: "NADMO officer assesses flood severity & population at risk" },
      { id: "s2", name: "Declare Alert", type: "notify", requiredRole: "disaster_manager", sla: "1h", description: "Issue official flood alert to downstream communities" },
      { id: "s3", name: "Coordinate Response", type: "assign_inspector", requiredRole: "disaster_manager", sla: "6h", description: "Dispatch response teams + equipment" },
      { id: "s4", name: "Field Verification", type: "field_verification", requiredRole: "field_inspector", sla: "24h", description: "Verify flood extent & impact on the ground" },
      { id: "s5", name: "Recovery & Reporting", type: "resolution", requiredRole: "disaster_manager", sla: "168h", description: "Recovery coordination + damage assessment report" },
    ],
  },
  {
    workflowId: "deforestation-investigation",
    name: "Deforestation Investigation",
    description: "Forest loss detection → Forestry Commission review → patrol dispatch → resolution",
    triggerType: "deforestation",
    triggerCondition: { confidence: ">0.65", severity: ["moderate", "high", "critical"] },
    owningRole: "forestry_officer",
    steps: [
      { id: "s1", name: "Review Satellite Evidence", type: "human_review", requiredRole: "forestry_officer", sla: "8h", description: "Forestry Commission reviews the canopy-loss evidence" },
      { id: "s2", name: "Cross-check Reserve Boundaries", type: "evidence_package", requiredRole: "intelligence_analyst", sla: "4h", description: "Verify if loss is within a protected forest reserve" },
      { id: "s3", name: "Dispatch Patrol", type: "assign_inspector", requiredRole: "forestry_officer", sla: "24h", description: "Dispatch forest patrol to investigate" },
      { id: "s4", name: "Field Patrol Report", type: "field_verification", requiredRole: "field_inspector", sla: "96h", description: "Patrol confirms extent + identifies cause (logging/farming/fire)" },
      { id: "s5", name: "Enforcement & Restoration", type: "resolution", requiredRole: "forestry_officer", sla: "168h", description: "Issue enforcement + plan restoration" },
    ],
  },
  {
    workflowId: "cocoa-disease-response",
    name: "Cocoa Disease Response",
    description: "Cocoa disease detection → COCOBOD review → extension officer dispatch → treatment",
    triggerType: "cocoa_disease",
    triggerCondition: { confidence: ">0.6", severity: ["moderate", "high", "critical"] },
    owningRole: "cocoa_extension_officer",
    steps: [
      { id: "s1", name: "Review Disease Detection", type: "human_review", requiredRole: "cocoa_extension_officer", sla: "12h", description: "COCOBOD reviews spectral disease signature" },
      { id: "s2", name: "Extension Officer Dispatch", type: "assign_inspector", requiredRole: "cocoa_extension_officer", sla: "48h", description: "Dispatch extension officer to confirm diagnosis" },
      { id: "s3", name: "Field Diagnosis", type: "field_verification", requiredRole: "field_inspector", sla: "72h", description: "Confirm disease + identify pathogen strain" },
      { id: "s4", name: "Treatment Plan", type: "resolution", requiredRole: "cocoa_extension_officer", sla: "48h", description: "Issue treatment recommendation to farmers" },
    ],
  },
];

// ===========================================================================
// INSTITUTIONAL ROLES — governance packages, not hardcoded users
// ===========================================================================

const ROLE_DEFS: RoleDef[] = [
  {
    roleId: "environmental_regulator",
    name: "Environmental Regulator",
    description: "EPA officer responsible for reviewing environmental incidents and authorizing enforcement",
    institution: "EPA",
    permissions: [
      { id: "review_incident", name: "Review Incident", scope: "review" },
      { id: "approve_field_inspection", name: "Approve Field Inspection", scope: "approve" },
      { id: "dispatch_inspector", name: "Dispatch Inspector", scope: "dispatch" },
      { id: "issue_notice", name: "Issue Enforcement Notice", scope: "issue" },
      { id: "close_incident", name: "Close Incident", scope: "close" },
      { id: "publish_report", name: "Publish Report", scope: "publish" },
      { id: "transition_", name: "Transition Lifecycle", scope: "transition" },
      { id: "complete_step", name: "Complete Workflow Step", scope: "step" },
    ],
    maxSeverity: "critical",
    canEscalate: true,
    requiresApproval: ["issue_notice"],
  },
  {
    roleId: "disaster_manager",
    name: "Disaster Manager",
    description: "NADMO officer responsible for disaster risk coordination and emergency response",
    institution: "NADMO",
    permissions: [
      { id: "review_incident", name: "Review Incident", scope: "review" },
      { id: "declare_alert", name: "Declare Alert", scope: "declare" },
      { id: "coordinate_response", name: "Coordinate Response", scope: "coordinate" },
      { id: "dispatch_inspector", name: "Dispatch Team", scope: "dispatch" },
      { id: "close_incident", name: "Close Incident", scope: "close" },
      { id: "publish_report", name: "Publish Report", scope: "publish" },
      { id: "transition_", name: "Transition Lifecycle", scope: "transition" },
      { id: "complete_step", name: "Complete Workflow Step", scope: "step" },
    ],
    maxSeverity: "critical",
    canEscalate: true,
    requiresApproval: ["declare_alert"],
  },
  {
    roleId: "forestry_officer",
    name: "Forestry Officer",
    description: "Forestry Commission officer responsible for forest reserve protection",
    institution: "Forestry Commission",
    permissions: [
      { id: "review_incident", name: "Review Incident", scope: "review" },
      { id: "dispatch_inspector", name: "Dispatch Patrol", scope: "dispatch" },
      { id: "issue_notice", name: "Issue Enforcement", scope: "issue" },
      { id: "close_incident", name: "Close Incident", scope: "close" },
      { id: "transition_", name: "Transition Lifecycle", scope: "transition" },
      { id: "complete_step", name: "Complete Workflow Step", scope: "step" },
    ],
    maxSeverity: "critical",
    canEscalate: true,
    requiresApproval: [],
  },
  {
    roleId: "cocoa_extension_officer",
    name: "Cocoa Extension Officer",
    description: "COCOBOD officer responsible for cocoa disease response and farmer advisory",
    institution: "COCOBOD",
    permissions: [
      { id: "review_incident", name: "Review Incident", scope: "review" },
      { id: "dispatch_inspector", name: "Dispatch Officer", scope: "dispatch" },
      { id: "close_incident", name: "Close Incident", scope: "close" },
      { id: "transition_", name: "Transition Lifecycle", scope: "transition" },
      { id: "complete_step", name: "Complete Workflow Step", scope: "step" },
    ],
    maxSeverity: "high",
    canEscalate: true,
    requiresApproval: [],
  },
  {
    roleId: "field_inspector",
    name: "Field Inspector",
    description: "Field-deployed inspector who conducts on-site verification and collects evidence",
    institution: "Field Operations",
    permissions: [
      { id: "complete_step", name: "Complete Field Verification", scope: "step" },
      { id: "collect_evidence", name: "Collect Evidence", scope: "collect" },
      { id: "transition_", name: "Report Findings", scope: "transition" },
    ],
    maxSeverity: "critical",
    canEscalate: false,
    requiresApproval: [],
  },
  {
    roleId: "intelligence_analyst",
    name: "Intelligence Analyst",
    description: "Analyst who assembles evidence packages and reviews intelligence before operational handoff",
    institution: "Intelligence",
    permissions: [
      { id: "review_incident", name: "Review Incident", scope: "review" },
      { id: "complete_step", name: "Assemble Evidence", scope: "step" },
      { id: "escalate", name: "Escalate to Operations", scope: "escalate" },
      { id: "transition_", name: "Transition Lifecycle", scope: "transition" },
    ],
    maxSeverity: "critical",
    canEscalate: true,
    requiresApproval: [],
  },
  {
    roleId: "administrator",
    name: "Platform Administrator",
    description: "System administrator with full oversight — manages roles, workflows, and audit",
    institution: "Administration",
    permissions: [
      { id: "*", name: "Full Access", scope: "" },
    ],
    maxSeverity: "critical",
    canEscalate: true,
    requiresApproval: [],
  },
];

// ===========================================================================
// CREATE INCIDENTS FROM EXISTING INTELLIGENCE
// Pulls real observations + hypotheses + agent runs to open operational incidents.
// ===========================================================================

async function createIncidentsFromIntelligence(): Promise<void> {
  // Pull real observations from the DB (intelligence layer)
  const observations = await db.observation.findMany({
    take: 10,
    orderBy: { observedAt: "desc" },
    include: { hypotheses: true },
  });

  let incidentIdx = 0;

  // Incident 1: Illegal mining from surface_disturbance observation
  const miningObs = observations.find((o) => o.type === "surface_disturbance") ?? observations[0];
  if (miningObs) {
    const primaryHyp = miningObs.hypotheses.find((h) => h.isPrimary) ?? miningObs.hypotheses[0];
    const inc = await createIncident({
      type: "illegal_mining",
      severity: (miningObs.severity as any) ?? "high",
      title: `Illegal mining activity — ${miningObs.title}`,
      summary: miningObs.summary,
      regionId: miningObs.mgrsTile ?? undefined,
      location: { lng: miningObs.centroidLng, lat: miningObs.centroidLat },
      areaAffectedHa: miningObs.areaHa,
      evidence: [miningObs.id],
      confidence: primaryHyp?.confidence ?? miningObs.confidence,
      agentsInvolved: ["mining-analyst"],
      createdBy: "agent:mining-analyst",
    });
    incidentIdx++;

    // Advance it through the workflow partially (reviewed + assigned)
    await transitionIncident(inc.incidentId, "reviewed", "epa-user-1", "Evidence reviewed — strong SAR + optical fusion signal");
    await assignIncident(inc.incidentId, ["epa-western-team", "inspector-kofi"], "environmental_regulator");
    await createDecision({
      incidentId: inc.incidentId,
      actorId: "epa-user-1",
      actorRole: "environmental_regulator",
      decisionType: "approve_field_inspection",
      decision: "Approved field inspection — dispatch drone + inspector",
      rationale: "Fused confidence 0.86, severity critical, multi-source evidence (SAR + optical + historical). Meets threshold for field verification.",
      basedOn: [miningObs.id],
    });
    await createAction({
      incidentId: inc.incidentId,
      decisionId: undefined,
      actionType: "drone_verification",
      description: "Dispatch drone for high-resolution verification of excavation pits",
      assignedTo: "epa-drone-unit",
      assignedRole: "field_inspector",
      cost: 180,
    });
  }

  // Incident 2: Flood risk (synthetic from a vegetation/moisture observation or fresh)
  const floodObs = observations.find((o) => o.type === "moisture_stress" || o.type === "water_body_change");
  await createIncident({
    type: "flood_risk",
    severity: "high",
    title: "Flood risk — Volta Basin downstream of spillage",
    summary: "Heavy rainfall (CHIRPS >80mm/24h) combined with elevated river levels indicates high flood risk for downstream communities in the Volta Basin.",
    regionId: "vol",
    location: { lng: 0.43, lat: 6.62 },
    areaAffectedHa: 1240,
    evidence: floodObs ? [floodObs.id] : [],
    confidence: 0.78,
    agentsInvolved: ["flood-coordinator"],
    arbitrationId: undefined,
    createdBy: "agent:flood-coordinator",
  });

  // Incident 3: Deforestation (fresh)
  await createIncident({
    type: "deforestation",
    severity: "moderate",
    title: "Canopy loss — edge of Atewa Forest Reserve",
    summary: "Persistent NDVI decline over 30 days at the eastern boundary of Atewa Forest Reserve. 4.8 ha affected. Pattern consistent with selective logging.",
    regionId: "est",
    location: { lng: -0.58, lat: 6.22 },
    areaAffectedHa: 4.8,
    evidence: [],
    confidence: 0.71,
    agentsInvolved: ["mining-analyst"],
    createdBy: "agent:mining-analyst",
  });

  // Incident 4: Water pollution (resolved → learned, to show the full closed loop)
  const waterInc = await createIncident({
    type: "water_pollution",
    severity: "high",
    title: "Turbidity surge — Ankobra River downstream of Prestea",
    summary: "Spectral turbidity proxy increased 38% over a 12 km reach downstream of the Prestea mining field. No rainfall trigger in prior 72h — anthropogenic origin.",
    regionId: "wst",
    location: { lng: -2.16, lat: 5.39 },
    areaAffectedHa: 96,
    evidence: [],
    confidence: 0.86,
    agentsInvolved: ["mining-analyst", "flood-coordinator"],
    createdBy: "agent:mining-analyst",
  });

  // Run water incident through the FULL lifecycle to show the closed loop:
  // detected → reviewed → assigned → investigated → resolved → closed → learned
  if (waterInc) {
    await transitionIncident(waterInc.incidentId, "reviewed", "epa-user-2", "Reviewed — turbidity signature anthropogenic, no rainfall trigger");
    await assignIncident(waterInc.incidentId, ["epa-western-team"], "environmental_regulator");
    await transitionIncident(waterInc.incidentId, "investigated", "inspector-kofi", "Inspector dispatched — confirmed 3 active galamsey pits upstream");
    await createDecision({
      incidentId: waterInc.incidentId,
      actorId: "epa-user-2",
      actorRole: "environmental_regulator",
      decisionType: "issue_notice",
      decision: "Issued enforcement notice — operation shut down",
      rationale: "Field verification confirmed illegal mining. Three pits active. Water turbidity 3.1 z-score. Enforcement notice issued under EPA Act.",
      basedOn: [waterInc.incidentId],
    });
    const fieldAction = await createAction({
      incidentId: waterInc.incidentId,
      actionType: "issue_notice",
      description: "Field inspector issued enforcement notice and documented pit locations",
      assignedTo: "inspector-kofi",
      assignedRole: "field_inspector",
      cost: 350,
    });
    if (fieldAction) {
      await completeAction(fieldAction.actionId, "3 illegal pits confirmed and documented. Enforcement notice served. Operation ceased within 48h.", [waterInc.incidentId], 350);
    }
    await transitionIncident(waterInc.incidentId, "resolved", "epa-user-2", "Illegal mining operation shut down. Water quality monitoring ongoing.");
    await transitionIncident(waterInc.incidentId, "closed", "epa-user-2", "Incident closed. Forwarded to learning.");
    // Record outcome — closes the learning loop
    await recordOutcome({
      incidentId: waterInc.incidentId,
      result: "confirmed",
      groundTruth: true,
      summary: "Field verification confirmed illegal mining. Original intelligence assessment (0.86 confidence) was correct. 3 pits documented, enforcement notice issued, operation ceased.",
      fieldFindings: { pitsConfirmed: 3, riverBuffer_m: 180, turbidityZScore: 3.1, enforcementNoticeServed: true, operationCeased: true },
      timeToResolveH: 96,
      totalCost: 350,
    });
  }

  // Incident 5: Cocoa disease (fresh, lower confidence)
  await createIncident({
    type: "cocoa_disease",
    severity: "moderate",
    title: "Possible cocoa swollen shoot disease — Western North",
    summary: "Spectral signature consistent with Cocoa Swollen Shoot Virus Disease (CSSVD) detected across 12 ha of cocoa farms in Western North. Pattern matches known CSSVD stress signature.",
    regionId: "wnw",
    location: { lng: -2.49, lat: 6.39 },
    areaAffectedHa: 12,
    evidence: [],
    confidence: 0.62,
    agentsInvolved: ["mining-analyst"],
    createdBy: "agent:mining-analyst",
  });

  // Emit a few synthetic situation events to populate the feed
  await emitSituationEvent({
    kind: "arbitration",
    severity: "info",
    title: "Agent debate completed — mining vs flood agent",
    detail: "Mining Analyst (86%) vs Flood Coordinator (12%) — resolved to mining. Confidence 0.86.",
    agentId: "arbitration",
  });
  await emitSituationEvent({
    kind: "mining_anomaly",
    severity: "crit",
    title: "Mining anomaly detected — Western Region",
    detail: "Surface disturbance + water discoloration co-located near Ankobra River",
    regionId: "wst",
  });
  await emitSituationEvent({
    kind: "flood_risk",
    severity: "warn",
    title: "Flood risk increased — Volta Basin",
    detail: "Upstream rainfall exceeded 80mm/24h threshold",
    regionId: "vol",
  });
}
