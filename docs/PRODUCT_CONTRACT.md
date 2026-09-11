# PRODUCT_CONTRACT.md

## Product identity
Silent Shift is a context-aware behavioral-security investigation system.

It detects meaningful transitions in user or account behavior, reconciles those deviations against legitimate organizational context, and prioritizes the remaining unexplained activity for human investigation.

It must never label an employee as malicious or infer intent.

## Product goal
Reduce analyst workload by surfacing only the most meaningful unexplained behavior transitions and making the evidence and matching context visible.

## Primary user
Analysts and security investigators triaging anomalous account activity.

## Primary user problem
Signals are noisy, context is fragmented, and the raw anomaly can be confused with legitimate role or operational change. Investigators need a system that separates:

1. raw behavioral deviation
2. context coverage and explanation
3. residual unexplained risk

## Behavioral telemetry vs. organizational context
The system must distinguish between behavioral telemetry and contextual approval records.

Behavioral telemetry domains are:
- authentication
- file/resource access
- privilege activity

Organizational context records are:
- role changes
- project assignments
- approved travel
- maintenance windows
- temporary access grants

Contextual approval records are not behavioral activity and must not be treated as equivalent telemetry.

## Scope
The product includes:
- normalized event ingestion for the approved behavioral telemetry domains
- separate handling of organizational context records
- feature extraction and feature provenance
- hierarchical baselines
- change-point detection
- sequence correlation
- context compatibility matching
- residual risk and uncertainty scoring
- alert-budget ranking
- evidence-backed case generation
- analyst decision capture and audit history

The initial data source is disclosed synthetic replay fixtures only. There is no claim of live enterprise ingestion.

## Non-goals
- malicious intent attribution
- autonomous containment
- arbitrary latency guarantees
- production deployment claims without evidence
- live ingestion claims for non-live fixtures
- use of an LLM as the decision engine
- hidden or opaque scoring without evidence references
- application redesign during documentation and engine milestones
- UI migration before the approved application-shell milestone

## Primary differentiator
Every case must visibly separate the following dimensions:

1. raw behavioral deviation
2. context coverage
3. residual unexplained risk

The context result must be one of:
- EXPLAINED: all material anomalous evidence is covered by valid context.
- PARTIALLY_EXPLAINED: some material evidence is covered and some remains.
- UNEXPLAINED: no applicable context covers material evidence.
- INDETERMINATE: evidence or context quality is insufficient.

These states must not be defined by arbitrary percentage thresholds.

## Core pipeline
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

## Baseline design requirements
The system must combine:
- personal behavioral history
- peer-cohort behavior
- resource interaction history

It must account for:
- new-user cold start
- recent role changes
- hybrid roles
- unique roles
- missing or unreliable context
- insufficient behavioral history

Insufficient evidence must increase uncertainty instead of automatically increasing risk.

## Context engine requirements
Match legitimate context using:
- actor
- valid start and end times
- resource scope
- action scope
- expected volume
- approved destination
- approving authority
- covering organizational context record metadata

Context must not erase raw deviation. It may explain only the portion that matches its scope, and later out-of-scope activity must remain detectable.

## Demo scenarios

### 1. Legitimate role or project change
High raw deviation, high context coverage, low residual risk.

### 2. Compromised account
New device, unfamiliar resource exploration, privilege activity, and sensitive download with no matching context.

### 3. Partially legitimate migration
Bulk access is authorized, but another sensitive resource or external destination falls outside the approved scope.

This third scenario is the primary differentiating demonstration.

## AI boundary
- Detection and scoring must be deterministic and inspectable.
- The complete product must function without an LLM.
- An LLM may translate a structured evidence object into readable prose only after the deterministic engine is implemented and separately approved.
- The LLM must not calculate risk.
- It must not invent evidence.
- It must not infer intent or guilt.
- It must not suppress alerts.
- It must not execute containment.
- Generated narratives must reference evidence identifiers.
- A deterministic fallback explanation must always exist.

## Prototype constraints
- Prototype persistence is in-memory/session-only.
- Durable audit storage is PLANNED.
- Public performance claims are not allowed until generated by implemented benchmark code.
- A demo alert budget may be configured as fixture data, but it must not be presented as a universal threshold.

## Shift Graph contract
The first production milestone for the Shift Graph is Milestone 11. Before then, only the design contract exists.

The working design is a 2D evidence-linked temporal visualization. 3D is optional and later. 3D must not obscure exact values or evidence.

The graph connects:
- user
- time
- device
- resource
- privilege
- destination
- contextual approval
- detected change point

Every graph element and explanation must link back to underlying evidence.

## Privacy and governance
- pseudonymous identities by default
- role-based access assumptions
- data minimization
- configurable retention
- analyst decision logs
- separation of anomaly from guilt
- contestability and correction of context
- uncertainty display
- prevention of sensitive message-content exposure
- safeguards against feedback poisoning
- production retention defaults remain unresolved

## Product contract summary
Silent Shift is a transparent investigation support system for human decisions. It detects abnormal behavior, disambiguates it against legitimate context, and exposes residual risk without guessing intent.

## Open decision points
The following are unresolved and should be treated as decisions required:
- production retention defaults
- alert-budget value for a real deployment
- minimum benchmark performance for public claims
- whether the optional LLM milestone will be approved
- exact deployment environment
- user identity pseudonymization policy
- analyst workflow and case routing rules
- evidence export formats
