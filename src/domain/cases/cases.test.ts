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

import { describe, expect, it } from 'vitest';

import {
  SCHEMA_VERSION,
  type AnalystDecision,
  type ChangePoint,
  type ContextGrant,
  type RiskAssessment,
  type SecurityEvent,
  type ShiftSequence,
} from '../types';
import { reconcileContext } from '../context';
import { composeRiskAssessment } from '../risk';
import {
  AuditTrail,
  constructInvestigationCase,
  deriveCaseStatus,
  isValidPseudonymousId,
  proposeContextCorrection,
  rankInvestigationCases,
  recordAnalystDecision,
  reopenCase,
  updateInvestigationCase,
} from './index';

// Helper constructors
const createEvent = (
  id: string,
  actorEntityId: string,
  timestamp: string,
  domain: SecurityEvent['domain'] = 'FILE_RESOURCE_ACCESS',
  action = 'READ',
  resourceId = 'RES-01',
): SecurityEvent => ({
  id,
  schemaVersion: SCHEMA_VERSION,
  actorEntityId,
  timestamp,
  domain,
  eventType: 'RESOURCE_ACCESS',
  source: 'SYNTHETIC_REPLAY_FIXTURE',
  action,
  resourceId,
});

const createChangePoint = (
  id: string,
  actorEntityId: string,
  observedAt: string,
  featureName = 'read_count',
  relatedEventIds = ['ev-1'],
  rawDeviationScore = 4.0,
): ChangePoint => ({
  id,
  schemaVersion: SCHEMA_VERSION,
  actorEntityId,
  observedAt,
  featureName,
  rawDeviationScore,
  relatedEventIds,
  evidenceId: `evidence|${id}`,
});

const createSequence = (
  id: string,
  actorEntityId: string,
  changePoints: ChangePoint[],
): ShiftSequence => {
  const sorted = [...changePoints].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    actorEntityId,
    changePointIds: sorted.map((cp) => cp.id),
    firstObservedAt: sorted[0].observedAt,
    lastObservedAt: sorted[sorted.length - 1].observedAt,
    features: [...new Set(sorted.map((cp) => cp.featureName))],
    relatedEventIds: [...new Set(sorted.flatMap((cp) => cp.relatedEventIds))],
    evidenceId: `evidence|seq|${id}`,
  };
};

const setupRisk = (
  sequence: ShiftSequence,
  changePoints: ChangePoint[],
  events: SecurityEvent[],
  grants: ContextGrant[] = [],
): RiskAssessment => {
  const reconciliations = reconcileContext({
    sequences: [sequence],
    changePoints,
    contextGrants: grants,
    sourceEvents: events,
  });

  return composeRiskAssessment({
    sequence,
    reconciliation: reconciliations[0],
    changePoints,
    sourceEvents: events,
  });
};

describe('Milestone 8: Case Management, Alert Ranking, Analyst Decisions, and Audit Logging', () => {
  // Test 1: AT-CASE-001: InvestigationCase construction retains risk object, evidence IDs, and raw deviation remains visible
  it('AT-CASE-001: constructs investigation case with linked risk assessment and preserves raw evidence visibility', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z');
    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1'], 5.0);
    const seq = createSequence('seq-1', 'USER-ALICE', [cp1]);
    const risk = setupRisk(seq, [cp1], [ev1]);

    const { investigationCase, auditEvent } = constructInvestigationCase({
      sequence: seq,
      riskAssessment: risk,
      evaluationTime: '2026-04-10T12:00:00Z',
      actionId: 'action-case-create-001',
    });

    expect(investigationCase.id).toBe('case|seq-1');
    expect(investigationCase.riskAssessmentId).toBe('risk|seq|seq-1');
    expect(investigationCase.actorEntityId).toBe('USER-ALICE');
    expect(investigationCase.createdAt).toBe('2026-04-10T12:00:00Z'); // knowledge-time
    expect(investigationCase.relatedChangePointIds).toEqual(['cp-1']);
    expect(investigationCase.analystDecisionIds).toEqual([]);

    // Raw evidence remains accessible through the linked RiskAssessment
    expect(risk.rawDeviation).toBeGreaterThan(0);
    expect(risk.sourceEvidenceIds).toEqual(['ev-1']);

    // Emits initial CASE_CREATED AuditEvent
    expect(auditEvent.eventType).toBe('CASE_CREATED');
    expect(auditEvent.caseId).toBe('case|seq-1');
    expect(auditEvent.actorEntityId).toBe('system');
  });

  // Test 2: AT-ALERT-001: Deterministic alert ranking reflects residual risk and confidence without double-scoring outcome
  it('AT-ALERT-001: deterministically ranks cases by residualRisk desc, confidence desc, createdAt desc, and case.id asc', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z');

    // Case A: High residual risk (0.80), high confidence (1.0)
    const cpA = createChangePoint('cp-a', 'USER-ALICE', '2026-04-10T10:00:00Z', 'f1', ['ev-1'], 8.0);
    const seqA = createSequence('seq-a', 'USER-ALICE', [cpA]);
    const riskA = setupRisk(seqA, [cpA], [ev1]);
    const { investigationCase: caseA } = constructInvestigationCase({
      sequence: seqA,
      riskAssessment: riskA,
      evaluationTime: '2026-04-10T11:00:00Z',
      actionId: 'act-a',
    });

    // Case B: Moderate residual risk (0.50), high confidence (1.0)
    const cpB = createChangePoint('cp-b', 'USER-BOB', '2026-04-10T10:00:00Z', 'f2', ['ev-1'], 3.0);
    const seqB = createSequence('seq-b', 'USER-BOB', [cpB]);
    const riskB = setupRisk(seqB, [cpB], [ev1]);
    const { investigationCase: caseB } = constructInvestigationCase({
      sequence: seqB,
      riskAssessment: riskB,
      evaluationTime: '2026-04-10T11:00:00Z',
      actionId: 'act-b',
    });

    // Case C: Same residual risk as B (0.50), but lower confidence (missing event)
    const cpC = createChangePoint('cp-c', 'USER-CHARLIE', '2026-04-10T10:00:00Z', 'f2', ['ev-missing'], 3.0);
    const seqC = createSequence('seq-c', 'USER-CHARLIE', [cpC]);
    const riskC = setupRisk(seqC, [cpC], [ev1]); // ev-missing not in sourceEvents
    const { investigationCase: caseC } = constructInvestigationCase({
      sequence: seqC,
      riskAssessment: riskC,
      evaluationTime: '2026-04-10T11:00:00Z',
      actionId: 'act-c',
    });

    // Case D: Zero residual risk (fully explained), high raw deviation
    const grant = {
      id: 'grant-1',
      schemaVersion: SCHEMA_VERSION,
      actorEntityId: 'USER-DAVE',
      validFrom: '2026-04-10T08:00:00Z',
      validTo: '2026-04-10T18:00:00Z',
      resourceScope: ['RES-01'],
      actionScope: ['READ'],
      sourceEvidenceIds: ['src-1'],
    };
    const evD = createEvent('ev-d', 'USER-DAVE', '2026-04-10T10:00:00Z');
    const cpD = createChangePoint('cp-d', 'USER-DAVE', '2026-04-10T10:00:00Z', 'f1', ['ev-d'], 15.0);
    const seqD = createSequence('seq-d', 'USER-DAVE', [cpD]);
    const riskD = setupRisk(seqD, [cpD], [evD], [grant]);
    const { investigationCase: caseD } = constructInvestigationCase({
      sequence: seqD,
      riskAssessment: riskD,
      evaluationTime: '2026-04-10T11:00:00Z',
      actionId: 'act-d',
    });

    const candidates = [
      { investigationCase: caseD, riskAssessment: riskD, decisions: [] },
      { investigationCase: caseB, riskAssessment: riskB, decisions: [] },
      { investigationCase: caseA, riskAssessment: riskA, decisions: [] },
      { investigationCase: caseC, riskAssessment: riskC, decisions: [] },
    ];

    const ranked = rankInvestigationCases(candidates);

    // Expected order:
    // 1: Case A (highest residual risk)
    // 2: Case B (moderate residual risk, confidence = 1.0)
    // 3: Case C (moderate residual risk, confidence < 1.0)
    // 4: Case D (residual risk = 0.0, despite large raw deviation)
    expect(ranked.map((r) => r.investigationCase.id)).toEqual([
      'case|seq-a',
      'case|seq-b',
      'case|seq-c',
      'case|seq-d',
    ]);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[3].rank).toBe(4);

    // Verify shuffle invariance
    const shuffled = [candidates[2], candidates[0], candidates[3], candidates[1]];
    const rankedShuffled = rankInvestigationCases(shuffled);
    expect(rankedShuffled.map((r) => r.investigationCase.id)).toEqual(ranked.map((r) => r.investigationCase.id));
  });

  // Test 3: AT-DECIDE-001: Analyst decision stored with case, rationale retained, append-only
  it('AT-DECIDE-001: records analyst decisions with rationale and evidence references append-only', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z');
    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1'], 5.0);
    const seq = createSequence('seq-1', 'USER-ALICE', [cp1]);
    const risk = setupRisk(seq, [cp1], [ev1]);

    const { investigationCase } = constructInvestigationCase({
      sequence: seq,
      riskAssessment: risk,
      evaluationTime: '2026-04-10T12:00:00Z',
      actionId: 'act-1',
    });

    const { decision, updatedCase, auditEvent } = recordAnalystDecision(
      {
        caseId: investigationCase.id,
        actorEntityId: 'ANALYST-101',
        decision: 'ESCALATE',
        rationale: 'Unexplained high deviation on file access without matching business grant.',
        evidenceIds: ['evidence|cp-1'],
        timestamp: '2026-04-10T13:00:00Z',
        actionId: 'decision-action-001',
      },
      investigationCase,
    );

    expect(decision.id).toBe('decision|decision-action-001');
    expect(decision.caseId).toBe('case|seq-1');
    expect(decision.actorEntityId).toBe('ANALYST-101');
    expect(decision.decision).toBe('ESCALATE');
    expect(decision.rationale).toContain('Unexplained high deviation');
    expect(decision.evidenceIds).toEqual(['evidence|cp-1']);

    expect(updatedCase.analystDecisionIds).toEqual(['decision|decision-action-001']);
    expect(auditEvent.eventType).toBe('DECISION_LOGGED');
    expect(auditEvent.decisionId).toBe('decision|decision-action-001');
    expect(deriveCaseStatus([decision])).toBe('ESCALATED');
  });

  // Test 4: AT-AUDIT-001: Context correction proposal generates CONTEXT_CORRECTION audit event without altering historical raw data
  it('AT-AUDIT-001: records proposed context correction as immutable audit event without deleting raw baseline', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z');
    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1'], 5.0);
    const seq = createSequence('seq-1', 'USER-ALICE', [cp1]);
    const risk = setupRisk(seq, [cp1], [ev1]);

    const { investigationCase } = constructInvestigationCase({
      sequence: seq,
      riskAssessment: risk,
      evaluationTime: '2026-04-10T12:00:00Z',
      actionId: 'act-1',
    });

    const correctionAuditEvent = proposeContextCorrection({
      caseId: investigationCase.id,
      actorEntityId: 'ANALYST-101',
      proposedGrantDescription: 'Retroactive ticket approval TICKET-992 covering file read access on RES-01.',
      evidenceIds: ['evidence|cp-1'],
      timestamp: '2026-04-10T14:00:00Z',
      actionId: 'correction-action-001',
    });

    expect(correctionAuditEvent.eventType).toBe('CONTEXT_CORRECTION');
    expect(correctionAuditEvent.caseId).toBe('case|seq-1');
    expect(correctionAuditEvent.actorEntityId).toBe('ANALYST-101');
    expect(correctionAuditEvent.description).toContain('TICKET-992');

    // Historical raw evidence and risk assessment remain completely untouched
    expect(risk.rawDeviation).toBeGreaterThan(0);
    expect(risk.residualRisk).toBeGreaterThan(0);
    expect(investigationCase.relatedChangePointIds).toEqual(['cp-1']);
  });

  // Test 5: AT-PRIV-001: Rejects non-pseudonymous identifiers (emails, raw names) and enforces pseudonyms by default
  it('AT-PRIV-001: validates pseudonymous actor identifiers and rejects raw names and emails', () => {
    expect(isValidPseudonymousId('USER-ALICE')).toBe(true);
    expect(isValidPseudonymousId('USR-042')).toBe(true);
    expect(isValidPseudonymousId('ANALYST-101')).toBe(true);
    expect(isValidPseudonymousId('system')).toBe(true);

    // Non-pseudonymous identifiers rejected
    expect(isValidPseudonymousId('alice@company.com')).toBe(false);
    expect(isValidPseudonymousId('Alice Smith')).toBe(false);
    expect(isValidPseudonymousId('john.doe.domain.org')).toBe(false);
    expect(isValidPseudonymousId('')).toBe(false);

    // Rejection when constructing case with non-pseudonymous actor
    const evRaw = createEvent('ev-1', 'alice@company.com', '2026-04-10T10:00:00Z');
    const cpRaw = createChangePoint('cp-1', 'alice@company.com', '2026-04-10T10:00:00Z');
    const seqRaw = createSequence('seq-raw', 'alice@company.com', [cpRaw]);
    const riskRaw = setupRisk(seqRaw, [cpRaw], [evRaw]);

    expect(() =>
      constructInvestigationCase({
        sequence: seqRaw,
        riskAssessment: riskRaw,
        evaluationTime: '2026-04-10T12:00:00Z',
        actionId: 'act-raw',
      }),
    ).toThrow(/Privacy violation/);
  });

  // Test 6: CASE_UPDATED audit event when open sequence receives new causal evidence
  it('emits CASE_UPDATED audit event without erasing prior decisions when an open sequence evolves', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z');
    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1'], 4.0);
    const seq = createSequence('seq-1', 'USER-ALICE', [cp1]);
    const risk1 = setupRisk(seq, [cp1], [ev1]);

    const { investigationCase, auditEvent: createAudit } = constructInvestigationCase({
      sequence: seq,
      riskAssessment: risk1,
      evaluationTime: '2026-04-10T11:00:00Z',
      actionId: 'act-create',
    });

    // Analyst logs decision on initial case
    const { decision, updatedCase: caseWithDecision } = recordAnalystDecision(
      {
        caseId: investigationCase.id,
        actorEntityId: 'ANALYST-101',
        decision: 'REVIEW_LATER',
        rationale: 'Initial review pending further log collection.',
        evidenceIds: ['evidence|cp-1'],
        timestamp: '2026-04-10T12:00:00Z',
        actionId: 'dec-1',
      },
      investigationCase,
    );

    // Sequence receives causal extension at 14:00 (cp2)
    const ev2 = createEvent('ev-2', 'USER-ALICE', '2026-04-10T14:00:00Z', 'PRIVILEGE_ACTIVITY', 'SUDO', 'SRV-1');
    const cp2 = createChangePoint('cp-2', 'USER-ALICE', '2026-04-10T14:00:00Z', 'sudo_count', ['ev-2'], 7.0);
    const updatedSeq = createSequence('seq-1', 'USER-ALICE', [cp1, cp2]);
    const risk2 = setupRisk(updatedSeq, [cp1, cp2], [ev1, ev2]);

    const { updatedCase, auditEvent: updateAudit } = updateInvestigationCase({
      existingCase: caseWithDecision,
      sequence: updatedSeq,
      updatedRiskAssessment: risk2,
      evaluationTime: '2026-04-10T15:00:00Z',
      actionId: 'act-update-001',
    });

    expect(updateAudit.eventType).toBe('CASE_UPDATED');
    expect(updateAudit.caseId).toBe('case|seq-1');
    expect(updateAudit.actorEntityId).toBe('system');
    expect(updateAudit.description).toContain('cp-2');

    // Case ID remains stable
    expect(updatedCase.id).toBe('case|seq-1');
    // Change points updated
    expect(updatedCase.relatedChangePointIds).toEqual(['cp-1', 'cp-2']);
    // Prior decision is preserved
    expect(updatedCase.analystDecisionIds).toEqual(['decision|dec-1']);
  });

  // Test 7: Case reopening requires explicit action and logs CASE_REOPENED audit event
  it('case reopening: requires explicit action on closed case, emits CASE_REOPENED and updates status', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z');
    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1'], 4.0);
    const seq = createSequence('seq-1', 'USER-ALICE', [cp1]);
    const risk = setupRisk(seq, [cp1], [ev1]);

    const { investigationCase } = constructInvestigationCase({
      sequence: seq,
      riskAssessment: risk,
      evaluationTime: '2026-04-10T11:00:00Z',
      actionId: 'act-1',
    });

    // Close the case
    const { decision: closeDec, updatedCase: closedCase } = recordAnalystDecision(
      {
        caseId: investigationCase.id,
        actorEntityId: 'ANALYST-101',
        decision: 'CLOSE',
        rationale: 'Activity closed as expected routine testing.',
        evidenceIds: [],
        timestamp: '2026-04-10T12:00:00Z',
        actionId: 'dec-close',
      },
      investigationCase,
    );

    expect(deriveCaseStatus([closeDec])).toBe('CLOSED');

    // Reopen the closed case
    const { decision: reopenDec, updatedCase: reopenedCase, auditEvent } = reopenCase(
      {
        caseId: closedCase.id,
        actorEntityId: 'ANALYST-102',
        rationale: 'New context reveals the routine testing window was cancelled.',
        timestamp: '2026-04-10T15:00:00Z',
        actionId: 'act-reopen-001',
      },
      closedCase,
      [closeDec],
    );

    expect(auditEvent.eventType).toBe('CASE_REOPENED');
    expect(auditEvent.caseId).toBe('case|seq-1');
    expect(reopenDec.decision).toBe('REVIEW_LATER');
    expect(reopenDec.rationale).toContain('routine testing window was cancelled');

    const allDecisions = [closeDec, reopenDec];
    expect(deriveCaseStatus(allDecisions)).toBe('PENDING_REVIEW');

    // Cannot reopen an already open/pending case
    expect(() =>
      reopenCase(
        {
          caseId: reopenedCase.id,
          actorEntityId: 'ANALYST-102',
          rationale: 'Invalid second reopen',
          timestamp: '2026-04-10T16:00:00Z',
          actionId: 'act-invalid',
        },
        reopenedCase,
        allDecisions,
      ),
    ).toThrow(/Cannot reopen case/);
  });

  // Test 8: Caller-supplied action ID idempotency and collision handling
  it('action ID idempotency: repeated submissions with identical action ID are idempotent; different action IDs remain distinct', () => {
    const auditTrail = new AuditTrail();

    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z');
    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1'], 4.0);
    const seq = createSequence('seq-1', 'USER-ALICE', [cp1]);
    const risk = setupRisk(seq, [cp1], [ev1]);

    const { auditEvent } = constructInvestigationCase({
      sequence: seq,
      riskAssessment: risk,
      evaluationTime: '2026-04-10T11:00:00Z',
      actionId: 'action-fixed-id',
    });

    // First append
    auditTrail.append(auditEvent);
    expect(auditTrail.getEvents().length).toBe(1);

    // Idempotent retry with exact same event
    auditTrail.append(auditEvent);
    expect(auditTrail.getEvents().length).toBe(1);

    // Distinct action ID produces distinct event even if text is identical
    const { auditEvent: auditEvent2 } = constructInvestigationCase({
      sequence: seq,
      riskAssessment: risk,
      evaluationTime: '2026-04-10T11:00:00Z',
      actionId: 'action-different-id',
    });

    auditTrail.append(auditEvent2);
    expect(auditTrail.getEvents().length).toBe(2);
  });

  // Test 9: Temporal prefix invariance of audit log
  it('temporal prefix invariance: querying audit events at T1 is unaffected by events logged at T2 > T1', () => {
    const auditTrail = new AuditTrail();

    const eventAt10 = {
      id: 'audit|1',
      schemaVersion: SCHEMA_VERSION,
      eventType: 'CASE_CREATED' as const,
      caseId: 'case|seq-1',
      actorEntityId: 'system',
      description: 'First event',
      evidenceIds: [],
      createdAt: '2026-04-10T10:00:00Z',
    };

    const eventAt14 = {
      id: 'audit|2',
      schemaVersion: SCHEMA_VERSION,
      eventType: 'DECISION_LOGGED' as const,
      caseId: 'case|seq-1',
      actorEntityId: 'ANALYST-101',
      description: 'Second event',
      evidenceIds: [],
      createdAt: '2026-04-10T14:00:00Z',
    };

    auditTrail.append(eventAt10);
    auditTrail.append(eventAt14);

    const historyAt12 = auditTrail.getEvents('2026-04-10T12:00:00Z');
    expect(historyAt12.map((e) => e.id)).toEqual(['audit|1']);

    const historyAt15 = auditTrail.getEvents('2026-04-10T15:00:00Z');
    expect(historyAt15.map((e) => e.id)).toEqual(['audit|1', 'audit|2']);
  });
});
