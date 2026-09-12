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

import type {
  ChangePoint,
  ContextGrant,
  EvidenceItem,
  IdRecord,
  SecurityEvent,
  ShiftSequence,
} from '../types';

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

export interface ReconcileContextInput {
  readonly sequences: readonly ShiftSequence[];
  readonly changePoints: readonly ChangePoint[];
  readonly contextGrants: readonly ContextGrant[];
  readonly sourceEvents: readonly SecurityEvent[];
  readonly actorEntityId?: string;
  readonly evaluationTime?: string;
}

export class ContextReconciliationError extends Error {
  readonly code: string;
  readonly field: string;

  constructor(code: string, field: string, message: string) {
    super(message);
    this.name = 'ContextReconciliationError';
    this.code = code;
    this.field = field;
  }
}
