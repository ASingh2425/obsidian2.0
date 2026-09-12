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
  type BaselineSnapshot,
  type ChangePoint,
  type FeatureObservation,
  type ValidationIssue,
} from '../types';

export interface ChangePointDetectorConfig {
  /**
   * Minimum standardized robust deviation (z-score) to qualify as an elevated observation.
   * Default: 3.0 (approx. 3 robust sigma).
   */
  readonly suddenZThreshold: number;

  /**
   * Minimum consecutive windows with z-score >= suddenZThreshold required to confirm
   * a sustained sudden transition rather than an isolated spike.
   * Default: 2.
   */
  readonly minConsecutiveWindows: number;

  /**
   * Allowance parameter k for one-sided CUSUM gradual drift detection.
   * Drift below this allowance decays back towards 0.
   * Default: 0.5.
   */
  readonly driftAllowance: number;

  /**
   * Decision threshold h for one-sided CUSUM gradual drift detection.
   * When cumulative drift S_t >= driftThreshold, a gradual change point is emitted.
   * Default: 5.0.
   */
  readonly driftThreshold: number;

  /**
   * Minimum scale floor used in the denominator when calculating robust z-scores:
   * scale = max(1.4826 * MAD, minScaleFloor).
   * Prevents division by zero or inflated scores for zero-MAD features.
   * Default: 1.0.
   */
  readonly minScaleFloor: number;

  /**
   * Standardized score threshold at or below which an actor's behavior is considered
   * to have returned to nominal, re-arming the detector for subsequent regime transitions.
   * Default: 1.0.
   */
  readonly rearmZThreshold: number;
}

export const DEFAULT_CHANGE_POINT_CONFIG: ChangePointDetectorConfig = {
  suddenZThreshold: 3.0,
  minConsecutiveWindows: 2,
  driftAllowance: 0.5,
  driftThreshold: 5.0,
  minScaleFloor: 1.0,
  rearmZThreshold: 1.0,
};

export interface DetectChangePointsInput {
  readonly actorEntityId: string;
  readonly featureName: string;
  readonly baseline: BaselineSnapshot;
  readonly observations: readonly FeatureObservation[];
  /**
   * Upper temporal boundary T (ISO-8601 string).
   * Any observation with observedAt > evaluationTime is strictly excluded prior
   * to scoring and accumulator progression (guaranteeing zero temporal leakage).
   */
  readonly evaluationTime?: string;
  readonly config?: Partial<ChangePointDetectorConfig>;
}

export interface ChangePointDetectionResult {
  readonly actorEntityId: string;
  readonly featureName: string;
  readonly changePoints: readonly ChangePoint[];
  readonly evaluatedObservationCount: number;
  readonly latestScore: number;
  readonly driftAccumulator: number;
  readonly inElevatedRegime: boolean;
}

export class ChangePointError extends Error implements ValidationIssue {
  readonly code: string;
  readonly path: string;

  constructor(code: string, path: string, message: string) {
    super(message);
    this.name = 'ChangePointError';
    this.code = code;
    this.path = path;
  }
}
