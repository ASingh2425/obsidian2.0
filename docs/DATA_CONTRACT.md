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

## Change points and evidence

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

export interface EvidenceItem extends IdRecord {
  schemaVersion: 'silent-shift.v1';
  sourceEventIds: string[];
  summary: string;
  evidenceType: 'EVENT' | 'FEATURE' | 'BASELINE' | 'CONTEXT' | 'CHANGE_POINT' | 'RISK';
  confidence: number; // 0..1, evidence confidence only
  narrativeEvidenceIds: string[];
}
```

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
```

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
  eventType: 'CASE_CREATED' | 'CONTEXT_CORRECTION' | 'DECISION_LOGGED' | 'CASE_REOPENED';
  caseId?: string;
  decisionId?: string;
  actorEntityId?: string;
  description: string;
  evidenceIds: string[];
  createdAt: string;
}
```

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
