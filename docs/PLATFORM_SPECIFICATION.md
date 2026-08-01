# Ghana Digital Twin — Platform Specification v1.0

**Status:** STABLE (Frozen)  
**Kernel Version:** 1.0.0  
**Released:** 2025  

This specification defines the contracts of the Ghana Digital Twin (GDT) platform kernel independently of any specific implementation. Future implementations (TypeScript, Rust, Go, cloud-hosted) should target this specification.

---

## Part I: Core Model

### 1.1 Package
A Package is the only deployment unit. Everything — datasets, connectors, reasoners, domain logic, agents, UI, knowledge — is a Package.

### 1.2 Capability
A Capability is a typed, versioned API contract — not a string name. Each has inputSchema, outputSchema, QoS (latency/freshness/availability), backward compatibility, and semantic metadata.

### 1.3 Contract
A Contract declares what a package consumes and produces. Static validation before installation.

### 1.4 Artifact
Artifacts are immutable. New versions create new artifacts with parent references — a Git-like DAG. Content-hash deduplication.

### 1.5 Event
Events are the source of truth. 15 standard event types. Artifacts are projections of events. Replay = re-execute events.

### 1.6 Execution Plan
A compiled solution ready for execution. Contains: DAG nodes/edges, topological order, parallel groups, provider assignments, policy validation, provenance records.

---

## Part II: Runtime

### 2.1 Scheduler
Executes DAGs. Parallelizes nodes at same depth. Caches intermediate outputs. Records provenance.

### 2.2 Negotiation
Resolves capability requirements to providers. Quality/cost/freshness criteria. Semantic matching via ontology. Records provenance.

### 2.3 Policy Engine
"Should it?" (separate from "can it?"). Declarative: allow/deny/require with conditions. Global, package, or regional scope.

### 2.4 Governance
Who approved. Roles: regulator, domain_expert, security_reviewer. Separate from policy.

---

## Part III: SDK (Frozen)

The SDK is the ONLY interface packages use. Internal implementations are NOT frozen.

### ctx.v1.* Methods
- world.query, world.get, world.relationships
- observations.list, observations.get, observations.create
- features.read
- scenes.list, scenes.get
- learning.feedback, learning.priors
- missions.create, missions.list
- ai.reason, ai.extract, ai.classify, ai.embed, ai.chat
- emit, config

Every SDK call checked against granted capabilities.

---

## Part IV: Package Manifest

```yaml
id: illegal-mining
version: 2.3.1
kind: domain
provides: [{capability, type, quality, outputType}]
requires: [{type: capability|package, target, required, preferredQuality, maxCost}]
exports: {observations, hypotheses, missions, features, alerts}
permissions: [compute.raster, mission.create, alert.publish]
composes: [sentinel2-connector, bayesian-reasoner]
portable: true
```

---

## Part V: Lifecycle

Draft → Built → Validated → Signed → Verified → Official → Deprecated → Archived

Only allowed transitions. Every transition recorded with who/when/notes.

---

## Part VI: Compatibility

- Semantic versioning (MAJOR.MINOR.PATCH)
- Capability versioning (independent semver per capability)
- compatibleWith declares backward compatibility
- Deprecated interfaces functional for 2 major versions
- SDK method signatures frozen at v1 — only new methods can be added

---

## Part VII: Security

### Capability Model
28 capabilities, 10 categories. Risk levels: low (auto), medium (auto), high/critical (manual approval).

### Sandbox
No direct DB/filesystem/network access. Only SDK. Declarative YAML + SDK calls.

### Resource Quotas
CPU 500ms, Memory 512MB, Network disabled, Raster reads 1000/run, Feature writes 100/run, API calls 500/invocation.

---

## Part VIII: Marketplace

### Trust Levels
Experimental → Verified (conformance passed) → Certified (governance approved) → Official (platform team)

### Remote Distribution
Registries host packages. Runtime resolves capabilities → registry lookup → download → verify → validate → cache → activate.

### Conformance Testing
Standard suite: manifest validation, capability negotiation, dependency resolution, sandbox enforcement, resource quota enforcement, replay determinism, artifact reproducibility, policy evaluation, provenance generation. Passing earns conformance badge.
