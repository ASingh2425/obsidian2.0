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
import { SCHEMA_VERSION, type ChangePoint } from '../types';
import {
  correlateSequences,
  constructSequenceEvidenceItem,
  stableSequenceId,
  stableSequenceEvidenceId,
  DEFAULT_SEQUENCE_CORRELATION_CONFIG,
  SequenceCorrelationError,
} from './index';

// Helper to create valid ChangePoint objects
const makeChangePoint = (
  id: string,
  observedAt: string,
  featureName: string,
  actorEntityId = 'USER-ALICE',
  relatedEventIds: string[] = [`evt-${id}`],
  rawDeviationScore = 3.5,
): ChangePoint => ({
  id,
  schemaVersion: SCHEMA_VERSION,
  actorEntityId,
  observedAt,
  featureName,
  rawDeviationScore,
  relatedEventIds,
  evidenceId: `evidence|changepoint|${id}`,
});

describe('Milestone 5: Multi-Domain Sequence Correlation', () => {
  describe('Acceptance Criteria & Non-Negotiable Semantics', () => {
    // AT-CORR-001: Correlated progression across two or more behavioral dimensions within window forms a single linked sequence
    it('AT-CORR-001: Correlated progression across two or more behavioral dimensions forms a single linked sequence', () => {
      const cp1 = makeChangePoint('cp-auth-1', '2026-03-01T10:00:00Z', 'auth_failure_count', 'USER-ALICE', ['evt-1']);
      const cp2 = makeChangePoint('cp-file-1', '2026-03-01T10:30:00Z', 'sensitive_file_read_count', 'USER-ALICE', ['evt-2']);

      const result = correlateSequences({
        changePoints: [cp1, cp2],
      });

      expect(result.sequences).toHaveLength(1);
      const seq = result.sequences[0];
      expect(seq.actorEntityId).toBe('USER-ALICE');
      expect(seq.firstObservedAt).toBe('2026-03-01T10:00:00Z');
      expect(seq.lastObservedAt).toBe('2026-03-01T10:30:00Z');
      expect(seq.features).toEqual(['auth_failure_count', 'sensitive_file_read_count']);
      expect(seq.changePointIds).toEqual(['cp-auth-1', 'cp-file-1']);
      expect(seq.relatedEventIds).toEqual(['evt-1', 'evt-2']);
      expect(seq.id).toBe(stableSequenceId('USER-ALICE', '2026-03-01T10:00:00Z', 'cp-auth-1'));
      expect(seq.evidenceId).toBe(stableSequenceEvidenceId('USER-ALICE', '2026-03-01T10:00:00Z', 'cp-auth-1'));
      expect(result.suppressedProtoClusterCount).toBe(0);
    });

    // AT-CORR-002: Independent deviations separated by more than correlation window remain separate sequences
    it('AT-CORR-002: Independent deviations separated by more than the correlation window remain separate sequences', () => {
      // Sequence 1: 10:00 and 10:30 (gap = 30m <= 60m default)
      const cp1 = makeChangePoint('cp-auth-1', '2026-03-01T10:00:00Z', 'auth_failure_count', 'USER-ALICE');
      const cp2 = makeChangePoint('cp-file-1', '2026-03-01T10:30:00Z', 'file_access_volume', 'USER-ALICE');

      // Sequence 2: 14:00 and 14:20 (gap from 10:30 is 3.5 hours > 1 hour maxTemporalGapMs)
      const cp3 = makeChangePoint('cp-priv-1', '2026-03-01T14:00:00Z', 'privilege_escalation_count', 'USER-ALICE');
      const cp4 = makeChangePoint('cp-dest-1', '2026-03-01T14:20:00Z', 'unusual_destination_count', 'USER-ALICE');

      const result = correlateSequences({
        changePoints: [cp1, cp2, cp3, cp4],
      });

      expect(result.sequences).toHaveLength(2);
      expect(result.sequences[0].changePointIds).toEqual(['cp-auth-1', 'cp-file-1']);
      expect(result.sequences[1].changePointIds).toEqual(['cp-priv-1', 'cp-dest-1']);
      expect(result.sequences[0].id).not.toBe(result.sequences[1].id);
    });

    // AT-CORR-003: Unrelated entities never share a sequence; entity isolation is preserved
    it('AT-CORR-003: Strict actor isolation preserves entity boundaries across all sequence operations', () => {
      // Alice has auth + file
      const cpAlice1 = makeChangePoint('cp-a-1', '2026-03-01T10:00:00Z', 'auth_failure_count', 'USER-ALICE');
      const cpAlice2 = makeChangePoint('cp-a-2', '2026-03-01T10:15:00Z', 'file_read_count', 'USER-ALICE');

      // Bob has privilege + destination at the exact same times
      const cpBob1 = makeChangePoint('cp-b-1', '2026-03-01T10:00:00Z', 'privilege_escalation_count', 'USER-BOB');
      const cpBob2 = makeChangePoint('cp-b-2', '2026-03-01T10:15:00Z', 'destination_transfer_bytes', 'USER-BOB');

      const result = correlateSequences({
        changePoints: [cpAlice1, cpBob1, cpAlice2, cpBob2],
      });

      expect(result.sequences).toHaveLength(2);
      const aliceSeq = result.sequences.find((s) => s.actorEntityId === 'USER-ALICE')!;
      const bobSeq = result.sequences.find((s) => s.actorEntityId === 'USER-BOB')!;

      expect(aliceSeq).toBeDefined();
      expect(bobSeq).toBeDefined();
      expect(aliceSeq.changePointIds).toEqual(['cp-a-1', 'cp-a-2']);
      expect(bobSeq.changePointIds).toEqual(['cp-b-1', 'cp-b-2']);

      // Filtering by single actorEntityId explicitly gives only that actor
      const aliceOnly = correlateSequences({
        changePoints: [cpAlice1, cpBob1, cpAlice2, cpBob2],
        actorEntityId: 'USER-ALICE',
      });
      expect(aliceOnly.sequences).toHaveLength(1);
      expect(aliceOnly.sequences[0].actorEntityId).toBe('USER-ALICE');
    });

    // AT-SEQ-001: Sequence correlation groups related events only within valid chronological ordering
    it('AT-SEQ-001: Sequence correlation groups related events only within valid chronological ordering', () => {
      const cp1 = makeChangePoint('cp-1', '2026-03-01T10:00:00Z', 'feature_a', 'USER-ALICE', ['evt-1']);
      const cp2 = makeChangePoint('cp-2', '2026-03-01T10:20:00Z', 'feature_b', 'USER-ALICE', ['evt-2']);
      const cp3 = makeChangePoint('cp-3', '2026-03-01T10:40:00Z', 'feature_c', 'USER-ALICE', ['evt-3']);

      // Feed in reverse order
      const result = correlateSequences({
        changePoints: [cp3, cp1, cp2],
      });

      expect(result.sequences).toHaveLength(1);
      const seq = result.sequences[0];
      expect(seq.changePointIds).toEqual(['cp-1', 'cp-2', 'cp-3']);
      expect(seq.firstObservedAt).toBe('2026-03-01T10:00:00Z');
      expect(seq.lastObservedAt).toBe('2026-03-01T10:40:00Z');
    });

    // AT-TEMP-001: Temporal leakage prevention blocks future influence on earlier detection results
    it('AT-TEMP-001: Temporal leakage prevention blocks future influence on earlier sequence state', () => {
      const cp1 = makeChangePoint('cp-1', '2026-03-01T10:00:00Z', 'feature_a', 'USER-ALICE', ['evt-1']);
      const cp2 = makeChangePoint('cp-2', '2026-03-01T10:20:00Z', 'feature_b', 'USER-ALICE', ['evt-2']);
      const cpFuture = makeChangePoint('cp-future', '2026-03-01T11:30:00Z', 'feature_c', 'USER-ALICE', ['evt-future']);

      // Evaluated at T = 10:25:00Z
      const resultAtT = correlateSequences({
        changePoints: [cp1, cp2, cpFuture],
        evaluationTime: '2026-03-01T10:25:00Z',
      });

      expect(resultAtT.sequences).toHaveLength(1);
      expect(resultAtT.sequences[0].changePointIds).toEqual(['cp-1', 'cp-2']);
      expect(resultAtT.sequences[0].lastObservedAt).toBe('2026-03-01T10:20:00Z');
      expect(resultAtT.sequences[0].relatedEventIds).not.toContain('evt-future');
    });

    // AT-EVID-001: Evidence linkage preserves traceable source references end-to-end
    it('AT-EVID-001: Evidence linkage preserves traceable source references from change points into EvidenceItems', () => {
      const cp1 = makeChangePoint('cp-1', '2026-03-01T10:00:00Z', 'feature_a', 'USER-ALICE', ['evt-100', 'evt-101']);
      const cp2 = makeChangePoint('cp-2', '2026-03-01T10:15:00Z', 'feature_b', 'USER-ALICE', ['evt-101', 'evt-102']);

      const result = correlateSequences({
        changePoints: [cp1, cp2],
      });

      expect(result.sequences).toHaveLength(1);
      expect(result.evidenceItems).toHaveLength(1);

      const seq = result.sequences[0];
      const evidence = result.evidenceItems[0];

      expect(evidence.id).toBe(seq.evidenceId);
      expect(evidence.schemaVersion).toBe(SCHEMA_VERSION);
      // Canonical deduplication and sorting: evt-100, evt-101, evt-102
      expect(evidence.sourceEventIds).toEqual(['evt-100', 'evt-101', 'evt-102']);
      expect(seq.relatedEventIds).toEqual(['evt-100', 'evt-101', 'evt-102']);
      expect(evidence.evidenceType).toBe('CHANGE_POINT');
      expect(evidence.confidence).toBe(1.0);
      expect(evidence.narrativeEvidenceIds).toEqual([seq.id]);
      expect(evidence.summary).toContain('USER-ALICE');
      expect(evidence.summary).toContain('feature_a, feature_b');
    });
  });

  describe('Non-Negotiable M5 Structural Semantics', () => {
    it('Proto-cluster suppression: Single-feature candidates remain internal proto-clusters and are NOT emitted', () => {
      // 3 change points, all on the same feature 'auth_failure_count'
      const cp1 = makeChangePoint('cp-1', '2026-03-01T10:00:00Z', 'auth_failure_count');
      const cp2 = makeChangePoint('cp-2', '2026-03-01T10:15:00Z', 'auth_failure_count');
      const cp3 = makeChangePoint('cp-3', '2026-03-01T10:30:00Z', 'auth_failure_count');

      const result = correlateSequences({
        changePoints: [cp1, cp2, cp3],
      });

      expect(result.sequences).toHaveLength(0);
      expect(result.evidenceItems).toHaveLength(0);
      expect(result.evaluatedChangePointCount).toBe(3);
      expect(result.suppressedProtoClusterCount).toBe(1);
    });

    it('Exactly two-feature minimum: Sequence becomes valid as soon as distinct feature count >= 2', () => {
      const cp1 = makeChangePoint('cp-1', '2026-03-01T10:00:00Z', 'feature_x');
      const cp2 = makeChangePoint('cp-2', '2026-03-01T10:10:00Z', 'feature_x');
      // When evaluated with only feature_x, no sequence
      const step1 = correlateSequences({ changePoints: [cp1, cp2] });
      expect(step1.sequences).toHaveLength(0);
      expect(step1.suppressedProtoClusterCount).toBe(1);

      // Now add second feature
      const cp3 = makeChangePoint('cp-3', '2026-03-01T10:20:00Z', 'feature_y');
      const step2 = correlateSequences({ changePoints: [cp1, cp2, cp3] });
      expect(step2.sequences).toHaveLength(1);
      expect(step2.sequences[0].features).toEqual(['feature_x', 'feature_y']);
      expect(step2.sequences[0].changePointIds).toEqual(['cp-1', 'cp-2', 'cp-3']);
      expect(step2.suppressedProtoClusterCount).toBe(0);
    });

    it('Stable sequence.id under causal append: Appending CP-C does NOT alter sequence.id', () => {
      const cp1 = makeChangePoint('cp-1', '2026-03-01T10:00:00Z', 'feature_a');
      const cp2 = makeChangePoint('cp-2', '2026-03-01T10:15:00Z', 'feature_b');

      const initialResult = correlateSequences({ changePoints: [cp1, cp2] });
      expect(initialResult.sequences).toHaveLength(1);
      const initialSeq = initialResult.sequences[0];
      const initialId = initialSeq.id;
      expect(initialSeq.lastObservedAt).toBe('2026-03-01T10:15:00Z');

      // Later, CP-3 arrives at 10:30:00Z
      const cp3 = makeChangePoint('cp-3', '2026-03-01T10:30:00Z', 'feature_c');
      const extendedResult = correlateSequences({ changePoints: [cp1, cp2, cp3] });

      expect(extendedResult.sequences).toHaveLength(1);
      const extendedSeq = extendedResult.sequences[0];
      // CRITICAL: ID MUST BE EXACTLY IDENTICAL
      expect(extendedSeq.id).toBe(initialId);
      expect(extendedSeq.firstObservedAt).toBe(initialSeq.firstObservedAt);
      expect(extendedSeq.lastObservedAt).toBe('2026-03-01T10:30:00Z');
      expect(extendedSeq.changePointIds).toEqual(['cp-1', 'cp-2', 'cp-3']);
    });

    it('Stable evidenceId under causal append: Appending later members preserves evidenceId', () => {
      const cp1 = makeChangePoint('cp-1', '2026-03-01T10:00:00Z', 'feature_a');
      const cp2 = makeChangePoint('cp-2', '2026-03-01T10:15:00Z', 'feature_b');

      const initialResult = correlateSequences({ changePoints: [cp1, cp2] });
      const initialEvidenceId = initialResult.sequences[0].evidenceId;
      expect(initialResult.evidenceItems[0].id).toBe(initialEvidenceId);

      // Append CP-3
      const cp3 = makeChangePoint('cp-3', '2026-03-01T10:30:00Z', 'feature_c');
      const extendedResult = correlateSequences({ changePoints: [cp1, cp2, cp3] });
      expect(extendedResult.sequences[0].evidenceId).toBe(initialEvidenceId);
      expect(extendedResult.evidenceItems[0].id).toBe(initialEvidenceId);
    });

    it('Monotonic causal extension: Earlier members, ordering, and provenance remain invariant when sequence grows', () => {
      const cp1 = makeChangePoint('cp-1', '2026-03-01T10:00:00Z', 'feature_a', 'USER-ALICE', ['evt-1']);
      const cp2 = makeChangePoint('cp-2', '2026-03-01T10:15:00Z', 'feature_b', 'USER-ALICE', ['evt-2']);

      const t1Result = correlateSequences({
        changePoints: [cp1, cp2],
        evaluationTime: '2026-03-01T10:20:00Z',
      });
      const seqT1 = t1Result.sequences[0];

      // At T2, CP-3 is added
      const cp3 = makeChangePoint('cp-3', '2026-03-01T10:40:00Z', 'feature_c', 'USER-ALICE', ['evt-3']);
      const t2Result = correlateSequences({
        changePoints: [cp1, cp2, cp3],
        evaluationTime: '2026-03-01T10:50:00Z',
      });
      const seqT2 = t2Result.sequences[0];

      // Invariants:
      expect(seqT2.id).toBe(seqT1.id);
      expect(seqT2.actorEntityId).toBe(seqT1.actorEntityId);
      expect(seqT2.firstObservedAt).toBe(seqT1.firstObservedAt);
      expect(seqT2.changePointIds.slice(0, 2)).toEqual(seqT1.changePointIds);
      expect(seqT2.relatedEventIds).toEqual(expect.arrayContaining(seqT1.relatedEventIds));
      expect(seqT1.relatedEventIds.every((evt) => seqT2.relatedEventIds.includes(evt))).toBe(true);
    });

    it('Closed sequence immutability: Once closed by temporal gap, subsequent change points never reopen it', () => {
      // Seq 1: 10:00 and 10:15
      const cp1 = makeChangePoint('cp-1', '2026-03-01T10:00:00Z', 'feature_a');
      const cp2 = makeChangePoint('cp-2', '2026-03-01T10:15:00Z', 'feature_b');

      const seq1Result = correlateSequences({
        changePoints: [cp1, cp2],
        evaluationTime: '2026-03-01T10:30:00Z',
      });
      const closedSeqSnapshot = seq1Result.sequences[0];

      // Arriving much later (gap = 3 hours > 1 hour maxTemporalGapMs)
      const cp3 = makeChangePoint('cp-3', '2026-03-01T13:15:00Z', 'feature_c');
      const cp4 = makeChangePoint('cp-4', '2026-03-01T13:30:00Z', 'feature_d');

      const laterResult = correlateSequences({
        changePoints: [cp1, cp2, cp3, cp4],
      });

      expect(laterResult.sequences).toHaveLength(2);
      const originalSeqAfterLaterArrival = laterResult.sequences[0];

      // Closed sequence MUST NOT be modified in any field
      expect(originalSeqAfterLaterArrival.id).toBe(closedSeqSnapshot.id);
      expect(originalSeqAfterLaterArrival.firstObservedAt).toBe(closedSeqSnapshot.firstObservedAt);
      expect(originalSeqAfterLaterArrival.lastObservedAt).toBe(closedSeqSnapshot.lastObservedAt);
      expect(originalSeqAfterLaterArrival.changePointIds).toEqual(closedSeqSnapshot.changePointIds);
      expect(originalSeqAfterLaterArrival.features).toEqual(closedSeqSnapshot.features);
      expect(originalSeqAfterLaterArrival.relatedEventIds).toEqual(closedSeqSnapshot.relatedEventIds);
      expect(originalSeqAfterLaterArrival.evidenceId).toBe(closedSeqSnapshot.evidenceId);
    });

    it('Bounded sequential transitivity and maxSequenceSpanMs guard', () => {
      // Sliding gap: 10:00, 10:45 (gap 45m <= 60m), 11:30 (gap 45m <= 60m)
      // Span: 10:00 to 11:30 is 1.5h <= 24h
      const cp1 = makeChangePoint('cp-1', '2026-03-01T10:00:00Z', 'feature_a');
      const cp2 = makeChangePoint('cp-2', '2026-03-01T10:45:00Z', 'feature_b');
      const cp3 = makeChangePoint('cp-3', '2026-03-01T11:30:00Z', 'feature_c');

      const transitiveResult = correlateSequences({
        changePoints: [cp1, cp2, cp3],
      });
      expect(transitiveResult.sequences).toHaveLength(1);
      expect(transitiveResult.sequences[0].changePointIds).toEqual(['cp-1', 'cp-2', 'cp-3']);

      // Total span guard: configure maxSequenceSpanMs = 1 hour (3600000 ms)
      // cp1 (10:00) to cp3 (11:30) is 90 mins > 60 mins maxSequenceSpanMs
      const boundedSpanResult = correlateSequences({
        changePoints: [cp1, cp2, cp3],
        config: {
          maxTemporalGapMs: 3600000,
          maxSequenceSpanMs: 3600000,
        },
      });

      // cp1 and cp2 form Seq 1 (span = 45 mins <= 60 mins)
      // cp3 cannot join because span from cp1 would be 90 mins > 60 mins -> closes Seq 1, cp3 starts new cluster
      // Since cp3 has only 1 feature, it is suppressed as a proto-cluster!
      expect(boundedSpanResult.sequences).toHaveLength(1);
      expect(boundedSpanResult.sequences[0].changePointIds).toEqual(['cp-1', 'cp-2']);
      expect(boundedSpanResult.suppressedProtoClusterCount).toBe(1);
    });

    it('Tie timestamp determinism: ChangePoints with identical timestamps break ties stably by ID', () => {
      const cpA = makeChangePoint('cp-b-id', '2026-03-01T10:00:00Z', 'feature_b');
      const cpB = makeChangePoint('cp-a-id', '2026-03-01T10:00:00Z', 'feature_a');

      const result1 = correlateSequences({ changePoints: [cpA, cpB] });
      const result2 = correlateSequences({ changePoints: [cpB, cpA] });

      expect(result1.sequences).toHaveLength(1);
      expect(result2.sequences).toHaveLength(1);

      // 'cp-a-id' < 'cp-b-id' ordinally
      expect(result1.sequences[0].changePointIds).toEqual(['cp-a-id', 'cp-b-id']);
      expect(result2.sequences[0].changePointIds).toEqual(['cp-a-id', 'cp-b-id']);
      expect(result1.sequences[0].id).toBe(result2.sequences[0].id);
    });

    it('Caller immutability and shuffle invariance: Caller arrays are never mutated and shuffled input produces identical results', () => {
      const cp1 = makeChangePoint('cp-1', '2026-03-01T10:00:00Z', 'feature_a', 'USER-ALICE', ['evt-1']);
      const cp2 = makeChangePoint('cp-2', '2026-03-01T10:20:00Z', 'feature_b', 'USER-ALICE', ['evt-2']);
      const cp3 = makeChangePoint('cp-3', '2026-03-01T10:40:00Z', 'feature_c', 'USER-ALICE', ['evt-3']);

      const originalOrder = [cp1, cp2, cp3];
      const callerArrayCopy = [...originalOrder];

      const resultOrdered = correlateSequences({ changePoints: originalOrder });
      // Verify caller array was not reordered or mutated
      expect(originalOrder).toEqual(callerArrayCopy);

      // Shuffled order
      const shuffled = [cp2, cp3, cp1];
      const resultShuffled = correlateSequences({ changePoints: shuffled });

      expect(resultShuffled.sequences).toEqual(resultOrdered.sequences);
      expect(resultShuffled.evidenceItems).toEqual(resultOrdered.evidenceItems);
    });

    it('Disjoint membership: Each ChangePoint belongs to AT MOST ONE public ShiftSequence', () => {
      const cp1 = makeChangePoint('cp-1', '2026-03-01T10:00:00Z', 'feature_a');
      const cp2 = makeChangePoint('cp-2', '2026-03-01T10:20:00Z', 'feature_b');
      const cp3 = makeChangePoint('cp-3', '2026-03-01T14:00:00Z', 'feature_c');
      const cp4 = makeChangePoint('cp-4', '2026-03-01T14:20:00Z', 'feature_d');

      const result = correlateSequences({ changePoints: [cp1, cp2, cp3, cp4] });
      expect(result.sequences).toHaveLength(2);

      const allAssignedIds = result.sequences.flatMap((s) => s.changePointIds);
      const uniqueAssignedIds = new Set(allAssignedIds);
      expect(allAssignedIds.length).toBe(uniqueAssignedIds.size);
    });

    it('Rejects invalid input gracefully with SequenceCorrelationError', () => {
      expect(() => correlateSequences({ changePoints: null as any })).toThrowError(SequenceCorrelationError);
      expect(() =>
        correlateSequences({
          changePoints: [
            makeChangePoint('cp-1', 'not-a-timestamp', 'feature_a'),
          ],
        }),
      ).toThrowError(SequenceCorrelationError);
    });
  });
});
