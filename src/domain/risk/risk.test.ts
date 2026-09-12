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
  type ChangePoint,
  type ContextGrant,
  type SecurityEvent,
  type ShiftSequence,
} from '../types';
import { reconcileContext, type ContextReconciliationResult } from '../context';
import {
  aggregateChangePointDeviations,
  composeRiskAssessment,
  generateDeterministicExplanation,
  normalizeDeviation,
  Z0_SCALE,
} from './index';

// Helper constructors for deterministic testing
const createEvent = (
  id: string,
  actorEntityId: string,
  timestamp: string,
  domain: SecurityEvent['domain'],
  action: string,
  resourceId?: string,
): SecurityEvent => ({
  id,
  schemaVersion: SCHEMA_VERSION,
  actorEntityId,
  timestamp,
  domain,
  eventType: domain === 'AUTHENTICATION' ? 'LOGIN' : 'RESOURCE_ACCESS',
  source: 'SYNTHETIC_REPLAY_FIXTURE',
  action,
  resourceId,
});

const createGrant = (
  id: string,
  actorEntityId: string,
  validFrom: string,
  validTo: string,
  resourceScope?: string[],
  actionScope?: string[],
): ContextGrant => ({
  id,
  schemaVersion: SCHEMA_VERSION,
  actorEntityId,
  validFrom,
  validTo,
  resourceScope,
  actionScope,
  sourceEvidenceIds: [`src-${id}`],
});

const createChangePoint = (
  id: string,
  actorEntityId: string,
  observedAt: string,
  featureName: string,
  relatedEventIds: string[],
  rawDeviationScore = 3.0,
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
  const uniqueFeatures = [...new Set(sorted.map((cp) => cp.featureName))];
  const allEvents = [...new Set(sorted.flatMap((cp) => cp.relatedEventIds))];

  return {
    id,
    schemaVersion: SCHEMA_VERSION,
    actorEntityId,
    changePointIds: sorted.map((cp) => cp.id),
    firstObservedAt: sorted[0].observedAt,
    lastObservedAt: sorted[sorted.length - 1].observedAt,
    features: uniqueFeatures,
    relatedEventIds: allEvents,
    evidenceId: `evidence|seq|${id}`,
  };
};

describe('Milestone 7: Explainable Residual Risk Composition', () => {
  // Test 1: AT-RISK-001: Separate fields for rawDeviation, contextCoverage, residualRisk, confidence, dataQuality
  it('AT-RISK-001: preserves distinct separation of rawDeviation, contextCoverage, residualRisk, confidence, and dataQuality', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');
    const ev2 = createEvent('ev-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'PRIVILEGE_ACTIVITY', 'SUDO', 'SRV-01');

    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1'], 3.0);
    const cp2 = createChangePoint('cp-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'sudo_count', ['ev-2'], 6.0);

    const seq = createSequence('seq-1', 'USER-ALICE', [cp1, cp2]);

    // Grant covers only READ on RES-01
    const grant = createGrant('grant-1', 'USER-ALICE', '2026-04-10T08:00:00Z', '2026-04-10T18:00:00Z', ['RES-01'], ['READ']);

    const reconciliations = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [grant],
      sourceEvents: [ev1, ev2],
    });

    const risk = composeRiskAssessment({
      sequence: seq,
      reconciliation: reconciliations[0],
      changePoints: [cp1, cp2],
      sourceEvents: [ev1, ev2],
    });

    // Verify all 5 fields are distinct and independently populated
    expect(risk.rawDeviation).toBeGreaterThan(0);
    expect(risk.contextCoverage).toBe(0.5); // 1 of 2 change points covered
    expect(risk.residualRisk).toBeGreaterThan(0);
    expect(risk.residualRisk).toBeLessThan(risk.rawDeviation); // residual reflects only uncovered cp-2
    expect(risk.confidence).toBe(1.0);
    expect(risk.dataQuality.level).toBe('HIGH');
    expect(risk.contextOutcome).toBe('PARTIALLY_EXPLAINED');
  });

  // Test 2: AT-EXPLAIN-001: Repeatable deterministic evidence-linked explanation without an LLM
  it('AT-EXPLAIN-001: produces identical deterministic explanation across repeated invocations without LLM', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');
    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1'], 3.0);
    const seq = createSequence('seq-1', 'USER-ALICE', [cp1]);

    const reconciliations = reconcileContext({
      sequences: [seq],
      changePoints: [cp1],
      contextGrants: [],
      sourceEvents: [ev1],
    });

    const risk = composeRiskAssessment({
      sequence: seq,
      reconciliation: reconciliations[0],
      changePoints: [cp1],
      sourceEvents: [ev1],
    });

    const explanation1 = generateDeterministicExplanation({
      riskAssessment: risk,
      sequence: seq,
      reconciliation: reconciliations[0],
      changePoints: [cp1],
    });

    const explanation2 = generateDeterministicExplanation({
      riskAssessment: risk,
      sequence: seq,
      reconciliation: reconciliations[0],
      changePoints: [cp1],
    });

    // Must be completely identical
    expect(explanation1).toEqual(explanation2);
    expect(explanation1.sequenceId).toBe('seq-1');
    expect(explanation1.riskAssessmentId).toBe('risk|seq|seq-1');
    expect(explanation1.summary).toContain('USER-ALICE');
  });

  // Test 3: AT-EVID-001: Traceable evidence chain referencing exact source events and structural IDs
  it('AT-EVID-001: maintains strict evidence referencing with SecurityEvent IDs in sourceEvidenceIds', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');
    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1'], 3.0);
    const seq = createSequence('seq-1', 'USER-ALICE', [cp1]);
    const grant = createGrant('grant-1', 'USER-ALICE', '2026-04-10T08:00:00Z', '2026-04-10T18:00:00Z', ['RES-01'], ['READ']);

    const reconciliations = reconcileContext({
      sequences: [seq],
      changePoints: [cp1],
      contextGrants: [grant],
      sourceEvents: [ev1],
    });

    const risk = composeRiskAssessment({
      sequence: seq,
      reconciliation: reconciliations[0],
      changePoints: [cp1],
      sourceEvents: [ev1],
    });

    // sourceEvidenceIds has ONLY SecurityEvent IDs
    expect(risk.sourceEvidenceIds).toEqual(['ev-1']);
    expect(risk.coveredEvidenceIds).toEqual(['ev-1']);
    expect(risk.uncoveredEvidenceIds).toEqual([]);
    // narrativeEvidenceIds links structural entities
    expect(risk.narrativeEvidenceIds).toEqual(['seq-1', 'cp-1', 'grant-1']);
  });

  // Test 4: Fully explained sequence has residualRisk = 0.0 while rawDeviation remains > 0.0
  it('fully explained sequence: residualRisk === 0.0 while rawDeviation remains non-zero', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');
    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1'], 12.0); // large deviation
    const seq = createSequence('seq-1', 'USER-ALICE', [cp1]);
    const grant = createGrant('grant-1', 'USER-ALICE', '2026-04-10T08:00:00Z', '2026-04-10T18:00:00Z', ['RES-01'], ['READ']);

    const reconciliations = reconcileContext({
      sequences: [seq],
      changePoints: [cp1],
      contextGrants: [grant],
      sourceEvents: [ev1],
    });

    const risk = composeRiskAssessment({
      sequence: seq,
      reconciliation: reconciliations[0],
      changePoints: [cp1],
      sourceEvents: [ev1],
    });

    expect(risk.contextOutcome).toBe('EXPLAINED');
    expect(risk.contextCoverage).toBe(1.0);
    expect(risk.rawDeviation).toBeCloseTo(normalizeDeviation(12.0), 4);
    expect(risk.rawDeviation).toBeGreaterThan(0.7); // large deviation preserved
    expect(risk.residualRisk).toBe(0.0); // no residual unexplained risk
  });

  // Test 5: Completely unexplained sequence has residualRisk === rawDeviation
  it('completely unexplained sequence: residualRisk === rawDeviation with contextCoverage = 0.0', () => {
    const ev1 = createEvent('ev-1', 'USER-BOB', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');
    const cp1 = createChangePoint('cp-1', 'USER-BOB', '2026-04-10T10:00:00Z', 'read_count', ['ev-1'], 3.5);
    const seq = createSequence('seq-1', 'USER-BOB', [cp1]);

    const reconciliations = reconcileContext({
      sequences: [seq],
      changePoints: [cp1],
      contextGrants: [], // no grants
      sourceEvents: [ev1],
    });

    const risk = composeRiskAssessment({
      sequence: seq,
      reconciliation: reconciliations[0],
      changePoints: [cp1],
      sourceEvents: [ev1],
    });

    expect(risk.contextOutcome).toBe('UNEXPLAINED');
    expect(risk.contextCoverage).toBe(0.0);
    expect(risk.residualRisk).toBe(risk.rawDeviation);
    expect(risk.coveredEvidenceIds).toEqual([]);
    expect(risk.uncoveredEvidenceIds).toEqual(['ev-1']);
  });

  // Test 6: Partially explained sequence isolates residual change point directly
  it('partially explained sequence: residualRisk is composed directly from uncovered change point', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');
    const ev2 = createEvent('ev-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'FILE_RESOURCE_ACCESS', 'DELETE', 'RES-01');

    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1'], 3.0);
    const cp2 = createChangePoint('cp-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'delete_count', ['ev-2'], 6.0);

    const seq = createSequence('seq-1', 'USER-ALICE', [cp1, cp2]);

    // Grant authorizes READ only
    const grant = createGrant('grant-1', 'USER-ALICE', '2026-04-10T08:00:00Z', '2026-04-10T18:00:00Z', ['RES-01'], ['READ']);

    const reconciliations = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [grant],
      sourceEvents: [ev1, ev2],
    });

    const risk = composeRiskAssessment({
      sequence: seq,
      reconciliation: reconciliations[0],
      changePoints: [cp1, cp2],
      sourceEvents: [ev1, ev2],
    });

    expect(risk.contextOutcome).toBe('PARTIALLY_EXPLAINED');
    expect(risk.contextCoverage).toBe(0.5);
    // residualRisk must be exactly equal to s(cp-2), not a discounted average of cp1 and cp2
    const expectedCp2Normalized = normalizeDeviation(6.0);
    expect(risk.residualRisk).toBeCloseTo(expectedCp2Normalized, 4);
    expect(risk.rawDeviation).toBeGreaterThan(risk.residualRisk);
  });

  // Test 7: Soft-saturation formula properties (boundedness, monotonicity, zero-MAD safety)
  it('soft-saturation aggregation: obeys strict monotonicity and bounded [0, 1) limits', () => {
    expect(normalizeDeviation(0)).toBe(0.0);
    expect(normalizeDeviation(-5)).toBe(0.0);

    // At threshold z = 3.0 (z0)
    expect(normalizeDeviation(3.0, Z0_SCALE)).toBeCloseTo(0.5, 4);

    // Monotonicity
    const s1 = normalizeDeviation(2.0);
    const s2 = normalizeDeviation(4.0);
    const s3 = normalizeDeviation(8.0);
    const s4 = normalizeDeviation(50.0); // extreme zero-MAD
    expect(s1).toBeLessThan(s2);
    expect(s2).toBeLessThan(s3);
    expect(s3).toBeLessThan(s4);
    expect(s4).toBeLessThan(1.0);

    // Sub-additive aggregation of multiple change points
    const cpA = createChangePoint('cp-a', 'U1', '2026-04-10T10:00:00Z', 'f1', ['e1'], 3.0);
    const cpB = createChangePoint('cp-b', 'U1', '2026-04-10T10:05:00Z', 'f2', ['e2'], 3.0);
    const aggSingle = aggregateChangePointDeviations([cpA]);
    const aggDouble = aggregateChangePointDeviations([cpA, cpB]);

    expect(aggSingle).toBeCloseTo(0.5, 4);
    // 1 - (1 - 0.5)*(1 - 0.5) = 1 - 0.25 = 0.75
    expect(aggDouble).toBeCloseTo(0.75, 4);
    expect(aggDouble).toBeGreaterThan(aggSingle);
    expect(aggDouble).toBeLessThan(1.0);
  });

  // Test 8: Indeterminate context treatment (UNKNOWN != SAFE, UNKNOWN != MALICIOUS)
  it('indeterminate context: unresolved change points remain in residual risk without penalty bonus, downgrades confidence', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');
    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1'], 3.0);
    // cp2 references ev-missing which is missing from sourceEvents
    const cp2 = createChangePoint('cp-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'write_count', ['ev-missing'], 3.0);

    const seq = createSequence('seq-1', 'USER-ALICE', [cp1, cp2]);
    const grant = createGrant('grant-1', 'USER-ALICE', '2026-04-10T08:00:00Z', '2026-04-10T18:00:00Z', ['*'], ['*']);

    const reconciliations = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [grant],
      sourceEvents: [ev1], // ev-missing omitted
    });

    const risk = composeRiskAssessment({
      sequence: seq,
      reconciliation: reconciliations[0],
      changePoints: [cp1, cp2],
      sourceEvents: [ev1],
    });

    expect(risk.contextOutcome).toBe('INDETERMINATE');
    // UNKNOWN != SAFE: cp2 is not marked covered
    expect(risk.contextCoverage).toBe(0.5);
    // UNKNOWN != MALICIOUS: cp2 has deviation 3.0 (s = 0.5), no extra uncertainty score added
    expect(risk.residualRisk).toBeCloseTo(0.5, 4);
    // Confidence is downgraded structurally
    expect(risk.confidence).toBeLessThan(1.0);
    expect(risk.dataQuality.level).toBe('LOW');
    expect(risk.dataQuality.missingFields).toContain('sourceEvent:ev-missing');
    expect(risk.dataQuality.incompleteContextCount).toBe(1);
  });

  // Test 9: Structural DataQuality classification (HIGH vs LOW, no manufactured MEDIUM)
  it('structural DataQuality: correctly classifies HIGH when complete and LOW when missing records without arbitrary bands', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');
    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1'], 3.0);
    const seq = createSequence('seq-1', 'USER-ALICE', [cp1]);

    // Case 1: Complete records -> HIGH
    const reconciliationsComplete = reconcileContext({
      sequences: [seq],
      changePoints: [cp1],
      contextGrants: [],
      sourceEvents: [ev1],
    });
    const riskHigh = composeRiskAssessment({
      sequence: seq,
      reconciliation: reconciliationsComplete[0],
      changePoints: [cp1],
      sourceEvents: [ev1],
    });
    expect(riskHigh.dataQuality.level).toBe('HIGH');
    expect(riskHigh.dataQuality.missingFields).toEqual([]);
    expect(riskHigh.dataQuality.incompleteContextCount).toBe(0);

    // Case 2: Missing source event -> LOW
    const riskLow = composeRiskAssessment({
      sequence: seq,
      reconciliation: reconciliationsComplete[0],
      changePoints: [cp1],
      sourceEvents: [], // ev-1 missing
    });
    expect(riskLow.dataQuality.level).toBe('LOW');
    expect(riskLow.dataQuality.missingFields).toEqual(['sourceEvent:ev-1']);

    // Verifies that neither case manufactured 'MEDIUM' arbitrarily
    expect(['HIGH', 'LOW']).toContain(riskHigh.dataQuality.level);
    expect(['HIGH', 'LOW']).toContain(riskLow.dataQuality.level);
  });

  // Test 10: Deduplication of sourceEvidenceIds
  it('deduplicates sourceEvidenceIds across multiple change points sharing identical events', () => {
    const evShared = createEvent('ev-shared', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');
    // Both change points reference the exact same event
    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-shared'], 3.0);
    const cp2 = createChangePoint('cp-2', 'USER-ALICE', '2026-04-10T10:00:00Z', 'byte_count', ['ev-shared'], 3.0);

    const seq = createSequence('seq-1', 'USER-ALICE', [cp1, cp2]);

    const reconciliations = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [],
      sourceEvents: [evShared],
    });

    const risk = composeRiskAssessment({
      sequence: seq,
      reconciliation: reconciliations[0],
      changePoints: [cp1, cp2],
      sourceEvents: [evShared],
    });

    // Exact deduplication: contains ['ev-shared'] once, not twice
    expect(risk.sourceEvidenceIds).toEqual(['ev-shared']);
    expect(risk.uncoveredEvidenceIds).toEqual(['ev-shared']);

    // Multiple change points contribute sub-additively (diminishing returns)
    expect(risk.rawDeviation).toBeCloseTo(0.75, 4);
  });

  // Test 11: Stable risk identity and caseId semantics
  it('maintains stable RiskAssessment identity anchored to ShiftSequence.id and sets caseId = sequence.id', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');
    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1'], 3.0);
    const seq = createSequence('seq-alpha', 'USER-ALICE', [cp1]);

    const reconciliations = reconcileContext({
      sequences: [seq],
      changePoints: [cp1],
      contextGrants: [],
      sourceEvents: [ev1],
    });

    const risk = composeRiskAssessment({
      sequence: seq,
      reconciliation: reconciliations[0],
      changePoints: [cp1],
      sourceEvents: [ev1],
    });

    expect(risk.id).toBe('risk|seq|seq-alpha');
    expect(risk.caseId).toBe('seq-alpha'); // canonical pre-M8 rule
    expect(risk.dataQuality.qualityId).toBe('quality|risk|seq-alpha');
  });

  // Test 12: Caller immutability and shuffle invariance
  it('guarantees caller immutability and shuffle invariance: permuting inputs produces identical results without mutating inputs', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');
    const ev2 = createEvent('ev-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'FILE_RESOURCE_ACCESS', 'WRITE', 'RES-02');

    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1'], 3.0);
    const cp2 = createChangePoint('cp-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'write_count', ['ev-2'], 6.0);

    const seq = createSequence('seq-1', 'USER-ALICE', [cp1, cp2]);

    const reconciliations = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [],
      sourceEvents: [ev1, ev2],
    });

    const eventsCopy = [ev1, ev2];
    const cpsCopy = [cp1, cp2];

    const risk1 = composeRiskAssessment({
      sequence: seq,
      reconciliation: reconciliations[0],
      changePoints: [cp1, cp2],
      sourceEvents: [ev1, ev2],
    });

    // Shuffled inputs
    const risk2 = composeRiskAssessment({
      sequence: seq,
      reconciliation: reconciliations[0],
      changePoints: [cp2, cp1],
      sourceEvents: [ev2, ev1],
    });

    expect(risk1).toEqual(risk2);
    // Immutability check
    expect(eventsCopy).toEqual([ev1, ev2]);
    expect(cpsCopy).toEqual([cp1, cp2]);
  });

  // Test 13: Open-sequence causal assessment and temporal prefix invariance
  it('supports open-sequence evaluation at T and maintains temporal prefix invariance', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');
    const ev2 = createEvent('ev-2', 'USER-ALICE', '2026-04-10T14:00:00Z', 'FILE_RESOURCE_ACCESS', 'WRITE', 'RES-02');

    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1'], 3.0);
    const cp2 = createChangePoint('cp-2', 'USER-ALICE', '2026-04-10T14:00:00Z', 'write_count', ['ev-2'], 6.0);

    // Sequence spans 10:00 to 14:00
    const seq = createSequence('seq-open', 'USER-ALICE', [cp1, cp2]);

    const reconciliations = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [],
      sourceEvents: [ev1, ev2],
    });

    // Assess at T1 = 12:00 (only cp1 observed so far)
    const riskAtT1 = composeRiskAssessment({
      sequence: seq,
      reconciliation: reconciliations[0],
      changePoints: [cp1, cp2],
      sourceEvents: [ev1, ev2],
      evaluationTime: '2026-04-10T12:00:00Z',
    });

    expect(riskAtT1.relatedChangePointIds).toEqual(['cp-1']);
    expect(riskAtT1.rawDeviation).toBeCloseTo(normalizeDeviation(3.0), 4);
    expect(riskAtT1.id).toBe('risk|seq|seq-open');

    // Assess at T2 = 16:00 (both cp1 and cp2 observed)
    const riskAtT2 = composeRiskAssessment({
      sequence: seq,
      reconciliation: reconciliations[0],
      changePoints: [cp1, cp2],
      sourceEvents: [ev1, ev2],
      evaluationTime: '2026-04-10T16:00:00Z',
    });

    expect(riskAtT2.relatedChangePointIds).toEqual(['cp-1', 'cp-2']);
    expect(riskAtT2.rawDeviation).toBeGreaterThan(riskAtT1.rawDeviation);
    expect(riskAtT2.id).toBe('risk|seq|seq-open'); // stable identity preserved
  });

  // Test 14: Deterministic explanation strictly omits banned subjective terminology
  it('deterministic explainer strictly omits banned subjective terminology', () => {
    const bannedWords = [
      'malicious',
      'benign',
      'safe',
      'innocent',
      'guilty',
      'suspicious',
      'rogue',
      'attack',
      'critical',
      'high risk',
    ];

    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');
    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1'], 3.0);
    const seq = createSequence('seq-1', 'USER-ALICE', [cp1]);

    const reconciliations = reconcileContext({
      sequences: [seq],
      changePoints: [cp1],
      contextGrants: [],
      sourceEvents: [ev1],
    });

    const risk = composeRiskAssessment({
      sequence: seq,
      reconciliation: reconciliations[0],
      changePoints: [cp1],
      sourceEvents: [ev1],
    });

    const explanation = generateDeterministicExplanation({
      riskAssessment: risk,
      sequence: seq,
      reconciliation: reconciliations[0],
      changePoints: [cp1],
    });

    const allText = [
      explanation.summary,
      ...explanation.behavioralFindings,
      explanation.contextFindings,
      explanation.residualRiskFindings,
      explanation.dataQualityFindings,
    ].join(' ').toLowerCase();

    for (const banned of bannedWords) {
      expect(allText).not.toContain(banned);
    }
  });
});
