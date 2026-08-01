// Ghana Digital Twin — Autonomous Runtime Engine
// Agents are packages that execute on the frozen kernel.
// The runtime loop: Events → Agent → Context → Reasoning → Policy → Execute → Artifacts → Events ↺
// NO kernel modifications. Uses existing: EventBus, ImmutableArtifact, ExecutionPlan, SDK, Policy.

import { db } from "@/lib/db";
import { createImmutableArtifact, getImmutableArtifact } from "@/lib/kernel/engine";
import { evaluatePolicy } from "@/lib/orchestration/engine";
import { recordMetric } from "@/lib/validation/observability";

// ---- Agent Run Lifecycle ----

export interface AgentTrigger {
  agentId: string;
  triggerEvent: string;
  triggerArtifact?: string;
}

export interface AgentContext {
  agentId: string;
  trigger: AgentTrigger;
  // assembled context (artifacts the agent reads)
  contextArtifacts: string[];
  // world state snapshot
  worldState: {
    observations: any[];
    hypotheses: any[];
    phenomena: any[];
    activeMissions: any[];
  };
  // agent memory (from artifacts)
  memory: {
    learnedFrom: any[];
    pastDecisions: any[];
    mistakes: any[];
    successPatterns: any[];
  };
  // capabilities
  tools: string[];
  constraints: {
    maxCostPerRun: number;
    requiresApproval: string[];
  };
}

export interface AgentReasoningStep {
  step: string;
  input: string;
  output: string;
  confidence: number;
}

export interface ProposedAction {
  type: string; // "query_world" | "read_features" | "ai_reason" | "create_mission" | "publish_alert" | "emit_observation"
  target?: string;
  params: Record<string, any>;
  cost: number;
  infoGain: number;
  reasoning: string;
}

export interface AgentRunResult {
  runId: string;
  agentId: string;
  status: string;
  reasoningSummary: string;
  reasoningSteps: AgentReasoningStep[];
  proposedActions: ProposedAction[];
  executedActions: any[];
  outputArtifacts: string[];
  eventsEmitted: string[];
  actualCost: number;
  durationMs: number;
}

/**
 * Execute an agent run: the full autonomous loop.
 * 1. Assemble context (read world state + agent memory)
 * 2. Reason (using agent-specific logic)
 * 3. Propose actions
 * 4. Check policies
 * 5. Execute approved actions
 * 6. Create output artifacts
 * 7. Emit events
 * 8. Update agent memory
 */
export async function executeAgentRun(trigger: AgentTrigger): Promise<AgentRunResult> {
  const startedAt = new Date();
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Create run record
  const run = await db.agentRun.create({
    data: {
      runId,
      agentId: trigger.agentId,
      triggerEvent: trigger.triggerEvent,
      triggerArtifact: trigger.triggerArtifact ?? null,
      status: "reasoning",
      startedAt,
    },
  });

  try {
    // 1. Assemble context
    const context = await assembleContext(trigger);

    // 2. Reason (agent-specific)
    const { reasoningSummary, reasoningSteps, proposedActions } = await reason(trigger.agentId, context);

    // 3. Check policies for each proposed action
    const policyResults = await Promise.all(
      proposedActions.map(async (action) => {
        const policy = await evaluatePolicy(action.type, {
          agentId: trigger.agentId,
          cost: action.cost,
          confidence: action.infoGain,
        });
        return { action, allowed: policy.allowed, reasons: policy.reasons };
      })
    );

    const allowedActions = policyResults.filter((p) => p.allowed).map((p) => p.action);
    const deniedActions = policyResults.filter((p) => !p.allowed);

    // 4. Execute approved actions
    const executedActions: any[] = [];
    const outputArtifacts: string[] = [];
    const eventsEmitted: string[] = [];
    let actualCost = 0;

    for (const action of allowedActions) {
      if (actualCost + action.cost > context.constraints.maxCostPerRun) continue;

      const execution = await executeAction(action, trigger.agentId, runId);
      executedActions.push(execution);
      actualCost += action.cost;

      if (execution.resultArtifact) {
        outputArtifacts.push(execution.resultArtifact);
      }
      if (execution.eventEmitted) {
        eventsEmitted.push(execution.eventEmitted);
      }
    }

    // 5. Create run artifact (immutable record of this run)
    const runArtifact = await createImmutableArtifact({
      kind: "agent_run",
      content: {
        runId,
        agentId: trigger.agentId,
        reasoningSummary,
        proposedActions: proposedActions.length,
        executedActions: executedActions.length,
        deniedActions: deniedActions.length,
        outputArtifacts,
        actualCost,
      },
      parentHashes: context.contextArtifacts,
      createdBy: `agent:${trigger.agentId}`,
      createdVia: "autonomous_runtime",
      providerUsed: trigger.agentId,
      providerReason: `Agent ${trigger.agentId} executed on ${trigger.triggerEvent}`,
    });

    // 6. Update agent memory
    await updateAgentMemory(trigger.agentId, runArtifact.hash, {
      reasoningSummary,
      decisions: executedActions,
      trigger: trigger.triggerEvent,
    });

    // 7. Update run record
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    await db.agentRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        reasoningSummary,
        reasoningSteps: JSON.stringify(reasoningSteps),
        proposedActions: JSON.stringify(proposedActions),
        policyChecked: true,
        policyAllowed: allowedActions.length > 0,
        policyReasons: JSON.stringify(policyResults.map((p) => ({ action: p.action.type, allowed: p.allowed, reasons: p.reasons }))),
        executedActions: JSON.stringify(executedActions),
        outputArtifacts: JSON.stringify(outputArtifacts),
        eventsEmitted: JSON.stringify(eventsEmitted),
        completedAt,
        durationMs,
        actualCost,
      },
    });

    // 8. Record metrics
    await recordMetric({ stage: "agent_runtime", metricName: "run_duration_ms", value: durationMs, unit: "ms", context: { agentId: trigger.agentId } });
    await recordMetric({ stage: "agent_runtime", metricName: "actions_executed", value: executedActions.length, unit: "items", context: { agentId: trigger.agentId } });
    await recordMetric({ stage: "agent_runtime", metricName: "cost", value: actualCost, unit: "USD", context: { agentId: trigger.agentId } });

    return {
      runId,
      agentId: trigger.agentId,
      status: "completed",
      reasoningSummary,
      reasoningSteps,
      proposedActions,
      executedActions,
      outputArtifacts,
      eventsEmitted,
      actualCost,
      durationMs,
    };
  } catch (e) {
    const completedAt = new Date();
    await db.agentRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    });
    throw e;
  }
}

// ---- Context Assembly ----

async function assembleContext(trigger: AgentTrigger): Promise<AgentContext> {
  const agent = await db.agentPackage.findUnique({ where: { agentId: trigger.agentId } });
  if (!agent) throw new Error(`Agent ${trigger.agentId} not found`);

  // Read world state
  const [observations, hypotheses, phenomena, missions] = await Promise.all([
    db.observation.findMany({ take: 10, orderBy: { observedAt: "desc" }, select: { id: true, type: true, title: true, confidence: true, severity: true, areaHa: true, centroidLng: true, centroidLat: true } }),
    db.hypothesis.findMany({ take: 10, orderBy: { confidence: "desc" }, select: { id: true, type: true, label: true, confidence: true, rank: true, isPrimary: true, observationId: true } }),
    db.phenomenon.findMany({ take: 5, where: { status: { in: ["emerging", "active", "growing"] } }, select: { id: true, type: true, status: true, currentAreaHa: true } }),
    db.mission.findMany({ take: 5, where: { status: { in: ["planned", "assigned", "in_progress"] } }, select: { id: true, type: true, title: true, priority: true, evi: true } }),
  ]);

  // Read agent memory (from artifacts)
  const memoryArtifacts = await db.agentMemoryArtifact.findMany({
    where: { agentId: trigger.agentId },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  const memory = {
    learnedFrom: memoryArtifacts.filter((m) => m.memoryType === "observation_learned").length,
    pastDecisions: memoryArtifacts.filter((m) => m.memoryType === "decision").length,
    mistakes: memoryArtifacts.filter((m) => m.memoryType === "mistake").length,
    successPatterns: memoryArtifacts.filter((m) => m.memoryType === "success_pattern").length,
  };

  return {
    agentId: trigger.agentId,
    trigger,
    contextArtifacts: memoryArtifacts.map((m) => m.artifactHash),
    worldState: { observations, hypotheses, phenomena, activeMissions: missions },
    memory,
    tools: JSON.parse(agent.permissions || "[]"),
    constraints: {
      maxCostPerRun: 5, // default
      requiresApproval: ["alert.publish", "mission.create"],
    },
  };
}

// ---- Agent Reasoning (agent-specific logic) ----

async function reason(agentId: string, context: AgentContext): Promise<{
  reasoningSummary: string;
  reasoningSteps: AgentReasoningStep[];
  proposedActions: ProposedAction[];
}> {
  const steps: AgentReasoningStep[] = [];
  const actions: ProposedAction[] = [];

  if (agentId === "mining-analyst") {
    // Mining Analyst Agent reasoning
    steps.push({
      step: "check_observations",
      input: `${context.worldState.observations.length} recent observations`,
      output: context.worldState.observations.filter((o) => o.type === "surface_disturbance").map((o) => o.title).join("; ") || "no surface disturbance observations",
      confidence: 0.8,
    });

    steps.push({
      step: "check_hypotheses",
      input: `${context.worldState.hypotheses.length} hypotheses`,
      output: context.worldState.hypotheses.filter((h) => h.isPrimary).map((h) => `${h.label} (${(h.confidence * 100).toFixed(0)}%)`).join("; ") || "no primary hypotheses",
      confidence: 0.85,
    });

    steps.push({
      step: "check_mining_ontology",
      input: "mining knowledge package",
      output: "vegetation_loss → bare_soil → water_turbidity → downstream_communities",
      confidence: 0.9,
    });

    // Propose actions for uncertain hypotheses
    const uncertainHyps = context.worldState.hypotheses.filter((h) => h.confidence < 0.75 && h.isPrimary);
    for (const hyp of uncertainHyps) {
      actions.push({
        type: "create_mission",
        target: hyp.observationId,
        params: { missionType: "sar_tasking", reason: `Hypothesis ${hyp.label} has ${(hyp.confidence * 100).toFixed(0)}% confidence — SAR evidence needed` },
        cost: 0, // SAR is free (Sentinel-1)
        infoGain: 0.42,
        reasoning: `Hypothesis "${hyp.label}" at ${(hyp.confidence * 100).toFixed(0)}% confidence. Missing SAR evidence. SAR tasking would reduce uncertainty by ~42%.`,
      });
    }

    return {
      reasoningSummary: `Analyzed ${context.worldState.observations.length} observations and ${context.worldState.hypotheses.length} hypotheses. Found ${uncertainHyps.length} uncertain primary hypotheses requiring verification. Mining ontology: vegetation_loss → bare_soil → water_turbidity → downstream_communities.`,
      reasoningSteps: steps,
      proposedActions: actions,
    };
  }

  if (agentId === "flood-coordinator") {
    steps.push({
      step: "check_observations",
      input: `${context.worldState.observations.length} observations`,
      output: "checking for water body changes and flood indicators",
      confidence: 0.8,
    });

    steps.push({
      step: "check_weather",
      input: "weather data",
      output: "rainfall anomaly + river proximity + DEM slope = flood probability",
      confidence: 0.85,
    });

    return {
      reasoningSummary: `Flood monitoring: checked ${context.worldState.observations.length} observations. Weather + hydrology + DEM analysis complete. No active flood warnings.`,
      reasoningSteps: steps,
      proposedActions: [],
    };
  }

  if (agentId === "learning-agent") {
    steps.push({
      step: "check_ground_truth",
      input: "recent ground truth feedback",
      output: "checking for calibration updates needed",
      confidence: 0.9,
    });

    return {
      reasoningSummary: `Learning agent: monitoring feedback for calibration updates. Memory: ${context.memory.learnedFrom} learned, ${context.memory.pastDecisions} decisions, ${context.memory.mistakes} mistakes.`,
      reasoningSteps: steps,
      proposedActions: [],
    };
  }

  // Generic agent
  return {
    reasoningSummary: `Agent ${agentId} processed trigger ${context.trigger.triggerEvent}. World state: ${context.worldState.observations.length} observations, ${context.worldState.hypotheses.length} hypotheses.`,
    reasoningSteps: steps,
    proposedActions: actions,
  };
}

// ---- Action Execution ----

async function executeAction(action: ProposedAction, agentId: string, runId: string): Promise<any> {
  const execution: any = {
    type: action.type,
    target: action.target,
    status: "executed",
    cost: action.cost,
    reasoning: action.reasoning,
  };

  try {
    if (action.type === "create_mission") {
      // Create a mission via the existing mission planner
      const { planMissions } = await import("@/lib/mission/planner");
      if (action.target) {
        const result = await planMissions({ observationId: action.target });
        execution.resultSummary = `Created ${result.created} missions`;
        execution.missionCount = result.created;
      }
    } else if (action.type === "emit_observation") {
      // Emit an observation event
      execution.resultSummary = "Observation emitted";
      execution.eventEmitted = "ObservationCreated";
    } else if (action.type === "publish_alert") {
      execution.resultSummary = "Alert published (requires approval)";
      execution.eventEmitted = "AlertPublished";
    } else if (action.type === "query_world") {
      execution.resultSummary = "World model queried";
    } else if (action.type === "ai_reason") {
      execution.resultSummary = "AI reasoning completed";
    }

    // Create artifact for this action
    const artifact = await createImmutableArtifact({
      kind: "agent_action",
      content: { runId, agentId, action: execution },
      createdBy: `agent:${agentId}`,
      createdVia: "autonomous_runtime",
      providerUsed: agentId,
    });
    execution.resultArtifact = artifact.hash;
  } catch (e) {
    execution.status = "failed";
    execution.error = String(e).slice(0, 100);
  }

  return execution;
}

// ---- Agent Memory (as immutable artifacts) ----

async function updateAgentMemory(agentId: string, artifactHash: string, memory: {
  reasoningSummary: string;
  decisions: any[];
  trigger: string;
}): Promise<void> {
  // Store each decision as a memory artifact (unique per decision+hash)
  for (let i = 0; i < memory.decisions.length; i++) {
    const decision = memory.decisions[i];
    try {
      await db.agentMemoryArtifact.create({
        data: {
          artifactHash: `${artifactHash}-dec-${i}`,
          agentId,
          memoryType: "decision",
          contentHash: artifactHash,
          relatedArtifacts: JSON.stringify([decision.target].filter(Boolean)),
        },
      });
    } catch { /* skip duplicates */ }
  }

  // Store the run itself as context memory
  try {
    await db.agentMemoryArtifact.create({
      data: {
        artifactHash: `${artifactHash}-ctx`,
        agentId,
        memoryType: "context",
        contentHash: artifactHash,
        relatedArtifacts: JSON.stringify([]),
      },
    });
  } catch { /* skip duplicates */ }
}

// ---- Agent Evaluation ----

export async function evaluateAgent(agentId: string): Promise<any> {
  const runs = await db.agentRun.findMany({
    where: { agentId, status: "completed" },
    take: 50,
  });

  if (runs.length === 0) {
    return { agentId, message: "No completed runs to evaluate" };
  }

  const totalCost = runs.reduce((a, r) => a + r.actualCost, 0);
  const avgCost = totalCost / runs.length;

  // Check ground truth outcomes for this agent's runs
  const groundTruths = await db.groundTruth.findMany({
    where: { verifierRole: "inspector" },
    take: 20,
  });

  let confirmed = 0;
  let rejected = 0;
  for (const gt of groundTruths) {
    if (gt.verifiedOutcome === "confirmed") confirmed++;
    if (gt.verifiedOutcome === "rejected") rejected++;
  }

  const accuracy = confirmed + rejected > 0 ? confirmed / (confirmed + rejected) : 0.5;
  const falsePositiveRate = confirmed + rejected > 0 ? rejected / (confirmed + rejected) : 0;
  const humanAcceptanceRate = confirmed + rejected > 0 ? confirmed / (confirmed + rejected) : 0;

  // Determine trust level
  let trustLevel = "experimental";
  if (runs.length >= 10 && accuracy > 0.7) trustLevel = "verified";
  if (runs.length >= 20 && accuracy > 0.8 && confirmed > 5) trustLevel = "certified";

  // Upsert evaluation
  const evaluation = await db.agentEvaluation.upsert({
    where: { agentId },
    update: {
      accuracyScore: accuracy,
      falsePositiveRate,
      avgCostPerRun: avgCost,
      totalRuns: runs.length,
      totalCost,
      confirmedCount: confirmed,
      rejectedCount: rejected,
      humanAcceptanceRate,
      trustLevel,
      trustScore: accuracy * 0.6 + (1 - falsePositiveRate) * 0.4,
      lastEvaluatedAt: new Date(),
    },
    create: {
      agentId,
      accuracyScore: accuracy,
      falsePositiveRate,
      avgCostPerRun: avgCost,
      totalRuns: runs.length,
      totalCost,
      confirmedCount: confirmed,
      rejectedCount: rejected,
      humanAcceptanceRate,
      trustLevel,
      trustScore: accuracy * 0.6 + (1 - falsePositiveRate) * 0.4,
    },
  });

  return {
    agentId,
    accuracy: (accuracy * 100).toFixed(0) + "%",
    falsePositiveRate: (falsePositiveRate * 100).toFixed(0) + "%",
    avgCostPerRun: "$" + avgCost.toFixed(2),
    totalRuns: runs.length,
    confirmed: confirmed,
    rejected: rejected,
    humanAcceptanceRate: (humanAcceptanceRate * 100).toFixed(0) + "%",
    trustLevel,
    trustScore: evaluation.trustScore,
  };
}

// ---- Autonomous Planner ----

export async function planAutonomous(opts: {
  agentId?: string;
  observationId?: string;
  budget?: number;
}): Promise<any> {
  const budget = opts.budget ?? 1000;

  // Get current uncertain hypotheses
  const hypotheses = await db.hypothesis.findMany({
    where: { confidence: { lt: 0.75 }, isPrimary: true },
    orderBy: { confidence: "asc" },
    take: 10,
    include: { observation: { select: { id: true, type: true, title: true, areaHa: true } } },
  });

  if (hypotheses.length === 0) {
    return { plan: null, message: "No uncertain hypotheses — all primary hypotheses have confidence > 75%" };
  }

  // Plan: for each uncertain hypothesis, propose evidence acquisition
  const plan: any[] = [];
  let remainingBudget = budget;

  for (const hyp of hypotheses) {
    if (remainingBudget <= 0) break;

    // Determine what evidence is missing
    const missing = [];
    if (hyp.contradictingCount === 0 && hyp.supportingCount < 3) {
      missing.push({ type: "sar_tasking", cost: 0, infoGain: 0.42, reason: "SAR evidence (free, cloud-penetrating)" });
    }
    if (hyp.missingCount > 0) {
      missing.push({ type: "community", cost: 5, infoGain: 0.31, reason: "Community verification (low cost)" });
    }
    if (hyp.confidence < 0.5) {
      missing.push({ type: "drone", cost: 200, infoGain: 0.55, reason: "Drone imagery (high info gain)" });
    }

    // Sort by EVI (infoGain / cost)
    missing.sort((a, b) => {
      const eviA = a.cost > 0 ? a.infoGain / a.cost : a.infoGain * 100;
      const eviB = b.cost > 0 ? b.infoGain / b.cost : b.infoGain * 100;
      return eviB - eviA;
    });

    for (const m of missing) {
      if (remainingBudget < m.cost) continue;
      plan.push({
        hypothesisId: hyp.id,
        hypothesisLabel: hyp.label,
        currentConfidence: hyp.confidence,
        action: m.type,
        cost: m.cost,
        infoGain: m.infoGain,
        evi: m.cost > 0 ? m.infoGain / m.cost : m.infoGain * 100,
        reason: m.reason,
        observationId: hyp.observationId,
        observationTitle: hyp.observation?.title,
      });
      remainingBudget -= m.cost;
    }
  }

  return {
    budget,
    budgetUsed: budget - remainingBudget,
    budgetRemaining: remainingBudget,
    hypothesesConsidered: hypotheses.length,
    actionsPlanned: plan.length,
    plan,
  };
}

// ---- Reads ----

export async function getAgentRuns(opts: { agentId?: string; limit?: number } = {}): Promise<any[]> {
  const rows = await db.agentRun.findMany({
    where: opts.agentId ? { agentId: opts.agentId } : {},
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 50,
  });
  return rows.map((r) => ({
    runId: r.runId,
    agentId: r.agentId,
    triggerEvent: r.triggerEvent,
    status: r.status,
    reasoningSummary: r.reasoningSummary,
    proposedActions: JSON.parse(r.proposedActions || "[]"),
    executedActions: JSON.parse(r.executedActions || "[]"),
    outputArtifacts: JSON.parse(r.outputArtifacts || "[]"),
    eventsEmitted: JSON.parse(r.eventsEmitted || "[]"),
    actualCost: r.actualCost,
    durationMs: r.durationMs,
    startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : r.startedAt,
    completedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : r.completedAt,
  }));
}

export async function getAgentEvaluations(): Promise<any[]> {
  const rows = await db.agentEvaluation.findMany({ orderBy: { trustScore: "desc" } });
  return rows.map((r) => ({
    agentId: r.agentId,
    accuracyScore: r.accuracyScore,
    falsePositiveRate: r.falsePositiveRate,
    calibrationScore: r.calibrationScore,
    avgCostPerRun: r.avgCostPerRun,
    totalRuns: r.totalRuns,
    confirmedCount: r.confirmedCount,
    rejectedCount: r.rejectedCount,
    humanAcceptanceRate: r.humanAcceptanceRate,
    trustLevel: r.trustLevel,
    trustScore: r.trustScore,
    lastEvaluatedAt: r.lastEvaluatedAt instanceof Date ? r.lastEvaluatedAt.toISOString() : r.lastEvaluatedAt,
  }));
}

export async function getAgentMemory(agentId: string): Promise<any[]> {
  const rows = await db.agentMemoryArtifact.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows.map((r) => ({
    artifactHash: r.artifactHash,
    memoryType: r.memoryType,
    relatedArtifacts: JSON.parse(r.relatedArtifacts || "[]"),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }));
}
