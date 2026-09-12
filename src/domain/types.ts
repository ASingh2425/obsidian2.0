export const SCHEMA_VERSION = 'silent-shift.v1' as const;

export type SchemaVersion = typeof SCHEMA_VERSION;

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

export interface EvidenceId extends IdRecord {
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

export interface SecurityEvent extends IdRecord {
  schemaVersion: SchemaVersion;
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
  schemaVersion: SchemaVersion;
  actorEntityId?: string;
  recordType: OrganizationalContextType;
  validFrom: string;
  validTo: string;
  scope?: string[];
  approvalAuthorityEntityId?: string;
  rationale?: string;
  sourceEvidenceIds: string[];
}

export interface ContextGrant extends IdRecord {
  schemaVersion: SchemaVersion;
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

export interface FeatureObservation extends IdRecord {
  schemaVersion: SchemaVersion;
  eventIds: string[];
  actorEntityId: string;
  featureName: string;
  featureValue: number;
  observedAt: string;
  source: 'EVENT' | 'DERIVED';
}

export type BaselineType = 'PERSONAL' | 'PEER_COHORT' | 'RESOURCE';

export interface BaselineSnapshot extends IdRecord {
  schemaVersion: SchemaVersion;
  actorEntityId: string;
  asOf: string;
  baselineType: BaselineType;
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

export interface ChangePoint extends IdRecord {
  schemaVersion: SchemaVersion;
  actorEntityId: string;
  observedAt: string;
  featureName: string;
  rawDeviationScore: number;
  relatedEventIds: string[];
  evidenceId: string;
}

export interface ShiftSequence extends IdRecord {
  schemaVersion: SchemaVersion;
  actorEntityId: string;
  changePointIds: string[];
  firstObservedAt: string;
  lastObservedAt: string;
  features: string[];
  relatedEventIds: string[];
  evidenceId: string;
}

export interface EvidenceItem extends IdRecord {
  schemaVersion: SchemaVersion;
  sourceEventIds: string[];
  summary: string;
  evidenceType: 'EVENT' | 'FEATURE' | 'BASELINE' | 'CONTEXT' | 'CHANGE_POINT' | 'RISK';
  confidence: number;
  narrativeEvidenceIds: string[];
}

export interface ContextMatch extends IdRecord {
  schemaVersion: SchemaVersion;
  contextGrantId: string;
  changePointId: string;
  matchedEvidenceIds: string[];
  unmatchedEvidenceIds: string[];
  outcome: ContextOutcome;
  notes: string;
}

export interface RiskAssessment extends IdRecord {
  schemaVersion: SchemaVersion;
  caseId: string;
  relatedChangePointIds: string[];
  rawDeviation: number;
  contextCoverage: number;
  residualRisk: number;
  confidence: number;
  dataQuality: DataQuality;
  contextOutcome: ContextOutcome;
  sourceEvidenceIds: string[];
  coveredEvidenceIds: string[];
  uncoveredEvidenceIds: string[];
  narrativeEvidenceIds: string[];
}

export interface InvestigationCase extends IdRecord {
  schemaVersion: SchemaVersion;
  actorEntityId: string;
  createdAt: string;
  contextOutcome: ContextOutcome;
  riskAssessmentId: string;
  evidenceIds: string[];
  relatedChangePointIds: string[];
  analystDecisionIds: string[];
  prototypeSessionId?: string;
}

export interface AnalystDecision extends IdRecord {
  schemaVersion: SchemaVersion;
  caseId: string;
  actorEntityId: string;
  decision: 'NO_ACTION' | 'ESCALATE' | 'REQUEST_CONTEXT' | 'CLOSE' | 'REVIEW_LATER';
  rationale: string;
  evidenceIds: string[];
  timestamp: string;
}

export interface AuditEvent extends IdRecord {
  schemaVersion: SchemaVersion;
  eventType: 'CASE_CREATED' | 'CONTEXT_CORRECTION' | 'DECISION_LOGGED' | 'CASE_REOPENED' | 'CASE_UPDATED';
  caseId?: string;
  decisionId?: string;
  actorEntityId?: string;
  description: string;
  evidenceIds: string[];
  createdAt: string;
}

export interface ScenarioMetadata {
  name: string;
  category: string;
  synthetic: boolean;
  syntheticDisclosure: string;
  expectedClassification?: ContextOutcome | 'EXPLAINED' | 'PARTIALLY_EXPLAINED' | 'UNEXPLAINED' | 'INDETERMINATE';
  notes?: string;
}

export interface ScenarioFixture extends IdRecord {
  schemaVersion: SchemaVersion;
  metadata: ScenarioMetadata;
  entities: Entity[];
  resources: Resource[];
  events: SecurityEvent[];
  contextRecords: OrganizationalContextRecord[];
  contextGrants: ContextGrant[];
  contextMatches?: ContextMatch[];
}

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
