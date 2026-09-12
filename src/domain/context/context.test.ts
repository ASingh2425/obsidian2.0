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
import {
  reconcileContext,
  extractEventResource,
  extractEventOperation,
} from './reconciler';

// Helper constructors for deterministic testing
const createEvent = (
  id: string,
  actorEntityId: string,
  timestamp: string,
  domain: SecurityEvent['domain'],
  action: string,
  resourceId?: string,
  destinationEntityId?: string,
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
  destinationEntityId,
});

const createGrant = (
  id: string,
  actorEntityId: string,
  validFrom: string,
  validTo: string,
  resourceScope?: string[],
  actionScope?: string[],
  confidence?: number,
): ContextGrant => ({
  id,
  schemaVersion: SCHEMA_VERSION,
  actorEntityId,
  validFrom,
  validTo,
  resourceScope,
  actionScope,
  sourceEvidenceIds: [`src-${id}`],
  // optional confidence property if present
  ...(confidence !== undefined ? { confidence } : {}),
} as ContextGrant);

const createChangePoint = (
  id: string,
  actorEntityId: string,
  observedAt: string,
  featureName: string,
  relatedEventIds: string[],
  rawDeviationScore = 3.5,
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

describe('Milestone 6: Organizational Context Reconciliation', () => {
  // Test 1: AT-CTX-001: Exact actor, time, resource, and operation match -> EXPLAINED
  it('AT-CTX-001: classifies fully matched sequence as EXPLAINED with exact provenance', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-CUST-DB-01');
    const ev2 = createEvent('ev-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-CUST-DB-01');

    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1']);
    const cp2 = createChangePoint('cp-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'active_hours_count', ['ev-2']);

    const seq = createSequence('seq-1', 'USER-ALICE', [cp1, cp2]);

    const grant = createGrant(
      'grant-1',
      'USER-ALICE',
      '2026-04-10T08:00:00Z',
      '2026-04-10T18:00:00Z',
      ['RES-CUST-DB-01'],
      ['READ'],
      0.95,
    );

    const results = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [grant],
      sourceEvents: [ev1, ev2],
    });

    expect(results).toHaveLength(1);
    const res = results[0];
    expect(res.reconciliationState).toBe('EXPLAINED');
    expect(res.matchedGrantIds).toEqual(['grant-1']);
    expect(res.changePointMatches).toHaveLength(2);
    expect(res.changePointMatches[0].matched).toBe(true);
    expect(res.changePointMatches[0].matchReason).toBe('MATCHED');
    expect(res.changePointMatches[0].temporalOverlap).toBe('COMPATIBLE');
    expect(res.changePointMatches[0].scopeCompatible).toBe('COMPATIBLE');
    expect(res.changePointMatches[1].matched).toBe(true);
    expect(res.changePointMatches[1].matchReason).toBe('MATCHED');
    expect(res.coveredEventIds).toEqual(['ev-1', 'ev-2']);
    expect(res.uncoveredEventIds).toEqual([]);

    // Raw evidence remains immutable
    expect(cp1.rawDeviationScore).toBe(3.5);
    expect(cp2.rawDeviationScore).toBe(3.5);
  });

  // Test 2: AT-CTX-002: Unapproved activity isolation -> PARTIALLY_EXPLAINED
  it('AT-CTX-002: isolates approved from unapproved activity yielding PARTIALLY_EXPLAINED', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-CUST-DB-01');
    const ev2 = createEvent('ev-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'PRIVILEGE_ACTIVITY', 'PRIVILEGE_ELEVATION', undefined, 'SRV-DC-01');

    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1']);
    const cp2 = createChangePoint('cp-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'privilege_elevation_count', ['ev-2']);

    const seq = createSequence('seq-1', 'USER-ALICE', [cp1, cp2]);

    // Grant authorizes only READ on RES-CUST-DB-01
    const grant = createGrant(
      'grant-1',
      'USER-ALICE',
      '2026-04-10T08:00:00Z',
      '2026-04-10T18:00:00Z',
      ['RES-CUST-DB-01'],
      ['READ'],
    );

    const results = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [grant],
      sourceEvents: [ev1, ev2],
    });

    expect(results).toHaveLength(1);
    const res = results[0];
    expect(res.reconciliationState).toBe('PARTIALLY_EXPLAINED');
    expect(res.matchedGrantIds).toEqual(['grant-1']);
    expect(res.changePointMatches[0].matched).toBe(true);
    expect(res.changePointMatches[0].matchReason).toBe('MATCHED');
    expect(res.changePointMatches[1].matched).toBe(false);
    expect(res.changePointMatches[1].temporalOverlap).toBe('COMPATIBLE');
    expect(res.changePointMatches[1].scopeCompatible).toBe('INCOMPATIBLE');
    expect(res.changePointMatches[1].matchReason).toBe('RESOURCE_MISMATCH');
    expect(res.coveredEventIds).toEqual(['ev-1']);
    expect(res.uncoveredEventIds).toEqual(['ev-2']);
  });

  // Test 3: AT-TEMP-001: Temporal causality - grants valid after T cannot apply
  it('AT-TEMP-001: strictly prevents temporal leakage when grant validFrom is after evaluationTime', () => {
    const ev1 = createEvent('ev-1', 'USER-BOB', '2026-05-01T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');
    const ev2 = createEvent('ev-2', 'USER-BOB', '2026-05-01T10:30:00Z', 'FILE_RESOURCE_ACCESS', 'WRITE', 'RES-01');

    const cp1 = createChangePoint('cp-1', 'USER-BOB', '2026-05-01T10:00:00Z', 'read_count', ['ev-1']);
    const cp2 = createChangePoint('cp-2', 'USER-BOB', '2026-05-01T10:30:00Z', 'write_count', ['ev-2']);

    const seq = createSequence('seq-1', 'USER-BOB', [cp1, cp2]);

    // Grant valid beginning in the future relative to evaluationTime T (2026-05-01T12:00:00Z)
    const futureGrant = createGrant(
      'grant-future',
      'USER-BOB',
      '2026-05-02T00:00:00Z',
      '2026-05-05T00:00:00Z',
      ['RES-01'],
      ['*'],
    );

    const results = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [futureGrant],
      sourceEvents: [ev1, ev2],
      evaluationTime: '2026-05-01T12:00:00Z',
    });

    expect(results).toHaveLength(1);
    expect(results[0].reconciliationState).toBe('UNEXPLAINED');
    expect(results[0].matchedGrantIds).toEqual([]);
    expect(results[0].changePointMatches[0].matchReason).toBe('NO_APPLICABLE_CONTEXT');
  });

  // Test 4: Structural INDETERMINATE - missing source event
  it('structural INDETERMINATE: marks change point INDETERMINATE if contributing event cannot be resolved', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');

    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1']);
    // cp2 references ev-missing which is NOT in sourceEvents
    const cp2 = createChangePoint('cp-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'write_count', ['ev-missing']);

    const seq = createSequence('seq-1', 'USER-ALICE', [cp1, cp2]);

    const grant = createGrant('grant-1', 'USER-ALICE', '2026-04-10T00:00:00Z', '2026-04-10T23:59:59Z', ['*'], ['*']);

    const results = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [grant],
      sourceEvents: [ev1], // ev-missing omitted
    });

    expect(results).toHaveLength(1);
    const res = results[0];
    expect(res.reconciliationState).toBe('INDETERMINATE');
    expect(res.changePointMatches[1].matchReason).toBe('INSUFFICIENT_EVIDENCE');
    expect(res.changePointMatches[1].temporalOverlap).toBe('INDETERMINATE');
    expect(res.changePointMatches[1].scopeCompatible).toBe('INDETERMINATE');
  });

  // Test 5: Structural INDETERMINATE - missing resource information on event when grant restricts resources
  it('structural INDETERMINATE: returns INSUFFICIENT_EVIDENCE when event lacks resource info for resource-restricted grant', () => {
    // Event has no resourceId and targetEntityId
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', undefined);
    const ev2 = createEvent('ev-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');

    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1']);
    const cp2 = createChangePoint('cp-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'active_hours', ['ev-2']);

    const seq = createSequence('seq-1', 'USER-ALICE', [cp1, cp2]);

    // Grant explicitly restricts to ['RES-01']
    const grant = createGrant('grant-1', 'USER-ALICE', '2026-04-10T00:00:00Z', '2026-04-10T23:59:59Z', ['RES-01'], ['READ']);

    const results = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [grant],
      sourceEvents: [ev1, ev2],
    });

    expect(results).toHaveLength(1);
    const res = results[0];
    expect(res.reconciliationState).toBe('INDETERMINATE');
    expect(res.changePointMatches[0].matchReason).toBe('INSUFFICIENT_EVIDENCE');
    expect(res.changePointMatches[0].temporalOverlap).toBe('COMPATIBLE');
    expect(res.changePointMatches[0].scopeCompatible).toBe('INDETERMINATE');
  });

  // Test 6: Resource Mismatch
  it('distinguishes RESOURCE_MISMATCH when temporal overlap exists but resource is off-scope', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-UNAUTHORIZED-DB');
    const ev2 = createEvent('ev-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-UNAUTHORIZED-DB');

    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1']);
    const cp2 = createChangePoint('cp-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'active_hours', ['ev-2']);

    const seq = createSequence('seq-1', 'USER-ALICE', [cp1, cp2]);

    const grant = createGrant('grant-1', 'USER-ALICE', '2026-04-10T00:00:00Z', '2026-04-10T23:59:59Z', ['RES-AUTHORIZED-DB'], ['READ']);

    const results = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [grant],
      sourceEvents: [ev1, ev2],
    });

    expect(results[0].reconciliationState).toBe('UNEXPLAINED');
    expect(results[0].changePointMatches[0].matchReason).toBe('RESOURCE_MISMATCH');
    expect(results[0].changePointMatches[0].temporalOverlap).toBe('COMPATIBLE');
    expect(results[0].changePointMatches[0].scopeCompatible).toBe('INCOMPATIBLE');
  });

  // Test 7: Operation Mismatch
  it('distinguishes OPERATION_MISMATCH when resource matches but operation is unapproved', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'DELETE', 'RES-AUTHORIZED-DB');
    const ev2 = createEvent('ev-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'FILE_RESOURCE_ACCESS', 'DELETE', 'RES-AUTHORIZED-DB');

    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'delete_count', ['ev-1']);
    const cp2 = createChangePoint('cp-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'active_hours', ['ev-2']);

    const seq = createSequence('seq-1', 'USER-ALICE', [cp1, cp2]);

    // Grant authorizes READ, not DELETE
    const grant = createGrant('grant-1', 'USER-ALICE', '2026-04-10T00:00:00Z', '2026-04-10T23:59:59Z', ['RES-AUTHORIZED-DB'], ['READ']);

    const results = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [grant],
      sourceEvents: [ev1, ev2],
    });

    expect(results[0].reconciliationState).toBe('UNEXPLAINED');
    expect(results[0].changePointMatches[0].matchReason).toBe('OPERATION_MISMATCH');
    expect(results[0].changePointMatches[0].temporalOverlap).toBe('COMPATIBLE');
    expect(results[0].changePointMatches[0].scopeCompatible).toBe('INCOMPATIBLE');
  });

  // Test 8: ContextType separation from authorized operations
  it('separates contextType from authorized operations: MAINTENANCE_WINDOW does not imply ADMIN without explicit scope', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'PRIVILEGE_ACTIVITY', 'ADMIN', undefined, 'SRV-DC-01');
    const ev2 = createEvent('ev-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'PRIVILEGE_ACTIVITY', 'ADMIN', undefined, 'SRV-DC-01');

    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'admin_cmd_count', ['ev-1']);
    const cp2 = createChangePoint('cp-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'privilege_count', ['ev-2']);

    const seq = createSequence('seq-1', 'USER-ALICE', [cp1, cp2]);

    // Grant has actionScope: ['READ'] only
    const grant = createGrant('grant-maint', 'USER-ALICE', '2026-04-10T00:00:00Z', '2026-04-10T23:59:59Z', ['*'], ['READ']);

    const results = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [grant],
      sourceEvents: [ev1, ev2],
    });

    expect(results[0].reconciliationState).toBe('UNEXPLAINED');
    expect(results[0].changePointMatches[0].matchReason).toBe('OPERATION_MISMATCH');
  });

  // Test 9: Actor Isolation
  it('enforces strict actor isolation: grants for Alice never match identical activity for Bob', () => {
    const ev1 = createEvent('ev-1', 'USER-BOB', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');
    const ev2 = createEvent('ev-2', 'USER-BOB', '2026-04-10T10:15:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');

    const cp1 = createChangePoint('cp-1', 'USER-BOB', '2026-04-10T10:00:00Z', 'read_count', ['ev-1']);
    const cp2 = createChangePoint('cp-2', 'USER-BOB', '2026-04-10T10:15:00Z', 'active_hours', ['ev-2']);

    const seq = createSequence('seq-1', 'USER-BOB', [cp1, cp2]);

    // Grant is exclusively for USER-ALICE
    const grant = createGrant('grant-alice', 'USER-ALICE', '2026-04-10T00:00:00Z', '2026-04-10T23:59:59Z', ['*'], ['*']);

    const results = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [grant],
      sourceEvents: [ev1, ev2],
    });

    expect(results[0].reconciliationState).toBe('UNEXPLAINED');
    expect(results[0].changePointMatches[0].matchReason).toBe('NO_APPLICABLE_CONTEXT');
  });

  // Test 10: Temporal endpoint boundaries
  it('includes exact closed interval endpoints validFrom and validTo', () => {
    const evStart = createEvent('ev-start', 'USER-ALICE', '2026-04-10T08:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');
    const evEnd = createEvent('ev-end', 'USER-ALICE', '2026-04-10T18:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');

    const cpStart = createChangePoint('cp-start', 'USER-ALICE', '2026-04-10T08:00:00Z', 'read_count', ['ev-start']);
    const cpEnd = createChangePoint('cp-end', 'USER-ALICE', '2026-04-10T18:00:00Z', 'active_hours', ['ev-end']);

    const seq = createSequence('seq-1', 'USER-ALICE', [cpStart, cpEnd]);

    const grant = createGrant('grant-boundary', 'USER-ALICE', '2026-04-10T08:00:00Z', '2026-04-10T18:00:00Z', ['RES-01'], ['READ']);

    const results = reconcileContext({
      sequences: [seq],
      changePoints: [cpStart, cpEnd],
      contextGrants: [grant],
      sourceEvents: [evStart, evEnd],
    });

    expect(results[0].reconciliationState).toBe('EXPLAINED');
    expect(results[0].changePointMatches[0].matched).toBe(true);
    expect(results[0].changePointMatches[1].matched).toBe(true);
  });

  // Test 11: Temporal non-overlap
  it('identifies TEMPORAL_MISMATCH when grant exists for actor but occurs outside activity window', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');
    const ev2 = createEvent('ev-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');

    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1']);
    const cp2 = createChangePoint('cp-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'active_hours', ['ev-2']);

    const seq = createSequence('seq-1', 'USER-ALICE', [cp1, cp2]);

    // Grant was in the past relative to the change points
    const pastGrant = createGrant('grant-past', 'USER-ALICE', '2026-04-01T00:00:00Z', '2026-04-02T00:00:00Z', ['*'], ['*']);

    const results = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [pastGrant],
      sourceEvents: [ev1, ev2],
    });

    expect(results[0].reconciliationState).toBe('UNEXPLAINED');
    expect(results[0].changePointMatches[0].matchReason).toBe('TEMPORAL_MISMATCH');
    expect(results[0].changePointMatches[0].temporalOverlap).toBe('INCOMPATIBLE');
  });

  // Test 12: Multiple context grants union
  it('combines multiple grants to explain sequence when different grants cover different change points', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T09:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-DB-01');
    const ev2 = createEvent('ev-2', 'USER-ALICE', '2026-04-10T14:00:00Z', 'FILE_RESOURCE_ACCESS', 'WRITE', 'RES-DB-02');

    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T09:00:00Z', 'read_count', ['ev-1']);
    const cp2 = createChangePoint('cp-2', 'USER-ALICE', '2026-04-10T14:00:00Z', 'write_count', ['ev-2']);

    const seq = createSequence('seq-1', 'USER-ALICE', [cp1, cp2]);

    const grantA = createGrant('grant-A', 'USER-ALICE', '2026-04-10T08:00:00Z', '2026-04-10T12:00:00Z', ['RES-DB-01'], ['READ']);
    const grantB = createGrant('grant-B', 'USER-ALICE', '2026-04-10T13:00:00Z', '2026-04-10T17:00:00Z', ['RES-DB-02'], ['WRITE']);

    const results = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [grantB, grantA], // intentionally unsorted input
      sourceEvents: [ev1, ev2],
    });

    expect(results[0].reconciliationState).toBe('EXPLAINED');
    expect(results[0].matchedGrantIds).toEqual(['grant-A', 'grant-B']); // canonical sort
    expect(results[0].changePointMatches[0].matchedGrantIds).toEqual(['grant-A']);
    expect(results[0].changePointMatches[1].matchedGrantIds).toEqual(['grant-B']);
  });

  // Test 13: Zero Context
  it('returns UNEXPLAINED with NO_APPLICABLE_CONTEXT when contextGrants array is empty', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');
    const ev2 = createEvent('ev-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');

    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1']);
    const cp2 = createChangePoint('cp-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'active_hours', ['ev-2']);

    const seq = createSequence('seq-1', 'USER-ALICE', [cp1, cp2]);

    const results = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [],
      sourceEvents: [ev1, ev2],
    });

    expect(results[0].reconciliationState).toBe('UNEXPLAINED');
    expect(results[0].changePointMatches[0].matchReason).toBe('NO_APPLICABLE_CONTEXT');
    expect(results[0].matchedGrantIds).toEqual([]);
    expect(results[0].coveredEventIds).toEqual([]);
    expect(results[0].uncoveredEventIds).toEqual(['ev-1', 'ev-2']);
  });

  // Test 14: EvidenceItem Type Discipline
  it('maintains strict EvidenceItem discipline: sourceEventIds contains only SecurityEvent IDs, not grant or sequence IDs', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');
    const ev2 = createEvent('ev-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');

    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1']);
    const cp2 = createChangePoint('cp-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'active_hours', ['ev-2']);

    const seq = createSequence('seq-1', 'USER-ALICE', [cp1, cp2]);

    const grant = createGrant('grant-1', 'USER-ALICE', '2026-04-10T00:00:00Z', '2026-04-10T23:59:59Z', ['RES-01'], ['READ']);

    const results = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [grant],
      sourceEvents: [ev1, ev2],
    });

    const item = results[0].evidenceItem;
    expect(item.evidenceType).toBe('CONTEXT');
    // sourceEventIds contains ONLY SecurityEvent IDs
    expect(item.sourceEventIds).toEqual(['ev-1', 'ev-2']);
    expect(item.sourceEventIds).not.toContain('seq-1');
    expect(item.sourceEventIds).not.toContain('grant-1');

    // Structural linking through narrativeEvidenceIds
    expect(item.narrativeEvidenceIds).toEqual(['seq-1', 'grant-1']);
    expect(item.summary).toContain('Context reconciliation for actor');
    expect(item.summary).not.toContain('malicious');
    expect(item.summary).not.toContain('guilt');
  });

  // Test 15: Caller immutability and shuffle invariance
  it('guarantees caller immutability and shuffle invariance: permuting inputs produces identical results without mutating inputs', () => {
    const ev1 = createEvent('ev-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');
    const ev2 = createEvent('ev-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-01');

    const cp1 = createChangePoint('cp-1', 'USER-ALICE', '2026-04-10T10:00:00Z', 'read_count', ['ev-1']);
    const cp2 = createChangePoint('cp-2', 'USER-ALICE', '2026-04-10T10:15:00Z', 'active_hours', ['ev-2']);

    const seq = createSequence('seq-1', 'USER-ALICE', [cp1, cp2]);

    const grantA = createGrant('grant-A', 'USER-ALICE', '2026-04-10T00:00:00Z', '2026-04-10T12:00:00Z', ['RES-01'], ['READ']);
    const grantB = createGrant('grant-B', 'USER-ALICE', '2026-04-10T00:00:00Z', '2026-04-10T18:00:00Z', ['RES-01'], ['READ']);

    const eventsCopy = [ev1, ev2];
    const grantsCopy = [grantA, grantB];

    const res1 = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [grantA, grantB],
      sourceEvents: [ev1, ev2],
    });

    // Shuffled execution
    const res2 = reconcileContext({
      sequences: [seq],
      changePoints: [cp2, cp1],
      contextGrants: [grantB, grantA],
      sourceEvents: [ev2, ev1],
    });

    expect(res1).toEqual(res2);
    // Inputs were not mutated
    expect(eventsCopy).toEqual([ev1, ev2]);
    expect(grantsCopy).toEqual([grantA, grantB]);
  });

  // Test 16: Documented conservative mixed-event policy:
  // A single ChangePoint contains authorized READ + unauthorized DELETE. Must NOT be marked MATCHED.
  it('mixed-event conservative policy: ChangePoint with authorized and unauthorized events is not marked MATCHED', () => {
    const evAuth = createEvent('ev-auth', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'READ', 'RES-CUST-DB-01');
    const evUnauth = createEvent('ev-unauth', 'USER-ALICE', '2026-04-10T10:05:00Z', 'FILE_RESOURCE_ACCESS', 'DELETE', 'RES-CUST-DB-01');

    // cp1 has BOTH contributing events
    const cp1 = createChangePoint('cp-mixed', 'USER-ALICE', '2026-04-10T10:00:00Z', 'data_ops_count', ['ev-auth', 'ev-unauth']);
    const cp2 = createChangePoint('cp-control', 'USER-ALICE', '2026-04-10T10:15:00Z', 'active_hours', ['ev-auth']);

    const seq = createSequence('seq-1', 'USER-ALICE', [cp1, cp2]);

    // Grant authorizes READ only
    const grant = createGrant('grant-read', 'USER-ALICE', '2026-04-10T00:00:00Z', '2026-04-10T23:59:59Z', ['RES-CUST-DB-01'], ['READ']);

    const results = reconcileContext({
      sequences: [seq],
      changePoints: [cp1, cp2],
      contextGrants: [grant],
      sourceEvents: [evAuth, evUnauth],
    });

    expect(results).toHaveLength(1);
    const res = results[0];
    // cp-control matches, but cp-mixed fails operation match -> PARTIALLY_EXPLAINED
    expect(res.reconciliationState).toBe('PARTIALLY_EXPLAINED');

    const mixedMatch = res.changePointMatches.find((m) => m.changePointId === 'cp-mixed');
    expect(mixedMatch?.matched).toBe(false);
    expect(mixedMatch?.matchReason).toBe('OPERATION_MISMATCH');
    expect(mixedMatch?.scopeCompatible).toBe('INCOMPATIBLE');
  });

  // Test 17: Helper unit tests for extractEventResource and extractEventOperation
  it('correctly extracts resources and operations across all domain types', () => {
    const authEvent = createEvent('ev-a', 'USER-ALICE', '2026-04-10T10:00:00Z', 'AUTHENTICATION', 'LOGIN', undefined, 'SSO-PORTAL');
    const resEvent = createEvent('ev-r', 'USER-ALICE', '2026-04-10T10:00:00Z', 'FILE_RESOURCE_ACCESS', 'EXPORT', 'RES-FINANCE-01');
    const privEvent = createEvent('ev-p', 'USER-ALICE', '2026-04-10T10:00:00Z', 'PRIVILEGE_ACTIVITY', 'SUDO', 'HOST-LINUX-01');

    expect(extractEventResource(authEvent)).toBe('SSO-PORTAL');
    expect(extractEventOperation(authEvent)).toBe('LOGIN');

    expect(extractEventResource(resEvent)).toBe('RES-FINANCE-01');
    expect(extractEventOperation(resEvent)).toBe('EXPORT');

    expect(extractEventResource(privEvent)).toBe('HOST-LINUX-01');
    expect(extractEventOperation(privEvent)).toBe('SUDO');
  });
});
