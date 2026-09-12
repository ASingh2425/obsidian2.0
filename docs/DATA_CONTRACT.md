# DATA_CONTRACT.md

## Purpose
This document defines the strict TypeScript-oriented data contracts for Silent Shift. The initial implementation is a synthetic-features domain engine. It is not a backend or live ingestion layer.

## Conventions
- All domain logic must be implemented in TypeScript.
- Preserve raw evidence and context separately.
- Use stable IDs for every important record.
- Evidence must reference source event IDs.
- Narratives must reference evidence IDs.
- Context matches must identify exactly which evidence was covered.
- RiskAssessment must contain separate rawDeviation, contextCoverage, residualRisk, confidence and dataQuality fields.
- Confidence is evidence confidence, not a probability of malicious intent.
- Missing or poor-quality data increases uncertainty rather than risk.
- `schemaVersion` is resolved as `"silent-shift.v1"`.
- Event ordering is canonical: timestamp ascending, and when timestamps are equal, event IDs are sorted ascending using a locale-independent ordinal string comparison.
- `FeatureObservation.eventIds` contains only contributing source events. It does not include unrelated evaluated events.
- `FeatureObservation.id` is a deterministic unambiguous identifier in the form `feature|<encoded-schema>|<encoded-actor>|<encoded-start>|<encoded-end>|<encoded-feature-name>`, where each component is encoded with `encodeURIComponent` before the `|` join.
- `observedVolume` is a real numeric observation only when defined. Missing `observedVolume` is not treated as numeric zero.
- `failed_outcome_count` uses the record-level `outcome` field and counts only `FAILURE`.
- `privilege_change_count` counts only actual privilege transitions: a valid privilege event with a changed privilege value, with at least one of `priorPrivilege` or `newPrivilege` present and the values not equal.
- A no-event window is deterministic: emit zero-valued aggregate features for the actor, keep empty provenance arrays, and omit measurement features with no numeric observations.
- Absence of a valid categorical count bucket means observed count zero for that actor/window. It does not represent unknown or unavailable telemetry. Consumers must normalize an absent categorical bucket to zero. Missing underlying telemetry or poor data coverage is represented in `DataQuality` in later milestones, not by inventing a category feature.
- Absence of `observed_volume_sum` or `observed_volume_max` means no numeric volume observation was present for that actor/window. It must not be normalized to observed zero.
- Pseudonymous entity identifiers are defined in Milestone 1 and used by default in case and audit records beginning in Milestone 8.

## Baseline snapshot contract

The Milestone 3 baseline snapshot is intentionally minimal and deterministic. It preserves exact counts, canonical provenance, and unavailable-state semantics without exposing legacy aggregate history maps.

- `sampleCount` means the number of contributing baseline units. For personal baselines, this is the count of qualifying observations for the actor. For peer baselines, this is the count of contributing peer actors. For resource baselines, this is the count of qualifying observations for the exact resource.
- `observationCount` means the underlying raw observation count. For peer baselines, this includes all contributing raw observations across peer actors. For personal and resource baselines, it usually matches `sampleCount` unless the same unit is represented by multiple observations. It is always the raw observation count retained in provenance.
- `median`/`mad`/`min`/`max` are null whenever `available` is false, even when raw observations exist but the threshold is not met. Actual counts and provenance are preserved.
- Peer baselines use `median-of-peer-medians`: each peer actor contributes one median value, and the cohort baseline is the median of those peer medians. Peer `sampleCount` is the number of contributing peers; peer `observationCount` is the total underlying observations across peers.
- Cohort identity resolution is explicit: a cohort member must exist in the provided explicit entity list before baseline generation accepts it. Observation presence alone is not used to infer identity.
- `minimumSampleCount` must be a finite integer greater than or equal to 1. Values of `0`, negative numbers, fractional values, `NaN`, and infinities throw `BaselineConstructionError` with code `INVALID_MINIMUM_SAMPLE_COUNT`.
- Unavailable baselines are encoded as `available: false` with null statistic fields, retained counts, retained provenance, and `notes: 'The minimum sample threshold was not met.'`.
- Resource inclusion is exact: `observation.resourceId === requestedResourceId`. Other resources are excluded even if same actor or same feature name.
- Provenance remains canonical and deterministic: `sourceObservationIds` and `sourceEventIds` are sorted by timestamp and then by ID when timestamps tie, and they reflect the exact events used in the baseline summary.

### BaselineSnapshot

```ts
export interface BaselineSnapshot extends IdRecord {
  schemaVersion: SchemaVersion;
  actorEntityId: string;
  asOf: string;
  baselineType: 'PERSONAL' | 'PEER_COHORT' | 'RESOURCE';
  featureName: string;
  sampleCount: number;
  observationCount: number;
  median: number | null;
  mad: number | null;
  min: number | null;
  max: number | null;
  coverage: number;
  quality: DataQualityLevel;
  available: boolean;
  sourceObservationIds: string[];
  sourceEventIds: string[];
  cohortId?: string;
  resourceId?: string;
  timeRangeStart?: string;
  timeRangeEnd?: string;
  notes?: string;
}
```

## Shared primitive types

```ts
export type TelemetryDomain =
  | 'AUTHENTICATION'
  | 'FILE_RESOURCE_ACCESS'
  | 'PRIVILEGE_ACTIVITY';

export type OrganizationalContextType =
  | 'ROLE_CHANGE'
  | 'PROJECT_ASSIGNMENT'
  | 'APPROVED_TRAVEL'
  | 'MAINTENANCE_WINDOW'
  | 'TEMPORARY_ACCESS_GRANT';

export type ContextOutcome =
  | 'EXPLAINED'
  | 'PARTIALLY_EXPLAINED'
  | 'UNEXPLAINED'
  | 'INDETERMINATE';

export type DataQualityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface IdRecord {
  id: string;
}

export interface EvidenceId {
  id: string;
  sourceEventIds: string[];
  referenceType: 'EVENT' | 'BASELINE' | 'CONTEXT' | 'CHANGE_POINT' | 'RISK' | 'DECISION';
}

export interface DataQuality {
  qualityId: string;
  level: DataQualityLevel;
  missingFields: string[];
  incompleteContextCount: number;
  lowConfidenceSources: string[];
  notes?: string;
}
```

## Core entities

```ts
export interface Entity extends IdRecord {
  entityType: 'USER' | 'DEVICE' | 'RESOURCE' | 'ROLE' | 'GROUP' | 'DESTINATION' | 'APP';
  tenantId: string;
  displayName: string;
  pseudonymizedName?: string;
  attributes?: Record<string, unknown>;
}

export interface PeerCohort extends IdRecord {
  name: string;
  cohortType: 'ROLE' | 'TEAM' | 'PROJECT' | 'FUNCTION';
  memberEntityIds: string[];
  scope: string[];
}

export interface Resource extends IdRecord {
  resourceType: 'FILE' | 'FOLDER' | 'DB' | 'SERVICE' | 'API' | 'SITE' | 'OTHER';
  resourceName: string;
  ownerEntityId?: string;
  parentResourceId?: string;
  classification?: string;
  location?: string;
  version?: string;
}
```

## Event, fixture, and context structures

```ts
export interface SecurityEvent extends IdRecord {
  schemaVersion: 'silent-shift.v1';
  actorEntityId: string;
  timestamp: string;
  domain: TelemetryDomain;
  eventType: string;
  source: 'SYNTHETIC_REPLAY_FIXTURE';
  resourceId?: string;
  destinationEntityId?: string;
  deviceEntityId?: string;
  priorPrivilege?: string;
  newPrivilege?: string;
  action?: string;
  expectedVolume?: number;
  observedVolume?: number;
  outcome?: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  rawMetadata?: Record<string, unknown>;
}

export interface OrganizationalContextRecord extends IdRecord {
  schemaVersion: 'silent-shift.v1';
  actorEntityId?: string;
  recordType: OrganizationalContextType;
  validFrom: string;
  validTo: string;
  scope?: string[];
  approvalAuthorityEntityId?: string;
  rationale?: string;
  sourceEvidenceIds: string[];
}

export interface FeatureObservation extends IdRecord {
  schemaVersion: 'silent-shift.v1';
  eventIds: string[];
  actorEntityId: string;
  featureName: string;
  featureValue: number;
  observedAt: string;
  source: 'EVENT' | 'DERIVED';
}

export interface BaselineSnapshot extends IdRecord {
  schemaVersion: 'silent-shift.v1';
  actorEntityId: string;
  asOf: string;
  personalHistory: Record<string, number>;
  roleHistory: Record<string, number>;
  peerCohortHistory: Record<string, number>;
  resourceHistory: Record<string, number>;
  coverage: number;
  quality: DataQualityLevel;
  sourceEventIds: string[];
}
```

## Change points, sequences, and evidence

```ts
export interface ChangePoint extends IdRecord {
  schemaVersion: 'silent-shift.v1';
  actorEntityId: string;
  observedAt: string;
  featureName: string;
  rawDeviationScore: number;
  relatedEventIds: string[];
  evidenceId: string;
}

export interface ShiftSequence extends IdRecord {
  schemaVersion: 'silent-shift.v1';
  actorEntityId: string;
  changePointIds: string[];
  firstObservedAt: string;
  lastObservedAt: string;
  features: string[];
  relatedEventIds: string[];
  evidenceId: string;
}

export interface EvidenceItem extends IdRecord {
  schemaVersion: 'silent-shift.v1';
  sourceEventIds: string[];
  summary: string;
  evidenceType: 'EVENT' | 'FEATURE' | 'BASELINE' | 'CONTEXT' | 'CHANGE_POINT' | 'RISK';
  confidence: number; // 0..1, evidence confidence only
  narrativeEvidenceIds: string[];
}
```

### ShiftSequence and Evidence Identity Semantics
- **Stable Origin-Based Identity**: Sequence identity is anchored to the immutable origin of the sequence:
  - `sequence.id`: `sequence|silent-shift.v1|<actorEntityId>|<firstObservedAt>|<firstChangePointId>`
  - `evidenceId`: `evidence|sequence|silent-shift.v1|<actorEntityId>|<firstObservedAt>|<firstChangePointId>`
- **Monotonic Causal Extension**: As subsequent qualifying change points arrive, they append to the sequence. The `lastObservedAt`, `changePointIds`, `features`, and `relatedEventIds` fields extend monotonically, while `sequence.id` and `evidenceId` remain immutable.
- **Closed Sequence Immutability**: Once closed by the temporal gap policy (`maxTemporalGapMs`) or total span constraint (`maxSequenceSpanMs`), a sequence never re-opens. Later change points cannot alter closed sequences.
- **Distinct-Feature Gate**: A public `ShiftSequence` requires change points covering at least two distinct `featureName` values. Single-feature candidates remain internal proto-clusters and are not emitted.


## Context model

```ts
export interface ContextGrant extends IdRecord {
  schemaVersion: 'silent-shift.v1';
  actorEntityId: string;
  validFrom: string;
  validTo: string;
  resourceScope?: string[];
  actionScope?: string[];
  expectedVolume?: number;
  approvedDestinationIds?: string[];
  approvingAuthorityEntityId?: string;
  rationale?: string;
  sourceEvidenceIds: string[];
}

export interface ContextMatch extends IdRecord {
  schemaVersion: 'silent-shift.v1';
  contextGrantId: string;
  changePointId: string;
  matchedEvidenceIds: string[];
  unmatchedEvidenceIds: string[];
  outcome: ContextOutcome;
  notes: string;
}

export type ContextMatchReason =
  | 'MATCHED'
  | 'NO_APPLICABLE_CONTEXT'
  | 'TEMPORAL_MISMATCH'
  | 'ACTOR_MISMATCH'
  | 'RESOURCE_MISMATCH'
  | 'OPERATION_MISMATCH'
  | 'INSUFFICIENT_EVIDENCE';

export type CompatibilityTriState = 'COMPATIBLE' | 'INCOMPATIBLE' | 'INDETERMINATE';

export type ContextReconciliationState =
  | 'EXPLAINED'
  | 'PARTIALLY_EXPLAINED'
  | 'UNEXPLAINED'
  | 'INDETERMINATE';

export interface ChangePointContextMatch {
  readonly changePointId: string;
  readonly matched: boolean;
  readonly matchedGrantIds: readonly string[];
  readonly temporalOverlap: CompatibilityTriState;
  readonly scopeCompatible: CompatibilityTriState;
  readonly matchReason: ContextMatchReason;
}

export interface ContextReconciliationResult extends IdRecord {
  readonly sequenceId: string;
  readonly actorEntityId: string;
  readonly reconciliationState: ContextReconciliationState;
  readonly matchedGrantIds: readonly string[];
  readonly changePointMatches: readonly ChangePointContextMatch[];
  readonly evidenceItem: EvidenceItem;
  readonly coveredEventIds: readonly string[];
  readonly uncoveredEventIds: readonly string[];
}
```

### Milestone 6 Context Reconciliation Semantics
- **Source Event Truth**: Source `SecurityEvent` records are authoritative for actual resources and actions. Reconciliation inspects resolved contributing events, not heuristic feature-name strings.
- **ContextType vs. Authorization Separation**: Organizational context types (such as `MAINTENANCE_WINDOW` or `ROLE_CHANGE`) describe administrative purpose and do not confer implicit technical operational authorization. Technical operations are governed strictly by `authorizedOperations` / `actionScope`.
- **Tri-State Compatibility**: `CompatibilityTriState` (`'COMPATIBLE' | 'INCOMPATIBLE' | 'INDETERMINATE'`) avoids falsely encoding missing information as incompatible.
- **Sequence Aggregation Truth Table**:
  - `EXPLAINED`: All constituent change points are `MATCHED`.
  - `PARTIALLY_EXPLAINED`: At least one change point is `MATCHED`, and at least one is deterministically unmatched.
  - `UNEXPLAINED`: No constituent change point is `MATCHED`, and compatibility was deterministically evaluated.
  - `INDETERMINATE`: Any constituent change point evaluates to `INDETERMINATE` (structural uncertainty propagates conservatively).
- **Conservative Mixed-Event Policy**: If a single `ChangePoint` contains multiple contributing events where some are authorized and some are unauthorized, the change point is treated as not fully matched. Fractional splitting of change points is prohibited in Milestone 6.
- **Valid-Time vs Knowledge-Time**: Reconciliation enforces strict valid-time temporal causality at evaluation time $T$ ($t_{\text{validFrom}} \le T$, with closed interval $[t_{\text{validFrom}}, t_{\text{validUntil}}]$). Because the canonical `ContextGrant` schema lacks ingestion timestamps (`recordedAt`, `ingestedAt`), knowledge-time causality cannot be verified. This is documented as a known schema limitation.
- **EvidenceItem Discipline**: `sourceEventIds` contains exclusively canonical `SecurityEvent` IDs. Contributing context grants and sequences are referenced structurally via `narrativeEvidenceIds`. Summary text is strictly deterministic and non-evaluative.

## Risk and case model

```ts
export interface RiskAssessment extends IdRecord {
  schemaVersion: 'silent-shift.v1';
  caseId: string;
  relatedChangePointIds: string[];
  rawDeviation: number;
  contextCoverage: number;
  residualRisk: number;
  confidence: number; // evidence confidence only; not probability of malicious intent
  dataQuality: DataQuality;
  contextOutcome: ContextOutcome;
  sourceEvidenceIds: string[];
  coveredEvidenceIds: string[];
  uncoveredEvidenceIds: string[];
  narrativeEvidenceIds: string[];
}

export interface InvestigationCase extends IdRecord {
  schemaVersion: 'silent-shift.v1';
  actorEntityId: string;
  createdAt: string;
  contextOutcome: ContextOutcome;
  riskAssessmentId: string;
  evidenceIds: string[];
  relatedChangePointIds: string[];
  analystDecisionIds: string[];
  prototypeSessionId?: string;
}
```

### Milestone 7 Risk Composition Semantics
- **Separation of 5 Core Dimensions**: `rawDeviation`, `contextCoverage`, `residualRisk`, `confidence`, and `dataQuality` remain strictly separate per `AT-RISK-001`.
- **Soft-Saturation Aggregation**: Individual change-point deviation scores $z$ are normalized into $[0, 1)$ via $s(z) = 1.0 - \frac{1.0}{1.0 + z / z_0}$ with $z_0 = 3.0$ (canonical detection threshold). Multiple change points are aggregated sub-additively via $1.0 - \prod_{c_i} (1.0 - s(c_i))$.
  - `rawDeviation`: Aggregates all constituent change points of the sequence.
  - `residualRisk`: Aggregates exclusively residual (uncovered and indeterminate) change points.
- **Context Coverage Ratio**: Computed strictly as $\frac{\text{coveredChangePointIds.length}}{\text{relatedChangePointIds.length}}$ for the assessed sequence.
- **Structural Confidence**:
  $$\text{confidence} = \text{eventCompletenessRatio} \times \text{contextCertaintyRatio}$$
  where $\text{eventCompletenessRatio} = \frac{\text{resolvedSourceEvents}}{\text{totalRequiredEvents}}$ and $\text{contextCertaintyRatio} = \frac{\text{determinsticEvaluableCPs}}{\text{totalCPs}}$.
- **Structural Data Quality**: `DataQuality.level` is derived structurally without arbitrary numerical percentage cutoffs:
  - `HIGH`: All required source events resolve and zero indeterminate context matches exist.
  - `LOW`: One or more required source events are missing or context match is `INSUFFICIENT_EVIDENCE`.
- **Pre-M8 Case Identity**: `RiskAssessment.caseId` is set to `ShiftSequence.id`.
- **Outcome States**:
  - `EXPLAINED`: `contextCoverage = 1.0`, `residualRisk = 0.0`, while `rawDeviation` preserves observed behavioral magnitude. Context describes operational authorization, not human intent.
  - `PARTIALLY_EXPLAINED`: `residualRisk` is composed directly from the specific uncovered change points.
  - `UNEXPLAINED`: `contextCoverage = 0.0`, `residualRisk = rawDeviation`.
  - `INDETERMINATE`: Unresolved change points remain in residual risk without uncertainty penalties; uncertainty is reflected through downgraded confidence and data quality.
- **Deterministic Fallback Explainer**: Implements `AT-EXPLAIN-001` producing inspectable, repeatable text without an LLM. Banned subjective labels (`malicious`, `benign`, `safe`, `innocent`, `guilty`, `suspicious`, `rogue`, `attack`, `critical`, `high risk`) are strictly omitted.
- **Known Limitations (v1)**: Multiple derived change points sharing identical source events contribute sub-additively via diminishing returns rather than linear inflation, but are not collapsed into a single feature.


## Analyst decision and audit log

```ts
export interface AnalystDecision extends IdRecord {
  schemaVersion: 'silent-shift.v1';
  caseId: string;
  actorEntityId: string;
  decision: 'NO_ACTION' | 'ESCALATE' | 'REQUEST_CONTEXT' | 'CLOSE' | 'REVIEW_LATER';
  rationale: string;
  evidenceIds: string[];
  timestamp: string;
}

export interface AuditEvent extends IdRecord {
  schemaVersion: 'silent-shift.v1';
  eventType: 'CASE_CREATED' | 'CONTEXT_CORRECTION' | 'DECISION_LOGGED' | 'CASE_REOPENED' | 'CASE_UPDATED';
  caseId?: string;
  decisionId?: string;
  actorEntityId?: string;
  description: string;
  evidenceIds: string[];
  createdAt: string;
}
```

## Milestone 8: Case Management, Alert Ranking, and Auditability Semantics
- **Ranking Tuple**: Deterministic 4-element orthogonal tuple:
  `⟨residualRisk (desc), confidence (desc), createdAt (desc), case.id (asc)⟩`.
  ContextOutcome is not double-scored in ranking. No arbitrary weights, score multipliers, or severity bands.
- **Audit Event Extension**: `CASE_UPDATED` records causal sequence extension on an existing case without erasing prior analyst decisions or closing/reopening the case.
- **Derived Lifecycle**: Case status is deterministically derived from append-only `AnalystDecision[]` history (`NEW`, `PENDING_REVIEW`, `CONTEXT_REQUESTED`, `ESCALATED`, `CLOSED_NO_ACTION`, `CLOSED`, `REOPENED`).
- **Idempotency**: All human/system actions require caller-supplied action IDs. Duplicate submissions with identical action IDs are idempotent no-ops.
- **Pseudonymization**: Case and audit records enforce pseudonymous actor identifiers (`USER-ALICE`, `USR-042`, `ANALYST-101`, `system`). Raw full names and email addresses are rejected (`AT-PRIV-001`).

## Required invariants
- Every important record must have a stable ID.
- Evidence must reference source event IDs.
- Narratives must reference evidence IDs.
- Context matches must identify exactly which evidence was covered.
- RiskAssessment must contain separate rawDeviation, contextCoverage, residualRisk, confidence and dataQuality fields.
- Historical raw evidence must never be erased when context or analyst corrections are recorded.
- Confidence must not be described as a probability of malicious intent.
- Context outcome states must be explicit and not inferred from arbitrary percentage thresholds.
- Prototype data must be session-scoped; durable storage is PLANNED.
- `schemaVersion` must remain `"silent-shift.v1"` across fixture and domain objects.
- Pseudonymous identifiers are used by default for case and audit display after Milestone 8 and in visual display by Milestone 10.

## Milestone 9: Offline Evaluation, Benchmark Reporting, and Claim Register
- **Claim Status Taxonomy**: All public claims must hold an unambiguous disposition from the 6 approved statuses:
  `VERIFIED_IN_FIXTURES`, `SIMULATED`, `PLANNED`, `EXPERIMENTAL`, `OUT_OF_SCOPE`, `REJECTED_UNSUPPORTED`.
- **Immutability of ProductClaim**: The static claim register (`ProductClaim`) is strictly immutable. Dynamic execution outputs are captured in separate `ClaimEvaluationResult` records. Failed benchmarks transition effective status to `REJECTED_UNSUPPORTED` with diagnostic information.
- **Verification Scope**: Claims marked `VERIFIED_IN_FIXTURES` declare `verificationScope: 'SYNTHETIC_FIXTURES_ONLY'` and `requiresExternalValidation: true`. Fixture verification does not imply or measure live enterprise performance.
- **Declarative Expectations**: Benchmark expectations are serializable, inspectable data constraints (`EQUALS`, `GREATER_THAN`, `BETWEEN_EXCLUSIVE`, etc.) rather than opaque executable functions.
- **Non-Marketing Aggregate Metrics**:
  - `ScenarioExpectationPassRate = passing registered scenarios / registered scenarios`
  - `ContextOutcomeExpectationAgreementRate = scenarios whose computed outcome equals expected outcome / registered scenarios`
  - `EvidenceResolutionRate = resolved expected SecurityEvent IDs / expected SecurityEvent IDs`
  - `CaseConstructionExpectationPassRate = correctly constructed expected cases / expected cases`
  - `AuditActionExpectationPassRate = correctly emitted expected audit actions / expected audit actions`
  - `PrivacyComplianceRate = pseudonymous expected actor identifiers / expected actor identifiers`
- **Zero-Denominator Rule**: Any metric with a zero denominator returns `null` (rendered as `"N/A"`), never `1.0` or `100%`.

## Resolved schema decision
The fixture schema version is now resolved to:

```ts
schemaVersion: "silent-shift.v1"
```

## Open schema decisions
The following items remain unresolved and require approval before implementation:
- retention defaults after the demo session
- thresholds for alert-budget ranking once scoring exists
- final analyst decision taxonomy extensions
- exact pseudonymization rules for demo and production-facing presentations
