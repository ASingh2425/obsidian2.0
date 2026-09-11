# ARCHITECTURE.md

## Architecture overview
Silent Shift is structured as a deterministic investigation pipeline with explicit evidence traces. The design separates raw observation, context matching, residual risk calculation, and analyst-facing case generation.

## Scope of the initial implementation
The first implementation milestone is a TypeScript domain engine and synthetic fixture-based evaluation only.

It does not include:
- dashboard redesign
- backend services
- LLM integration
- live enterprise ingestion
- autonomous containment
- application redesign during documentation and engine milestones

The initial data source is disclosed synthetic replay fixtures.

## Behavioral and contextual separation
The engine must explicitly distinguish between:

### Behavioral telemetry
- authentication events
- file/resource access events
- privilege activity events

### Organizational context records
- role changes
- project assignments
- approved travel
- maintenance windows
- temporary access grants

These are separate layers. Contextual approval records must not be normalized as behavioral telemetry.

## Core components

### 1. Event normalization layer
Responsibilities:
- ingest raw behavioral telemetry events from synthetic fixtures
- normalize actor, resource, destination, privilege, and time fields
- attach metadata for source and trust level
- flag incomplete or missing values
- preserve organizational context as a separate record stream

Failure mode:
- missing or unreliable fields increase uncertainty instead of increasing risk

### 2. Feature extraction layer
Responsibilities:
- convert normalized events into behavior features
- extract sequence features, resource access patterns, destination patterns, privilege changes, and timing features
- keep feature calculations inspectable and deterministic
- record feature provenance for every derived observation

### 3. Baseline engine
Responsibilities:
- build personal baselines
- combine with peer-cohort baselines
- account for resource interaction history
- handle cold start, role changes, hybrid roles, sparse history, and unique roles

Failure mode:
- low-quality baselines raise uncertainty and reduce confidence rather than forcing escalation

### 4. Change-point detection
Responsibilities:
- identify meaningful deviations against the expected behavior profile
- detect transitions in access, privilege, and destination patterns
- define event-order rules and time-window boundaries clearly
- mark the change point with evidence references

### 5. Sequence correlation engine
Responsibilities:
- correlate related events in time and actor scope
- determine whether a deviation is isolated or part of a sequence
- preserve context boundaries for later explainability
- enforce temporal-leakage prevention during online detection

### 6. Context compatibility engine
Responsibilities:
- match legitimate context against observed deviations
- validate actor, time range, resource scope, action scope, expected volume, destination, and approving authority
- determine whether context explains all, part, or none of the deviation
- treat context records as approval metadata rather than behavioral activity

Critical rule:
- context may explain only the portion that fits the approved scope
- unexplained residual activity remains visible

### 7. Residual risk and uncertainty layer
Responsibilities:
- compute residual unexplained risk
- retain uncertainty from insufficient evidence
- ensure raw anomalies remain visible even when partially explained
- keep confidence and data quality separated from risk values

### 8. Alert-budget ranking
Responsibilities:
- rank candidate cases by residual risk and evidence strength
- limit analyst attention to budgeted high-value cases
- make the scoring function inspectable

### 9. Evidence-backed case builder
Responsibilities:
- assemble evidence identifiers, context matches, residual risk, and uncertainty
- generate deterministic structured outputs for analyst review
- produce a fallback narrative if no LLM summary is available

### 10. Analyst decision and audit history
Responsibilities:
- capture analyst actions and rationale
- retain decision logs and evidence references
- support contestability and correction of context

## Trust boundaries
- raw anomaly data is distinct from contextual explanation
- context is never treated as guilt
- evidence is identity-linked but not identity-asserting
- analyst decisions are stored separately from detection logic
- prototype data is session-scoped only
- organizational context records are not treated as telemetry events

## Data flow summary
normalized events
→ feature extraction
→ feature provenance
→ hierarchical baselines
→ change-point detection
→ sequence correlation
→ context compatibility
→ residual risk and uncertainty
→ alert-budget ranking
→ evidence-backed case
→ analyst decision and audit history

## Failure modes and safeguards
- cold start: increase uncertainty rather than risk
- unreliable context: reduce explanation coverage and preserve raw deviation
- sparse history: degrade confidence without over-escalation
- conflicting context: preserve unexplained residual risk
- missing approvals: do not absorb anomaly into legitimate context
- incomplete evidence: keep score explainable and auditable
- context corrections: create audit events without erasing historical raw evidence
- temporal leakage: no future event may influence an earlier detection result
- missing time windows: produce INDETERMINATE when appropriate

## Planned deployment model
This architecture is designed to be deployable in stages:
- local deterministic analysis engine
- synthetic data validation harness
- policy-controlled context matching
- analyst workflow integration
- durable retention and audit controls
- UI migration at the approved application-shell milestone

## LLM and narrative boundary
The initial milestones exclude LLMs. Deterministic explanation generation is tested in Milestone 7. LLM failure handling is tested only in Milestone 12. A later narrative layer may consume structured evidence objects and produce prose only after deterministic scoring is implemented, validated, and separately approved. It must not calculate risk, invent evidence, infer guilt, or suppress alerts.

## Pseudonymization schedule
- Milestone 1 defines pseudonymous entity identifiers.
- Milestone 8 ensures cases and audit events use pseudonymous identifiers by default.
- Milestone 10 implements pseudonymized visual display.
- Milestone 13 audits privacy behavior.

## Shift Graph model
The Shift Graph is planned for Milestone 11, not Milestone 1. The design contract exists before that milestone. The eventual implementation is a 2D evidence-linked temporal visualization. It should support temporal relationships among actor, device, resource, privilege, destination, and approvals without obscuring exact values. 3D is optional and later.

## Open design decisions
The following items remain unresolved and require decision approval:
- production retention defaults
- alert-budget value for a real deployment
- minimum benchmark performance for public claims
- whether the optional LLM milestone will be approved
- exact fixture schema versioning is resolved as silent-shift.v1
