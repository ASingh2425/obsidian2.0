/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  SCHEMA_VERSION,
  type AnalystDecision,
  type AuditEvent,
  type InvestigationCase,
} from '../types';
import { assertPseudonymousId } from './privacy';
import type {
  CreateCaseParams,
  DerivedCaseStatus,
  ProposeContextCorrectionParams,
  RecordDecisionParams,
  ReopenCaseParams,
  UpdateCaseParams,
} from './types';

/**
 * Derives the lifecycle state of an InvestigationCase deterministically
 * from its append-only AnalystDecision history.
 */
export const deriveCaseStatus = (
  decisions: readonly AnalystDecision[],
): DerivedCaseStatus => {
  if (decisions.length === 0) {
    return 'NEW';
  }

  // Decisions are sorted canonically by timestamp asc, then id asc
  const sorted = [...decisions].sort((a, b) => {
    const diff = Date.parse(a.timestamp) - Date.parse(b.timestamp);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  const latest = sorted[sorted.length - 1];

  switch (latest.decision) {
    case 'REVIEW_LATER':
      return 'PENDING_REVIEW';
    case 'REQUEST_CONTEXT':
      return 'CONTEXT_REQUESTED';
    case 'ESCALATE':
      return 'ESCALATED';
    case 'NO_ACTION':
      return 'CLOSED_NO_ACTION';
    case 'CLOSE':
      return 'CLOSED';
    default:
      return 'NEW';
  }
};

/**
 * Constructs an InvestigationCase from an M7 RiskAssessment and ShiftSequence.
 * Emits an initial CASE_CREATED AuditEvent.
 */
export const constructInvestigationCase = (
  params: CreateCaseParams,
): { investigationCase: InvestigationCase; auditEvent: AuditEvent } => {
  const { sequence, riskAssessment, evaluationTime, actionId } = params;

  assertPseudonymousId(sequence.actorEntityId, 'sequence.actorEntityId');
  if (!actionId || typeof actionId !== 'string') {
    throw new Error('Action ID is required for case construction idempotency');
  }

  const caseId = `case|${sequence.id}`;

  // Canonical compound evidenceIds: sequence evidence, change point evidence, narrative evidence
  // All canonical structural and analytical IDs, deduplicated and sorted
  const evidenceIds = [
    sequence.evidenceId,
    ...riskAssessment.relatedChangePointIds.map((cpId) => `evidence|${cpId}`),
    ...riskAssessment.narrativeEvidenceIds,
  ];
  const uniqueEvidenceIds = [...new Set(evidenceIds)].sort();

  const investigationCase: InvestigationCase = {
    id: caseId,
    schemaVersion: SCHEMA_VERSION,
    actorEntityId: sequence.actorEntityId,
    createdAt: evaluationTime, // knowledge-time cutoff
    contextOutcome: riskAssessment.contextOutcome,
    riskAssessmentId: riskAssessment.id,
    evidenceIds: uniqueEvidenceIds,
    relatedChangePointIds: [...riskAssessment.relatedChangePointIds],
    analystDecisionIds: [],
    prototypeSessionId: undefined,
  };

  const auditEvent: AuditEvent = {
    id: `audit|case-created|${actionId}`,
    schemaVersion: SCHEMA_VERSION,
    eventType: 'CASE_CREATED',
    caseId,
    actorEntityId: 'system',
    description: `Investigation case created for sequence ${sequence.id} with outcome ${riskAssessment.contextOutcome} and residual risk ${riskAssessment.residualRisk.toFixed(4)}.`,
    evidenceIds: uniqueEvidenceIds,
    createdAt: evaluationTime,
  };

  return { investigationCase, auditEvent };
};

/**
 * Updates an InvestigationCase when an open sequence receives new causal evidence.
 * Emits an immutable CASE_UPDATED AuditEvent without erasing prior decisions.
 */
export const updateInvestigationCase = (
  params: UpdateCaseParams,
): { updatedCase: InvestigationCase; auditEvent: AuditEvent } => {
  const { existingCase, sequence, updatedRiskAssessment, evaluationTime, actionId } = params;

  if (!actionId || typeof actionId !== 'string') {
    throw new Error('Action ID is required for case update idempotency');
  }

  // Combine newly included change point and narrative evidence IDs
  const combinedEvidenceIds = [
    ...existingCase.evidenceIds,
    ...updatedRiskAssessment.relatedChangePointIds.map((cpId) => `evidence|${cpId}`),
    ...updatedRiskAssessment.narrativeEvidenceIds,
  ];
  const uniqueEvidenceIds = [...new Set(combinedEvidenceIds)].sort();

  // Find newly added change point IDs
  const priorCpSet = new Set(existingCase.relatedChangePointIds);
  const newlyAddedCpIds = updatedRiskAssessment.relatedChangePointIds.filter((id) => !priorCpSet.has(id));

  const updatedCase: InvestigationCase = {
    ...existingCase,
    contextOutcome: updatedRiskAssessment.contextOutcome,
    riskAssessmentId: updatedRiskAssessment.id,
    evidenceIds: uniqueEvidenceIds,
    relatedChangePointIds: [...updatedRiskAssessment.relatedChangePointIds],
    // Prior decision IDs are strictly preserved
    analystDecisionIds: [...existingCase.analystDecisionIds],
  };

  const auditEvent: AuditEvent = {
    id: `audit|case-updated|${actionId}`,
    schemaVersion: SCHEMA_VERSION,
    eventType: 'CASE_UPDATED',
    caseId: existingCase.id,
    actorEntityId: 'system',
    description: `Investigation case updated for open sequence ${sequence.id}. Newly added change points: [${newlyAddedCpIds.join(', ')}]. Updated outcome: ${updatedRiskAssessment.contextOutcome}, updated residual risk: ${updatedRiskAssessment.residualRisk.toFixed(4)}.`,
    evidenceIds: uniqueEvidenceIds,
    createdAt: evaluationTime,
  };

  return { updatedCase, auditEvent };
};

/**
 * Records an AnalystDecision and emits a corresponding DECISION_LOGGED AuditEvent.
 */
export const recordAnalystDecision = (
  params: RecordDecisionParams,
  existingCase: InvestigationCase,
): { decision: AnalystDecision; updatedCase: InvestigationCase; auditEvent: AuditEvent } => {
  const { caseId, actorEntityId, decision, rationale, evidenceIds, timestamp, actionId } = params;

  assertPseudonymousId(actorEntityId, 'actorEntityId');
  if (!actionId || typeof actionId !== 'string') {
    throw new Error('Action ID is required for decision recording idempotency');
  }
  if (!rationale || rationale.trim().length === 0) {
    throw new Error('Decision rationale is required');
  }

  const decisionId = `decision|${actionId}`;

  const analystDecision: AnalystDecision = {
    id: decisionId,
    schemaVersion: SCHEMA_VERSION,
    caseId,
    actorEntityId,
    decision,
    rationale: rationale.trim(),
    evidenceIds: [...evidenceIds].sort(),
    timestamp,
  };

  const updatedDecisionIds = existingCase.analystDecisionIds.includes(decisionId)
    ? existingCase.analystDecisionIds
    : [...existingCase.analystDecisionIds, decisionId];

  const updatedCase: InvestigationCase = {
    ...existingCase,
    analystDecisionIds: updatedDecisionIds,
  };

  const auditEvent: AuditEvent = {
    id: `audit|decision-logged|${actionId}`,
    schemaVersion: SCHEMA_VERSION,
    eventType: 'DECISION_LOGGED',
    caseId,
    decisionId,
    actorEntityId,
    description: `Analyst decision '${decision}' logged by ${actorEntityId}. Rationale: ${rationale.trim()}`,
    evidenceIds: [...evidenceIds].sort(),
    createdAt: timestamp,
  };

  return { decision: analystDecision, updatedCase, auditEvent };
};

/**
 * Records an analyst's proposal for context correction.
 * Emits an immutable CONTEXT_CORRECTION AuditEvent without modifying raw domain baselines.
 */
export const proposeContextCorrection = (
  params: ProposeContextCorrectionParams,
): AuditEvent => {
  const { caseId, actorEntityId, proposedGrantDescription, evidenceIds, timestamp, actionId } = params;

  assertPseudonymousId(actorEntityId, 'actorEntityId');
  if (!actionId || typeof actionId !== 'string') {
    throw new Error('Action ID is required for context correction idempotency');
  }
  if (!proposedGrantDescription || proposedGrantDescription.trim().length === 0) {
    throw new Error('Proposed context correction description is required');
  }

  return {
    id: `audit|context-correction|${actionId}`,
    schemaVersion: SCHEMA_VERSION,
    eventType: 'CONTEXT_CORRECTION',
    caseId,
    actorEntityId,
    description: `Proposed context correction: ${proposedGrantDescription.trim()}`,
    evidenceIds: [...evidenceIds].sort(),
    createdAt: timestamp,
  };
};

/**
 * Reopens a closed investigation case.
 * Emits a CASE_REOPENED AuditEvent and appends a REVIEW_LATER decision with the reopening rationale.
 */
export const reopenCase = (
  params: ReopenCaseParams,
  existingCase: InvestigationCase,
  currentDecisions: readonly AnalystDecision[],
): { decision: AnalystDecision; updatedCase: InvestigationCase; auditEvent: AuditEvent } => {
  const { caseId, actorEntityId, rationale, timestamp, actionId } = params;

  assertPseudonymousId(actorEntityId, 'actorEntityId');
  if (!actionId || typeof actionId !== 'string') {
    throw new Error('Action ID is required for reopen idempotency');
  }
  if (!rationale || rationale.trim().length === 0) {
    throw new Error('Reopen rationale is required');
  }

  const currentStatus = deriveCaseStatus(currentDecisions);
  if (currentStatus !== 'CLOSED' && currentStatus !== 'CLOSED_NO_ACTION') {
    throw new Error(`Cannot reopen case ${caseId} because its current status is '${currentStatus}'. Only closed cases may be reopened.`);
  }

  const decisionId = `decision|reopen|${actionId}`;

  const decision: AnalystDecision = {
    id: decisionId,
    schemaVersion: SCHEMA_VERSION,
    caseId,
    actorEntityId,
    decision: 'REVIEW_LATER',
    rationale: `Case reopened: ${rationale.trim()}`,
    evidenceIds: [...existingCase.evidenceIds],
    timestamp,
  };

  const updatedCase: InvestigationCase = {
    ...existingCase,
    analystDecisionIds: [...existingCase.analystDecisionIds, decisionId],
  };

  const auditEvent: AuditEvent = {
    id: `audit|case-reopened|${actionId}`,
    schemaVersion: SCHEMA_VERSION,
    eventType: 'CASE_REOPENED',
    caseId,
    decisionId,
    actorEntityId,
    description: `Case reopened by ${actorEntityId}. Rationale: ${rationale.trim()}`,
    evidenceIds: [...existingCase.evidenceIds],
    createdAt: timestamp,
  };

  return { decision, updatedCase, auditEvent };
};
