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
  type ContextOutcome,
  type DataQuality,
  type RiskAssessment,
  type SecurityEvent,
} from '../types';
import type {
  ChangePointContextMatch,
  ContextReconciliationResult,
} from '../context';
import type { ComposeRiskAssessmentParams } from './types';

/**
 * Characteristic scale constant z0 for soft-saturation.
 * Anchored to the canonical M4 change-point threshold (3.0 sigma).
 */
export const Z0_SCALE = 3.0;

/**
 * Normalizes a robust change point deviation score z into [0, 1)
 * using the approved soft-saturation function:
 * s(z) = 1.0 - 1.0 / (1.0 + z / z0)
 */
export const normalizeDeviation = (z: number, z0 = Z0_SCALE): number => {
  if (z <= 0 || !Number.isFinite(z)) {
    return 0.0;
  }
  return 1.0 - 1.0 / (1.0 + z / z0);
};

/**
 * Sub-additive aggregation family for a collection of change points:
 * aggregate = 1.0 - prod(1.0 - s(c_i))
 */
export const aggregateChangePointDeviations = (
  changePoints: readonly ChangePoint[],
  z0 = Z0_SCALE,
): number => {
  if (changePoints.length === 0) {
    return 0.0;
  }
  let product = 1.0;
  for (const cp of changePoints) {
    const s = normalizeDeviation(cp.rawDeviationScore, z0);
    product *= 1.0 - s;
  }
  const result = 1.0 - product;
  // Numerical clamp to [0, 1] to prevent IEEE-754 precision artifacts
  return Math.min(1.0, Math.max(0.0, result));
};

/**
 * Composes an explainable residual risk assessment for a ShiftSequence
 * given its M6 ContextReconciliationResult and underlying immutable domain artifacts.
 */
export const composeRiskAssessment = (
  params: ComposeRiskAssessmentParams,
): RiskAssessment => {
  const { sequence, reconciliation, changePoints, sourceEvents, evaluationTime } = params;

  // Filter change points causally if evaluationTime T is provided
  const evalTimestamp = evaluationTime ? Date.parse(evaluationTime) : Number.POSITIVE_INFINITY;
  
  // Collect change points belonging to this sequence up to evalTimestamp
  const sequenceCpIds = new Set(sequence.changePointIds);
  const relevantChangePoints = changePoints
    .filter((cp) => sequenceCpIds.has(cp.id) && Date.parse(cp.observedAt) <= evalTimestamp)
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt) || a.id.localeCompare(b.id));

  // Determine covered change points from reconciliation matches
  const coveredCpIds = new Set(
    reconciliation.changePointMatches
      .filter((m) => m.matched)
      .map((m) => m.changePointId),
  );

  // Partition into covered vs residual change points
  const coveredChangePoints = relevantChangePoints.filter((cp) => coveredCpIds.has(cp.id));
  const residualChangePoints = relevantChangePoints.filter((cp) => !coveredCpIds.has(cp.id));

  // 1. rawDeviation = aggregate(all constituent ChangePoints)
  const rawDeviation = aggregateChangePointDeviations(relevantChangePoints);

  // 2. contextCoverage = coveredChangePointIds.length / relatedChangePointIds.length
  const contextCoverage = relevantChangePoints.length > 0
    ? coveredChangePoints.length / relevantChangePoints.length
    : 0.0;

  // 3. residualRisk = aggregate(residual ChangePoints only)
  const residualRisk = aggregateChangePointDeviations(residualChangePoints);

  // 4. Structural Confidence:
  // Build lookup of available source events up to evalTimestamp
  const availableEventIdSet = new Set(
    sourceEvents
      .filter((ev) => Date.parse(ev.timestamp) <= evalTimestamp)
      .map((ev) => ev.id),
  );

  // Collect all required event IDs across constituent change points
  const allRequiredEventIds = relevantChangePoints.flatMap((cp) => cp.relatedEventIds);
  const uniqueRequiredEventIds = [...new Set(allRequiredEventIds)].sort();

  const resolvedEventCount = uniqueRequiredEventIds.filter((id) => availableEventIdSet.has(id)).length;
  const eventCompletenessRatio = uniqueRequiredEventIds.length > 0
    ? resolvedEventCount / uniqueRequiredEventIds.length
    : 1.0;

  // Deterministically evaluable change points: matchReason !== 'INSUFFICIENT_EVIDENCE'
  const cpMatchMap = new Map(reconciliation.changePointMatches.map((m) => [m.changePointId, m]));
  let deterministicallyEvaluableCount = 0;
  let incompleteContextCount = 0;

  for (const cp of relevantChangePoints) {
    const match = cpMatchMap.get(cp.id);
    if (!match || match.matchReason === 'INSUFFICIENT_EVIDENCE' || match.temporalOverlap === 'INDETERMINATE' || match.scopeCompatible === 'INDETERMINATE') {
      incompleteContextCount++;
    } else {
      deterministicallyEvaluableCount++;
    }
  }

  const contextCertaintyRatio = relevantChangePoints.length > 0
    ? deterministicallyEvaluableCount / relevantChangePoints.length
    : 1.0;

  const confidence = eventCompletenessRatio * contextCertaintyRatio;

  // 5. Structural DataQuality:
  const missingEventIds = uniqueRequiredEventIds.filter((id) => !availableEventIdSet.has(id));
  const missingFields: string[] = missingEventIds.map((id) => `sourceEvent:${id}`);

  let level: DataQuality['level'];
  if (missingFields.length > 0 || incompleteContextCount > 0) {
    level = 'LOW';
  } else {
    // If no missing events and zero incomplete context, it is HIGH
    level = 'HIGH';
  }

  const dataQuality: DataQuality = {
    qualityId: `quality|risk|${sequence.id}`,
    level,
    missingFields,
    incompleteContextCount,
    lowConfidenceSources: [...missingEventIds],
  };

  // 6. Outcome state
  let contextOutcome: ContextOutcome;
  if (reconciliation.reconciliationState === 'INDETERMINATE' || incompleteContextCount > 0) {
    contextOutcome = 'INDETERMINATE';
  } else if (contextCoverage === 1.0) {
    contextOutcome = 'EXPLAINED';
  } else if (contextCoverage === 0.0) {
    contextOutcome = 'UNEXPLAINED';
  } else {
    contextOutcome = 'PARTIALLY_EXPLAINED';
  }

  // 7. Provenance Partitioning (SecurityEvent IDs only)
  // Deduplicate and canonical sort
  const sourceEvidenceIds = uniqueRequiredEventIds;

  const coveredEventIdsSet = new Set(
    coveredChangePoints.flatMap((cp) => cp.relatedEventIds).filter((id) => availableEventIdSet.has(id)),
  );
  const coveredEvidenceIds = [...coveredEventIdsSet].sort();

  const uncoveredEventIdsSet = new Set(
    residualChangePoints.flatMap((cp) => cp.relatedEventIds).filter((id) => availableEventIdSet.has(id)),
  );
  const uncoveredEvidenceIds = [...uncoveredEventIdsSet].sort();

  // Narrative links: sequence, change points, and context grants
  const narrativeEvidenceIds = [
    sequence.id,
    ...relevantChangePoints.map((cp) => cp.id),
    ...reconciliation.matchedGrantIds,
  ];

  return {
    id: `risk|seq|${sequence.id}`,
    schemaVersion: SCHEMA_VERSION,
    caseId: sequence.id,
    relatedChangePointIds: relevantChangePoints.map((cp) => cp.id),
    rawDeviation,
    contextCoverage,
    residualRisk,
    confidence,
    dataQuality,
    contextOutcome,
    sourceEvidenceIds,
    coveredEvidenceIds,
    uncoveredEvidenceIds,
    narrativeEvidenceIds,
  };
};
