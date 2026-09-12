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
  type ChangePoint,
  type EvidenceItem,
  type ShiftSequence,
  type ValidationIssue,
} from '../types';

export interface SequenceCorrelationConfig {
  /**
   * Maximum permitted time gap between consecutive change points to maintain continuity.
   * If the gap between change point N and change point N+1 exceeds this value, the current
   * sequence is closed and change point N+1 starts a new candidate cluster.
   * Default: 3,600,000 ms (1 hour).
   */
  readonly maxTemporalGapMs: number;

  /**
   * Maximum total duration allowed for a single sequence from firstObservedAt to lastObservedAt.
   * Prevents unbounded transitivity / perpetual sequence chaining.
   * Default: 86,400,000 ms (24 hours).
   */
  readonly maxSequenceSpanMs: number;
}

export const DEFAULT_SEQUENCE_CORRELATION_CONFIG: SequenceCorrelationConfig = {
  maxTemporalGapMs: 3600000, // 1 hour
  maxSequenceSpanMs: 86400000, // 24 hours
};

export interface CorrelateSequencesInput {
  readonly changePoints: readonly ChangePoint[];
  /**
   * Optional actorEntityId filter. If omitted, the engine partitions inputs
   * by actorEntityId to ensure 100% strict actor isolation.
   */
  readonly actorEntityId?: string;
  /**
   * Strict upper evaluation boundary T (ISO-8601 string).
   * Any change point with observedAt > evaluationTime is filtered out prior to
   * partitioning, clustering, provenance collection, or EvidenceItem construction.
   */
  readonly evaluationTime?: string;
  readonly config?: Partial<SequenceCorrelationConfig>;
}

export interface SequenceCorrelationResult {
  readonly sequences: readonly ShiftSequence[];
  readonly evidenceItems: readonly EvidenceItem[];
  readonly evaluatedChangePointCount: number;
  readonly suppressedProtoClusterCount: number;
}

export class SequenceCorrelationError extends Error implements ValidationIssue {
  readonly code: string;
  readonly path: string;

  constructor(code: string, path: string, message: string) {
    super(message);
    this.name = 'SequenceCorrelationError';
    this.code = code;
    this.path = path;
  }
}
