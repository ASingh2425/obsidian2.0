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
  type FeatureObservation,
} from '../types';
import {
  type ChangePointDetectionResult,
  type ChangePointDetectorConfig,
  type DetectChangePointsInput,
  ChangePointError,
  DEFAULT_CHANGE_POINT_CONFIG,
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
    throw new ChangePointError('INVALID_TIMESTAMP', path, `Timestamp '${value}' is not a valid ISO-8601 value.`);
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

const stableChangePointId = (
  actorEntityId: string,
  featureName: string,
  observedAt: string,
): string => `changepoint|${[
  SCHEMA_VERSION,
  actorEntityId,
  featureName,
  observedAt,
].map((v) => encodeURIComponent(v)).join('|')}`;

const stableEvidenceId = (
  actorEntityId: string,
  featureName: string,
  observedAt: string,
): string => `evidence|change-point|${[
  SCHEMA_VERSION,
  actorEntityId,
  featureName,
  observedAt,
].map((v) => encodeURIComponent(v)).join('|')}`;

/**
 * Calculates the robust scale denominator:
 * scale = max(1.4826 * MAD, minScaleFloor)
 *
 * Guaranteed to be finite, non-zero, and positive.
 */
export const computeRobustScale = (mad: number | null, minScaleFloor: number): number => {
  if (mad === null || !Number.isFinite(mad) || mad < 0) {
    return minScaleFloor;
  }
  return Math.max(1.4826 * mad, minScaleFloor);
};

/**
 * Calculates standardized robust z-score:
 * z = (value - median) / scale
 *
 * Guaranteed to be a finite, deterministic number.
 */
export const computeRobustScore = (
  value: number,
  median: number | null,
  scale: number,
): number => {
  if (median === null || !Number.isFinite(median) || !Number.isFinite(value)) {
    return 0;
  }
  if (!Number.isFinite(scale) || scale <= 0) {
    return 0;
  }
  const raw = (value - median) / scale;
  return Number.isFinite(raw) ? raw : 0;
};

/**
 * Deterministic, causal online change-point detector.
 *
 * Architecture & Temporal Invariance:
 * - Operates strictly sequentially over causal observation windows up to evaluationTime.
 * - Any observation with observedAt > evaluationTime is strictly excluded prior to scoring.
 * - Detects both sudden transitions (multi-window persistence) and gradual drift (one-sided CUSUM).
 * - Emits at most ONE ChangePoint per (actorEntityId, featureName, observedAt).
 * - Post-detection regime latching prevents duplicate ChangePoints for the same continuing plateau.
 */
export const detectChangePoints = (input: DetectChangePointsInput): ChangePointDetectionResult => {
  if (!input.actorEntityId || typeof input.actorEntityId !== 'string') {
    throw new ChangePointError('INVALID_INPUT', 'actorEntityId', 'actorEntityId is required.');
  }
  if (!input.featureName || typeof input.featureName !== 'string') {
    throw new ChangePointError('INVALID_INPUT', 'featureName', 'featureName is required.');
  }
  if (!input.baseline) {
    throw new ChangePointError('INVALID_INPUT', 'baseline', 'baseline is required.');
  }

  // 1. BASELINE AUTHORITY:
  // If baseline is not available, or lacks median/MAD statistics, no ChangePoints can be emitted.
  if (!input.baseline.available || input.baseline.median === null || input.baseline.mad === null) {
    return {
      actorEntityId: input.actorEntityId,
      featureName: input.featureName,
      changePoints: [],
      evaluatedObservationCount: 0,
      latestScore: 0,
      driftAccumulator: 0,
      inElevatedRegime: false,
    };
  }

  const config: ChangePointDetectorConfig = {
    ...DEFAULT_CHANGE_POINT_CONFIG,
    ...input.config,
  };

  // 2. TEMPORAL LEAKAGE PREVENTION & CANONICAL FILTERING:
  // Strictly filter observations by actor, feature, and evaluationTime.
  let cutoffMs = Number.POSITIVE_INFINITY;
  if (input.evaluationTime) {
    cutoffMs = toNumericTimestamp(input.evaluationTime, 'evaluationTime');
  }

  // Caller array is never mutated; we copy, filter, and sort canonically.
  const relevantObservations: FeatureObservation[] = [];
  for (const obs of input.observations) {
    if (obs.actorEntityId !== input.actorEntityId || obs.featureName !== input.featureName) {
      continue;
    }
    const obsTimeMs = toNumericTimestamp(obs.observedAt, `observations[${obs.id}].observedAt`);
    if (obsTimeMs <= cutoffMs) {
      if (!Number.isFinite(obs.featureValue)) {
        throw new ChangePointError('INVALID_OBSERVATION', `observations[${obs.id}].featureValue`, `Observation value '${obs.featureValue}' is not finite.`);
      }
      relevantObservations.push(obs);
    }
  }

  // Canonical ordering: primary timestamp ascending, secondary ID ordinal ascending
  relevantObservations.sort((left, right) => {
    const timeDelta = toNumericTimestamp(left.observedAt, 'left.observedAt') - toNumericTimestamp(right.observedAt, 'right.observedAt');
    if (timeDelta !== 0) {
      return timeDelta;
    }
    return compareOrdinalStrings(left.id ?? '', right.id ?? '');
  });

  if (relevantObservations.length === 0) {
    return {
      actorEntityId: input.actorEntityId,
      featureName: input.featureName,
      changePoints: [],
      evaluatedObservationCount: 0,
      latestScore: 0,
      driftAccumulator: 0,
      inElevatedRegime: false,
    };
  }

  // 3. ZERO-MAD POLICY & SCALE COMPUTATION:
  const scale = computeRobustScale(input.baseline.mad, config.minScaleFloor);
  const baselineMedian = input.baseline.median;

  // 4. SEQUENTIAL CAUSAL EVALUATION:
  const changePoints: ChangePoint[] = [];
  let consecutiveSuddenObservations: FeatureObservation[] = [];
  let driftAccumulator = 0;
  let driftContributingObservations: FeatureObservation[] = [];
  let inElevatedRegime = false;
  let latestScore = 0;

  for (const obs of relevantObservations) {
    const z = computeRobustScore(obs.featureValue, baselineMedian, scale);
    latestScore = z;

    // Post-detection re-arm:
    // If we previously latched into an elevated regime, check if the signal has returned to nominal.
    if (inElevatedRegime && z <= config.rearmZThreshold) {
      inElevatedRegime = false;
    }

    // Mechanism A: Sudden Transition with Multi-Window Persistence Filter
    let suddenTriggered = false;
    let suddenContributingEvents: string[] = [];

    if (z >= config.suddenZThreshold) {
      consecutiveSuddenObservations.push(obs);
      if (!inElevatedRegime && consecutiveSuddenObservations.length >= config.minConsecutiveWindows) {
        suddenTriggered = true;
        // Provenance: contributing observations from the sustained consecutive window
        const contributing = consecutiveSuddenObservations.slice(-config.minConsecutiveWindows);
        suddenContributingEvents = uniqueSortedIds(contributing.flatMap((item) => item.eventIds ?? []));
      }
    } else {
      // Single spike or dip resets the consecutive counter (AT-CHANGE-003)
      consecutiveSuddenObservations = [];
    }

    // Mechanism B: Gradual Drift (Tabular One-Sided CUSUM)
    let driftTriggered = false;
    let driftContributingEvents: string[] = [];

    if (!inElevatedRegime) {
      // Cap single-window score for drift accumulation at suddenZThreshold so that
      // gradual drift measures accumulated shift across windows and isolated spikes cannot bypass persistence
      const effectiveDriftZ = Math.min(Math.max(0, z), config.suddenZThreshold);
      const excess = effectiveDriftZ - config.driftAllowance;

      if (driftAccumulator + excess > 0) {
        driftAccumulator += excess;
        if (effectiveDriftZ > config.driftAllowance) {
          driftContributingObservations.push(obs);
        }
      } else {
        driftAccumulator = 0;
        driftContributingObservations = [];
      }

      if (
        driftAccumulator >= config.driftThreshold &&
        driftContributingObservations.length >= config.minConsecutiveWindows
      ) {
        driftTriggered = true;
        driftContributingEvents = uniqueSortedIds(driftContributingObservations.flatMap((item) => item.eventIds ?? []));
      }
    } else {
      // While latched in an elevated regime, drift accumulator stays at 0
      driftAccumulator = 0;
      driftContributingObservations = [];
    }

    // AT MOST ONE ChangePoint per (actorEntityId, featureName, observedAt)
    if (suddenTriggered || driftTriggered) {
      const combinedContributingEvents = uniqueSortedIds([
        ...suddenContributingEvents,
        ...driftContributingEvents,
      ]);

      const changePointId = stableChangePointId(input.actorEntityId, input.featureName, obs.observedAt);
      const evidenceId = stableEvidenceId(input.actorEntityId, input.featureName, obs.observedAt);

      changePoints.push({
        id: changePointId,
        schemaVersion: SCHEMA_VERSION,
        actorEntityId: input.actorEntityId,
        observedAt: obs.observedAt,
        featureName: input.featureName,
        rawDeviationScore: Math.round(z * 10000) / 10000,
        relatedEventIds: combinedContributingEvents,
        evidenceId,
      });

      // Post-detection reset / regime latching:
      // Entering an elevated regime suppresses duplicate ChangePoints until re-armed
      inElevatedRegime = true;
      consecutiveSuddenObservations = [];
      driftAccumulator = 0;
      driftContributingObservations = [];
    }
  }

  return {
    actorEntityId: input.actorEntityId,
    featureName: input.featureName,
    changePoints,
    evaluatedObservationCount: relevantObservations.length,
    latestScore: Math.round(latestScore * 10000) / 10000,
    driftAccumulator: Math.round(driftAccumulator * 10000) / 10000,
    inElevatedRegime,
  };
};
