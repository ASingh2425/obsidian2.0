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
  type ChangePoint,
  type EvidenceItem,
  type ShiftSequence,
} from '../types';
import {
  type CorrelateSequencesInput,
  type SequenceCorrelationConfig,
  type SequenceCorrelationResult,
  DEFAULT_SEQUENCE_CORRELATION_CONFIG,
  SequenceCorrelationError,
} from './types';

const compareOrdinalStrings = (left: string, right: string): number => {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
};

const toNumericTimestamp = (value: string, path: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new SequenceCorrelationError('INVALID_TIMESTAMP', path, `Timestamp '${value}' is not a valid ISO-8601 value.`);
  }
  return parsed;
};

const uniqueSortedIds = (ids: readonly string[]): string[] => {
  const set = new Set<string>();
  for (const id of ids) {
    if (id) {
      set.add(id);
    }
  }
  return [...set].sort(compareOrdinalStrings);
};

/**
 * Stable, origin-based sequence ID:
 * Anchored to the immutable sequence origin:
 * actorEntityId + firstObservedAt + firstChangePointId.
 * Appending later members causally does not change this identifier.
 */
export const stableSequenceId = (
  actorEntityId: string,
  firstObservedAt: string,
  firstChangePointId: string,
): string => `sequence|${[
  SCHEMA_VERSION,
  actorEntityId,
  firstObservedAt,
  firstChangePointId,
].map((v) => encodeURIComponent(v)).join('|')}`;

/**
 * Stable, origin-based evidence ID:
 * Follows the identical stable origin principle as sequence ID.
 */
export const stableSequenceEvidenceId = (
  actorEntityId: string,
  firstObservedAt: string,
  firstChangePointId: string,
): string => `evidence|sequence|${[
  SCHEMA_VERSION,
  actorEntityId,
  firstObservedAt,
  firstChangePointId,
].map((v) => encodeURIComponent(v)).join('|')}`;

/**
 * Deterministically constructs an EvidenceItem traceable to the sequence's member events.
 *
 * Rules:
 * - EvidenceItem.sourceEventIds inherits the exact canonical deduplicated union of member change points.
 * - EvidenceItem.summary is constructed factually and deterministically without narrative fiction or LLM.
 * - EvidenceItem.confidence reflects evidence presence/quality (1.0 for validated change points),
 *   never risk, severity, or malice.
 */
export const constructSequenceEvidenceItem = (sequence: ShiftSequence): EvidenceItem => ({
  id: sequence.evidenceId,
  schemaVersion: SCHEMA_VERSION,
  sourceEventIds: [...sequence.relatedEventIds],
  summary: `Correlated behavioral progression for entity '${sequence.actorEntityId}' across ${sequence.features.length} behavioral dimensions (${sequence.features.join(', ')}) from ${sequence.firstObservedAt} to ${sequence.lastObservedAt}.`,
  evidenceType: 'CHANGE_POINT',
  confidence: 1.0,
  narrativeEvidenceIds: [sequence.id],
});

/**
 * Pure causal, deterministic multi-domain sequence correlation engine.
 *
 * Operational Semantics:
 * 1. Actor Isolation: Inputs are strictly partitioned by actorEntityId. Different actors never share a sequence.
 * 2. Temporal Leakage Prevention: Any change point with observedAt > evaluationTime is filtered out prior to evaluation.
 * 3. Canonical Ordering: Change points are sorted by timestamp ascending, then change point ID ordinal tie-break.
 *    Input arrays are never mutated.
 * 4. Bounded Sequential Transitivity: Consecutive change points chain if the gap between them is <= maxTemporalGapMs
 *    and the total span from sequence start is <= maxSequenceSpanMs.
 * 5. Distinct-Feature Rule: A candidate cluster is publicly emitted as a ShiftSequence if and only if it covers
 *    at least TWO distinct featureName values. Single-feature clusters remain internal proto-clusters and are suppressed.
 * 6. Disjoint Membership: Each ChangePoint belongs to at most one public ShiftSequence.
 * 7. Stable Origin Identity: sequence.id and evidenceId are anchored to the first change point and first timestamp,
 *    guaranteeing monotonic extension without identity churn as new members join.
 * 8. Closed Sequence Immutability: Once closed by a gap or span limit, a sequence never re-opens.
 */
export const correlateSequences = (input: CorrelateSequencesInput): SequenceCorrelationResult => {
  if (!input.changePoints || !Array.isArray(input.changePoints)) {
    throw new SequenceCorrelationError('INVALID_INPUT', 'changePoints', 'changePoints array is required.');
  }

  const config: SequenceCorrelationConfig = {
    ...DEFAULT_SEQUENCE_CORRELATION_CONFIG,
    ...input.config,
  };

  let cutoffMs = Number.POSITIVE_INFINITY;
  if (input.evaluationTime) {
    cutoffMs = toNumericTimestamp(input.evaluationTime, 'evaluationTime');
  }

  // 1. TEMPORAL FILTERING & IMMUTABILITY (no caller mutation)
  const filtered: ChangePoint[] = [];
  for (const cp of input.changePoints) {
    if (input.actorEntityId && cp.actorEntityId !== input.actorEntityId) {
      continue;
    }
    const cpTimeMs = toNumericTimestamp(cp.observedAt, `changePoints[${cp.id}].observedAt`);
    if (cpTimeMs <= cutoffMs) {
      filtered.push(cp);
    }
  }

  // 2. PARTITION STRICTLY BY ACTOR ENTITY ID
  const actorBuckets = new Map<string, ChangePoint[]>();
  for (const cp of filtered) {
    let bucket = actorBuckets.get(cp.actorEntityId);
    if (!bucket) {
      bucket = [];
      actorBuckets.set(cp.actorEntityId, bucket);
    }
    bucket.push(cp);
  }

  // Ensure deterministic iteration over actor buckets
  const sortedActorIds = [...actorBuckets.keys()].sort(compareOrdinalStrings);

  const emittedSequences: ShiftSequence[] = [];
  const emittedEvidenceItems: EvidenceItem[] = [];
  let evaluatedChangePointCount = 0;
  let suppressedProtoClusterCount = 0;

  for (const actorId of sortedActorIds) {
    const actorPoints = actorBuckets.get(actorId)!;

    // Canonical ordering: primary observedAt ascending, secondary ID ordinal ascending
    actorPoints.sort((left, right) => {
      const timeDelta = toNumericTimestamp(left.observedAt, 'left.observedAt') - toNumericTimestamp(right.observedAt, 'right.observedAt');
      if (timeDelta !== 0) {
        return timeDelta;
      }
      return compareOrdinalStrings(left.id, right.id);
    });

    evaluatedChangePointCount += actorPoints.length;

    // Cluster points using bounded sequential transitivity (sliding gap)
    const clusters: ChangePoint[][] = [];
    let currentCluster: ChangePoint[] = [];

    for (const cp of actorPoints) {
      if (currentCluster.length === 0) {
        currentCluster.push(cp);
      } else {
        const lastCp = currentCluster[currentCluster.length - 1];
        const firstCp = currentCluster[0];

        const lastTime = toNumericTimestamp(lastCp.observedAt, 'lastCp.observedAt');
        const firstTime = toNumericTimestamp(firstCp.observedAt, 'firstCp.observedAt');
        const currentTime = toNumericTimestamp(cp.observedAt, 'cp.observedAt');

        const gap = currentTime - lastTime;
        const totalSpan = currentTime - firstTime;

        if (gap <= config.maxTemporalGapMs && totalSpan <= config.maxSequenceSpanMs) {
          currentCluster.push(cp);
        } else {
          // Close current cluster and start fresh
          clusters.push(currentCluster);
          currentCluster = [cp];
        }
      }
    }

    if (currentCluster.length > 0) {
      clusters.push(currentCluster);
    }

    // Process each closed cluster
    for (const cluster of clusters) {
      const distinctFeatures = uniqueSortedIds(cluster.map((cp) => cp.featureName));

      // MANDATORY REQUIREMENT: Must cover at least TWO distinct features to be a public ShiftSequence.
      // Single-feature clusters remain internal proto-clusters and are suppressed from public output.
      if (distinctFeatures.length < 2) {
        suppressedProtoClusterCount++;
        continue;
      }

      const firstCp = cluster[0];
      const lastCp = cluster[cluster.length - 1];

      const seqId = stableSequenceId(actorId, firstCp.observedAt, firstCp.id);
      const evidenceId = stableSequenceEvidenceId(actorId, firstCp.observedAt, firstCp.id);

      const changePointIds = cluster.map((cp) => cp.id);
      const relatedEventIds = uniqueSortedIds(cluster.flatMap((cp) => cp.relatedEventIds ?? []));

      const sequence: ShiftSequence = {
        id: seqId,
        schemaVersion: SCHEMA_VERSION,
        actorEntityId: actorId,
        changePointIds,
        firstObservedAt: firstCp.observedAt,
        lastObservedAt: lastCp.observedAt,
        features: distinctFeatures,
        relatedEventIds,
        evidenceId,
      };

      emittedSequences.push(sequence);
      emittedEvidenceItems.push(constructSequenceEvidenceItem(sequence));
    }
  }

  // Canonical ordering for emitted output: firstObservedAt ascending, then id ordinal ascending
  emittedSequences.sort((left, right) => {
    const timeDelta = toNumericTimestamp(left.firstObservedAt, 'left.firstObservedAt') - toNumericTimestamp(right.firstObservedAt, 'right.firstObservedAt');
    if (timeDelta !== 0) {
      return timeDelta;
    }
    return compareOrdinalStrings(left.id, right.id);
  });

  emittedEvidenceItems.sort((left, right) => compareOrdinalStrings(left.id, right.id));

  return {
    sequences: emittedSequences,
    evidenceItems: emittedEvidenceItems,
    evaluatedChangePointCount,
    suppressedProtoClusterCount,
  };
};
