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
  type ContextGrant,
  type EvidenceItem,
  type SecurityEvent,
  type ShiftSequence,
} from '../types';
import {
  type ChangePointContextMatch,
  type CompatibilityTriState,
  type ContextMatchReason,
  type ContextReconciliationResult,
  type ContextReconciliationState,
  type ReconcileContextInput,
  ContextReconciliationError,
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
    throw new ContextReconciliationError('INVALID_TIMESTAMP', path, `Timestamp '${value}' is not a valid ISO-8601 value.`);
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
 * Extracts target resource identifier from a canonical SecurityEvent.
 */
export const extractEventResource = (event: SecurityEvent): string | undefined => {
  if (event.resourceId && event.resourceId.trim() !== '') {
    return event.resourceId.trim();
  }
  if (event.domain === 'AUTHENTICATION' && event.destinationEntityId && event.destinationEntityId.trim() !== '') {
    return event.destinationEntityId.trim();
  }
  if (event.domain === 'PRIVILEGE_ACTIVITY' && event.destinationEntityId && event.destinationEntityId.trim() !== '') {
    return event.destinationEntityId.trim();
  }
  if (event.deviceEntityId && event.deviceEntityId.trim() !== '') {
    return event.deviceEntityId.trim();
  }
  return undefined;
};

/**
 * Extracts operation / action identifier from a canonical SecurityEvent.
 */
export const extractEventOperation = (event: SecurityEvent): string | undefined => {
  if (event.action && event.action.trim() !== '') {
    return event.action.trim();
  }
  if (event.eventType && event.eventType.trim() !== '') {
    return event.eventType.trim();
  }
  return undefined;
};

/**
 * Evaluates a single ChangePoint against available ContextGrants.
 */
interface EvaluateChangePointResult {
  readonly match: ChangePointContextMatch;
  readonly coveredEventIds: readonly string[];
  readonly uncoveredEventIds: readonly string[];
}

const evaluateChangePoint = (
  cp: ChangePoint,
  eventMap: Map<string, SecurityEvent>,
  actorGrants: readonly ContextGrant[],
): EvaluateChangePointResult => {
  const relatedIds = cp.relatedEventIds ?? [];

  // Structural check 1: Are there contributing events?
  if (relatedIds.length === 0) {
    return {
      match: {
        changePointId: cp.id,
        matched: false,
        matchedGrantIds: [],
        temporalOverlap: 'INDETERMINATE',
        scopeCompatible: 'INDETERMINATE',
        matchReason: 'INSUFFICIENT_EVIDENCE',
      },
      coveredEventIds: [],
      uncoveredEventIds: [],
    };
  }

  // Structural check 2: Can all contributing events be resolved in sourceEvents?
  const resolvedEvents: SecurityEvent[] = [];
  for (const id of relatedIds) {
    const ev = eventMap.get(id);
    if (!ev) {
      return {
        match: {
          changePointId: cp.id,
          matched: false,
          matchedGrantIds: [],
          temporalOverlap: 'INDETERMINATE',
          scopeCompatible: 'INDETERMINATE',
          matchReason: 'INSUFFICIENT_EVIDENCE',
        },
        coveredEventIds: [],
        uncoveredEventIds: [...relatedIds],
      };
    }
    resolvedEvents.push(ev);
  }

  // If no grants exist for this actor:
  if (actorGrants.length === 0) {
    return {
      match: {
        changePointId: cp.id,
        matched: false,
        matchedGrantIds: [],
        temporalOverlap: 'INCOMPATIBLE',
        scopeCompatible: 'INCOMPATIBLE',
        matchReason: 'NO_APPLICABLE_CONTEXT',
      },
      coveredEventIds: [],
      uncoveredEventIds: [...relatedIds],
    };
  }

  const cpTimestamp = toNumericTimestamp(cp.observedAt, `changePoint[${cp.id}].observedAt`);

  let anyTemporalOverlap = false;
  let anyResourceMismatch = false;
  let anyOperationMismatch = false;
  let anyEvidenceIndeterminate = false;
  const matchedGrantIds: string[] = [];

  for (const grant of actorGrants) {
    const validFromNum = toNumericTimestamp(grant.validFrom, `grant[${grant.id}].validFrom`);
    const validToNum = toNumericTimestamp(grant.validTo, `grant[${grant.id}].validTo`);

    // Temporal applicability: closed interval [validFrom, validTo]
    if (cpTimestamp < validFromNum || cpTimestamp > validToNum) {
      continue;
    }

    anyTemporalOverlap = true;

    // Evaluate Resource and Operation Scope for all contributing events
    const grantResources = (grant.resourceScope ?? []).map((r) => r.trim());
    const isResourceWildcard = grantResources.includes('*');

    const grantOperations = (grant.actionScope ?? []).map((a) => a.trim());
    const isOperationWildcard = grantOperations.includes('*');

    let allEventsResourceMatch = true;
    let allEventsOperationMatch = true;
    let grantIndeterminate = false;

    for (const ev of resolvedEvents) {
      const evResource = extractEventResource(ev);
      const evOperation = extractEventOperation(ev);

      // Resource check
      if (!isResourceWildcard) {
        if (!evResource) {
          // If the grant specifically restricts resources, but the event lacks resource info,
          // compatibility is structurally unknowable
          grantIndeterminate = true;
          allEventsResourceMatch = false;
        } else if (!grantResources.includes(evResource)) {
          allEventsResourceMatch = false;
        }
      }

      // Operation check
      if (!isOperationWildcard) {
        if (!evOperation) {
          grantIndeterminate = true;
          allEventsOperationMatch = false;
        } else if (!grantOperations.includes(evOperation)) {
          allEventsOperationMatch = false;
        }
      }
    }

    if (grantIndeterminate) {
      anyEvidenceIndeterminate = true;
    } else if (allEventsResourceMatch && allEventsOperationMatch) {
      matchedGrantIds.push(grant.id);
    } else {
      if (!allEventsResourceMatch) {
        anyResourceMismatch = true;
      }
      if (!allEventsOperationMatch) {
        anyOperationMismatch = true;
      }
    }
  }

  // Canonical sorting of matched grant IDs
  matchedGrantIds.sort(compareOrdinalStrings);

  if (matchedGrantIds.length > 0) {
    return {
      match: {
        changePointId: cp.id,
        matched: true,
        matchedGrantIds,
        temporalOverlap: 'COMPATIBLE',
        scopeCompatible: 'COMPATIBLE',
        matchReason: 'MATCHED',
      },
      coveredEventIds: [...relatedIds],
      uncoveredEventIds: [],
    };
  }

  // No grant fully matched this ChangePoint
  let matchReason: ContextMatchReason = 'TEMPORAL_MISMATCH';
  let temporalOverlap: CompatibilityTriState = 'INCOMPATIBLE';
  let scopeCompatible: CompatibilityTriState = 'INCOMPATIBLE';

  if (anyEvidenceIndeterminate) {
    matchReason = 'INSUFFICIENT_EVIDENCE';
    temporalOverlap = anyTemporalOverlap ? 'COMPATIBLE' : 'INCOMPATIBLE';
    scopeCompatible = 'INDETERMINATE';
  } else if (anyTemporalOverlap) {
    temporalOverlap = 'COMPATIBLE';
    if (anyResourceMismatch) {
      matchReason = 'RESOURCE_MISMATCH';
      scopeCompatible = 'INCOMPATIBLE';
    } else if (anyOperationMismatch) {
      matchReason = 'OPERATION_MISMATCH';
      scopeCompatible = 'INCOMPATIBLE';
    } else {
      matchReason = 'NO_APPLICABLE_CONTEXT';
      scopeCompatible = 'INCOMPATIBLE';
    }
  } else {
    matchReason = 'TEMPORAL_MISMATCH';
    temporalOverlap = 'INCOMPATIBLE';
    scopeCompatible = 'INCOMPATIBLE';
  }

  return {
    match: {
      changePointId: cp.id,
      matched: false,
      matchedGrantIds: [],
      temporalOverlap,
      scopeCompatible,
      matchReason,
    },
    coveredEventIds: [],
    uncoveredEventIds: [...relatedIds],
  };
};

/**
 * Deterministic evidence item constructor for context reconciliation.
 */
const constructContextEvidenceItem = (
  sequence: ShiftSequence,
  reconciliationState: ContextReconciliationState,
  matchedGrantIds: readonly string[],
  coveredEventIds: readonly string[],
  grantMap: Map<string, ContextGrant>,
): EvidenceItem => {
  const stableEvidenceId = `evidence|context|${SCHEMA_VERSION}|${encodeURIComponent(sequence.id)}`;

  // Narrative links: sequence ID and all contributing matched context grant IDs
  const narrativeEvidenceIds = [sequence.id, ...matchedGrantIds];

  // Summary: strictly factual deterministic text. No LLM generation.
  let summary = `Context reconciliation for actor '${sequence.actorEntityId}' across sequence '${sequence.id}': ${reconciliationState}.`;
  if (matchedGrantIds.length > 0) {
    summary += ` Covered by ${matchedGrantIds.length} approved grant(s): [${matchedGrantIds.join(', ')}].`;
  } else {
    summary += ` No matching context grants identified for this activity.`;
  }

  // Context confidence: reflects context record source reliability / provenance.
  // Conservative policy: minimum confidence of matched grants, or 1.0 if no grants matched (since absence of match is deterministic)
  // or default to 1.0 if not specified on grant.
  let confidence = 1.0;
  if (matchedGrantIds.length > 0) {
    let minConf = 1.0;
    for (const gid of matchedGrantIds) {
      const g = grantMap.get(gid);
      // ContextGrant currently does not require numeric confidence; if present on rawMetadata or as a field, respect it.
      if (g && typeof (g as unknown as { confidence?: number }).confidence === 'number') {
        const val = (g as unknown as { confidence: number }).confidence;
        if (val < minConf) {
          minConf = val;
        }
      }
    }
    confidence = minConf;
  }

  return {
    id: stableEvidenceId,
    schemaVersion: SCHEMA_VERSION,
    sourceEventIds: uniqueSortedIds(coveredEventIds),
    summary,
    evidenceType: 'CONTEXT',
    confidence,
    narrativeEvidenceIds,
  };
};

/**
 * Reconciles sequences and change points against organizational context grants.
 *
 * Pure, deterministic function.
 * Does not mutate inputs.
 * Strictly respects valid-time causality (evaluationTime).
 */
export const reconcileContext = (input: ReconcileContextInput): ContextReconciliationResult[] => {
  const {
    sequences,
    changePoints,
    contextGrants,
    sourceEvents,
    actorEntityId,
    evaluationTime,
  } = input;

  const evalTimeNum = evaluationTime ? toNumericTimestamp(evaluationTime, 'evaluationTime') : undefined;

  // Build immutable fast lookup maps
  const eventMap = new Map<string, SecurityEvent>();
  for (const ev of sourceEvents) {
    if (ev && ev.id) {
      eventMap.set(ev.id, ev);
    }
  }

  const changePointMap = new Map<string, ChangePoint>();
  for (const cp of changePoints) {
    if (cp && cp.id) {
      // Exclude change points observed strictly after evaluationTime T
      if (evalTimeNum !== undefined) {
        const cpTime = toNumericTimestamp(cp.observedAt, `changePoint[${cp.id}].observedAt`);
        if (cpTime > evalTimeNum) {
          continue;
        }
      }
      changePointMap.set(cp.id, cp);
    }
  }

  const grantMap = new Map<string, ContextGrant>();
  // Group context grants by actorEntityId, filtering out grants starting after evaluationTime T
  const actorGrantMap = new Map<string, ContextGrant[]>();
  for (const grant of contextGrants) {
    if (!grant || !grant.id || !grant.actorEntityId) {
      continue;
    }

    if (evalTimeNum !== undefined) {
      const validFromNum = toNumericTimestamp(grant.validFrom, `grant[${grant.id}].validFrom`);
      if (validFromNum > evalTimeNum) {
        // Valid-time causality: grant does not exist yet at evaluation time T
        continue;
      }
    }

    grantMap.set(grant.id, grant);

    const list = actorGrantMap.get(grant.actorEntityId) ?? [];
    list.push(grant);
    actorGrantMap.set(grant.actorEntityId, list);
  }

  // Sort actor grants canonically: validFrom ascending, then id ascending
  for (const [actor, list] of actorGrantMap.entries()) {
    list.sort((a, b) => {
      const timeDelta = Date.parse(a.validFrom) - Date.parse(b.validFrom);
      if (timeDelta !== 0) {
        return timeDelta;
      }
      return compareOrdinalStrings(a.id, b.id);
    });
  }

  // Filter sequences by actorEntityId if specified
  const targetSequences = actorEntityId
    ? sequences.filter((s) => s.actorEntityId === actorEntityId)
    : sequences;

  // Canonical ordering of sequences: firstObservedAt ascending, then id ascending
  const sortedSequences = [...targetSequences].sort((a, b) => {
    const timeDelta = Date.parse(a.firstObservedAt) - Date.parse(b.firstObservedAt);
    if (timeDelta !== 0) {
      return timeDelta;
    }
    return compareOrdinalStrings(a.id, b.id);
  });

  const results: ContextReconciliationResult[] = [];

  for (const seq of sortedSequences) {
    // Check if sequence firstObservedAt is strictly after evaluationTime T
    if (evalTimeNum !== undefined) {
      const seqFirstTime = toNumericTimestamp(seq.firstObservedAt, `sequence[${seq.id}].firstObservedAt`);
      if (seqFirstTime > evalTimeNum) {
        continue;
      }
    }

    const actorGrants = actorGrantMap.get(seq.actorEntityId) ?? [];
    const changePointMatches: ChangePointContextMatch[] = [];
    const seqCoveredEventIds: string[] = [];
    const seqUncoveredEventIds: string[] = [];
    const allMatchedGrantIds = new Set<string>();

    let anyIndeterminate = false;
    let matchCount = 0;
    let evaluatedCpCount = 0;

    for (const cpId of seq.changePointIds) {
      const cp = changePointMap.get(cpId);
      if (!cp) {
        // ChangePoint missing or after evaluationTime
        anyIndeterminate = true;
        changePointMatches.push({
          changePointId: cpId,
          matched: false,
          matchedGrantIds: [],
          temporalOverlap: 'INDETERMINATE',
          scopeCompatible: 'INDETERMINATE',
          matchReason: 'INSUFFICIENT_EVIDENCE',
        });
        continue;
      }

      evaluatedCpCount += 1;
      const { match, coveredEventIds, uncoveredEventIds } = evaluateChangePoint(cp, eventMap, actorGrants);
      changePointMatches.push(match);

      if (match.matchReason === 'INSUFFICIENT_EVIDENCE') {
        anyIndeterminate = true;
      } else if (match.matched) {
        matchCount += 1;
        for (const gid of match.matchedGrantIds) {
          allMatchedGrantIds.add(gid);
        }
      }

      for (const id of coveredEventIds) {
        seqCoveredEventIds.push(id);
      }
      for (const id of uncoveredEventIds) {
        seqUncoveredEventIds.push(id);
      }
    }

    // Sequence Aggregation Truth Table:
    // 1. ANY constituent CP structurally INDETERMINATE -> INDETERMINATE
    // 2. ALL constituent CPs matched -> EXPLAINED
    // 3. SOME matched + SOME unmatched -> PARTIALLY_EXPLAINED
    // 4. NONE matched -> UNEXPLAINED
    let reconciliationState: ContextReconciliationState;

    if (anyIndeterminate || evaluatedCpCount === 0) {
      reconciliationState = 'INDETERMINATE';
    } else if (matchCount === evaluatedCpCount) {
      reconciliationState = 'EXPLAINED';
    } else if (matchCount > 0) {
      reconciliationState = 'PARTIALLY_EXPLAINED';
    } else {
      reconciliationState = 'UNEXPLAINED';
    }

    const sortedMatchedGrantIds = [...allMatchedGrantIds].sort(compareOrdinalStrings);
    const sortedCoveredEventIds = uniqueSortedIds(seqCoveredEventIds);
    const sortedUncoveredEventIds = uniqueSortedIds(seqUncoveredEventIds);

    const evidenceItem = constructContextEvidenceItem(
      seq,
      reconciliationState,
      sortedMatchedGrantIds,
      sortedCoveredEventIds,
      grantMap,
    );

    const stableResultId = `reconciliation|${SCHEMA_VERSION}|${encodeURIComponent(seq.id)}`;

    results.push({
      id: stableResultId,
      sequenceId: seq.id,
      actorEntityId: seq.actorEntityId,
      reconciliationState,
      matchedGrantIds: sortedMatchedGrantIds,
      changePointMatches,
      evidenceItem,
      coveredEventIds: sortedCoveredEventIds,
      uncoveredEventIds: sortedUncoveredEventIds,
    });
  }

  return results;
};
