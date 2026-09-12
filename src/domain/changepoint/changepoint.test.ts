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
  type BaselineSnapshot,
  type FeatureObservation,
} from '../types';
import {
  computeRobustScale,
  computeRobustScore,
  detectChangePoints,
  DEFAULT_CHANGE_POINT_CONFIG,
} from './index';

// Helper fixtures
const createBaseline = (overrides: Partial<BaselineSnapshot> = {}): BaselineSnapshot => ({
  id: 'baseline|PERSONAL|ACTOR-001|read_count|2026-03-01T00:00:00Z',
  schemaVersion: SCHEMA_VERSION,
  actorEntityId: 'ACTOR-001',
  asOf: '2026-03-01T00:00:00Z',
  baselineType: 'PERSONAL',
  featureName: 'read_count',
  sampleCount: 14,
  observationCount: 14,
  median: 5,
  mad: 2,
  min: 1,
  max: 10,
  coverage: 1.0,
  quality: 'HIGH',
  available: true,
  sourceObservationIds: ['obs-1'],
  sourceEventIds: ['evt-base-1'],
  ...overrides,
});

const createObservation = (
  id: string,
  observedAt: string,
  featureValue: number,
  eventIds: string[] = [],
  featureName = 'read_count',
  actorEntityId = 'ACTOR-001',
): FeatureObservation => ({
  id,
  schemaVersion: SCHEMA_VERSION,
  actorEntityId,
  featureName,
  featureValue,
  observedAt,
  eventIds,
  source: 'DERIVED',
});

describe('Milestone 4 — Online Change-Point Detection', () => {
  describe('Robust Scale & Score Arithmetic (Zero-MAD Policy)', () => {
    it('computes robust scale with non-zero MAD using standard formula (1.4826 * MAD)', () => {
      const scale = computeRobustScale(2, 1.0);
      expect(scale).toBeCloseTo(1.4826 * 2, 4);
    });

    it('enforces minScaleFloor when MAD is 0 (zero-MAD policy)', () => {
      const scale = computeRobustScale(0, 1.0);
      expect(scale).toBe(1.0);
    });

    it('never produces NaN, Infinity, or zero scale', () => {
      expect(computeRobustScale(null, 1.0)).toBe(1.0);
      expect(computeRobustScale(-5, 1.0)).toBe(1.0);
      expect(Number.isFinite(computeRobustScale(0, 1.0))).toBe(true);
    });

    it('evaluates median = 0, MAD = 0, observation = 0 as exactly 0.0', () => {
      const scale = computeRobustScale(0, 1.0);
      const score = computeRobustScore(0, 0, scale);
      expect(score).toBe(0.0);
    });

    it('evaluates median = 0, MAD = 0, observation > 0 as detectable and finite', () => {
      const scale = computeRobustScale(0, 1.0);
      const score = computeRobustScore(12, 0, scale);
      expect(score).toBe(12.0);
      expect(Number.isFinite(score)).toBe(true);
    });

    it('handles repeated post-jump observations deterministically', () => {
      const scale = computeRobustScale(0, 1.0);
      const score1 = computeRobustScore(12, 0, scale);
      const score2 = computeRobustScore(12, 0, scale);
      expect(score1).toBe(score2);
      expect(score1).toBe(12.0);
    });
  });

  describe('Baseline Authority', () => {
    it('does not emit ChangePoints when baseline.available is false', () => {
      const baseline = createBaseline({ available: false });
      const observations = [
        createObservation('obs-1', '2026-03-01T10:00:00Z', 100, ['evt-1']),
        createObservation('obs-2', '2026-03-01T10:15:00Z', 100, ['evt-2']),
      ];

      const result = detectChangePoints({
        actorEntityId: 'ACTOR-001',
        featureName: 'read_count',
        baseline,
        observations,
      });

      expect(result.changePoints).toHaveLength(0);
      expect(result.evaluatedObservationCount).toBe(0);
    });

    it('does not emit ChangePoints when baseline median or mad is null', () => {
      const baseline = createBaseline({ available: true, median: null, mad: null });
      const observations = [
        createObservation('obs-1', '2026-03-01T10:00:00Z', 100, ['evt-1']),
        createObservation('obs-2', '2026-03-01T10:15:00Z', 100, ['evt-2']),
      ];

      const result = detectChangePoints({
        actorEntityId: 'ACTOR-001',
        featureName: 'read_count',
        baseline,
        observations,
      });

      expect(result.changePoints).toHaveLength(0);
    });
  });

  describe('AT-CHANGE-001: Sustained Sudden Transition', () => {
    it('produces a change point linked to evidence when deviation is sustained across multiple windows', () => {
      // Baseline: median = 5, mad = 2 -> scale = 2.9652
      // suddenZThreshold = 3.0 -> required deviation = 5 + 3.0 * 2.9652 = 13.89
      // minConsecutiveWindows = 2
      const baseline = createBaseline();
      const observations = [
        createObservation('obs-1', '2026-03-01T10:00:00Z', 5, ['evt-1']),
        createObservation('obs-2', '2026-03-01T10:15:00Z', 25, ['evt-2']), // z ~ 6.74 (window 1 of elevation)
        createObservation('obs-3', '2026-03-01T10:30:00Z', 26, ['evt-3']), // z ~ 7.08 (window 2 of elevation -> triggers!)
      ];

      const result = detectChangePoints({
        actorEntityId: 'ACTOR-001',
        featureName: 'read_count',
        baseline,
        observations,
      });

      expect(result.changePoints).toHaveLength(1);
      const cp = result.changePoints[0];
      expect(cp.observedAt).toBe('2026-03-01T10:30:00Z');
      expect(cp.actorEntityId).toBe('ACTOR-001');
      expect(cp.featureName).toBe('read_count');
      expect(cp.schemaVersion).toBe(SCHEMA_VERSION);
      expect(cp.rawDeviationScore).toBeGreaterThan(6.5);
      expect(cp.evidenceId).toContain('evidence|change-point|');

      // Provenance: contributing events from the sustained windows
      expect(cp.relatedEventIds).toEqual(['evt-2', 'evt-3']);
      expect(cp.relatedEventIds).not.toContain('evt-1');
    });
  });

  describe('AT-CHANGE-002: Stable Behavior Within Range', () => {
    it('produces no change points and marks no transition for nominal observations', () => {
      const baseline = createBaseline();
      const observations = [
        createObservation('obs-1', '2026-03-01T10:00:00Z', 5, ['evt-1']),
        createObservation('obs-2', '2026-03-01T10:15:00Z', 6, ['evt-2']),
        createObservation('obs-3', '2026-03-01T10:30:00Z', 4, ['evt-3']),
        createObservation('obs-4', '2026-03-01T10:45:00Z', 5, ['evt-4']),
      ];

      const result = detectChangePoints({
        actorEntityId: 'ACTOR-001',
        featureName: 'read_count',
        baseline,
        observations,
      });

      expect(result.changePoints).toHaveLength(0);
      expect(result.driftAccumulator).toBe(0);
      expect(result.inElevatedRegime).toBe(false);
    });
  });

  describe('AT-CHANGE-003: Isolated Spike Rejection', () => {
    it('does not establish a transition for a single isolated spike', () => {
      const baseline = createBaseline();
      const observations = [
        createObservation('obs-1', '2026-03-01T10:00:00Z', 5, ['evt-1']),
        createObservation('obs-2', '2026-03-01T10:15:00Z', 50, ['evt-spike']), // High spike
        createObservation('obs-3', '2026-03-01T10:30:00Z', 5, ['evt-3']),      // Immediate return to nominal
        createObservation('obs-4', '2026-03-01T10:45:00Z', 5, ['evt-4']),
      ];

      const result = detectChangePoints({
        actorEntityId: 'ACTOR-001',
        featureName: 'read_count',
        baseline,
        observations,
      });

      expect(result.changePoints).toHaveLength(0);
      expect(result.inElevatedRegime).toBe(false);
    });
  });

  describe('AT-CHANGE-004: Gradual Drift Detection', () => {
    it('accumulates evidence across windows and produces a change point when threshold is crossed', () => {
      // Baseline: median = 5, mad = 2 -> scale = 2.9652
      // Each value = 10 -> z = (10 - 5) / 2.9652 = 1.686
      // z = 1.686 < suddenZThreshold (3.0), so sudden detector does NOT trigger.
      // CUSUM allowance = 0.5. Excess per window = 1.686 - 0.5 = 1.186
      // driftThreshold = 5.0 -> requires ~5 windows (5 * 1.186 = 5.93 >= 5.0)
      const baseline = createBaseline();
      const observations = [
        createObservation('obs-1', '2026-03-01T10:00:00Z', 10, ['evt-1']),
        createObservation('obs-2', '2026-03-01T10:15:00Z', 10, ['evt-2']),
        createObservation('obs-3', '2026-03-01T10:30:00Z', 10, ['evt-3']),
        createObservation('obs-4', '2026-03-01T10:45:00Z', 10, ['evt-4']),
        createObservation('obs-5', '2026-03-01T11:00:00Z', 10, ['evt-5']), // Crosses threshold
      ];

      const result = detectChangePoints({
        actorEntityId: 'ACTOR-001',
        featureName: 'read_count',
        baseline,
        observations,
      });

      expect(result.changePoints).toHaveLength(1);
      const cp = result.changePoints[0];
      expect(cp.observedAt).toBe('2026-03-01T11:00:00Z');
      expect(cp.actorEntityId).toBe('ACTOR-001');
      expect(cp.featureName).toBe('read_count');

      // Provenance: contributing events across the accumulation span
      expect(cp.relatedEventIds).toEqual(['evt-1', 'evt-2', 'evt-3', 'evt-4', 'evt-5']);
    });
  });

  describe('Post-Detection Reset and Re-arm Semantics', () => {
    it('does not emit repeated duplicate ChangePoints for continuing sustained elevation in the same regime', () => {
      const baseline = createBaseline();
      const observations = [
        createObservation('obs-1', '2026-03-01T10:00:00Z', 5, ['evt-1']),
        createObservation('obs-2', '2026-03-01T10:15:00Z', 30, ['evt-2']),
        createObservation('obs-3', '2026-03-01T10:30:00Z', 30, ['evt-3']), // Transition detected here!
        createObservation('obs-4', '2026-03-01T10:45:00Z', 30, ['evt-4']), // Continuing elevated regime
        createObservation('obs-5', '2026-03-01T11:00:00Z', 30, ['evt-5']), // Continuing elevated regime
        createObservation('obs-6', '2026-03-01T11:15:00Z', 30, ['evt-6']), // Continuing elevated regime
      ];

      const result = detectChangePoints({
        actorEntityId: 'ACTOR-001',
        featureName: 'read_count',
        baseline,
        observations,
      });

      // Exactly ONE ChangePoint identifying the regime transition, not 4
      expect(result.changePoints).toHaveLength(1);
      expect(result.changePoints[0].observedAt).toBe('2026-03-01T10:30:00Z');
      expect(result.inElevatedRegime).toBe(true);
    });

    it('re-arms after signal returns to nominal, allowing detection of a second distinct transition', () => {
      const baseline = createBaseline();
      const observations = [
        // Baseline
        createObservation('obs-1', '2026-03-01T10:00:00Z', 5, ['evt-1']),
        // First transition
        createObservation('obs-2', '2026-03-01T10:15:00Z', 30, ['evt-2']),
        createObservation('obs-3', '2026-03-01T10:30:00Z', 30, ['evt-3']), // ChangePoint 1
        // Return to nominal (re-arms detector)
        createObservation('obs-4', '2026-03-01T10:45:00Z', 5, ['evt-4']),
        createObservation('obs-5', '2026-03-01T11:00:00Z', 5, ['evt-5']),
        // Second transition
        createObservation('obs-6', '2026-03-01T11:15:00Z', 30, ['evt-6']),
        createObservation('obs-7', '2026-03-01T11:30:00Z', 30, ['evt-7']), // ChangePoint 2
      ];

      const result = detectChangePoints({
        actorEntityId: 'ACTOR-001',
        featureName: 'read_count',
        baseline,
        observations,
      });

      expect(result.changePoints).toHaveLength(2);
      expect(result.changePoints[0].observedAt).toBe('2026-03-01T10:30:00Z');
      expect(result.changePoints[1].observedAt).toBe('2026-03-01T11:30:00Z');
      expect(result.changePoints[0].relatedEventIds).toEqual(['evt-2', 'evt-3']);
      expect(result.changePoints[1].relatedEventIds).toEqual(['evt-6', 'evt-7']);
    });
  });

  describe('Single ChangePoint per Window Invariant', () => {
    it('emits at most one ChangePoint when sudden and gradual thresholds are met at the same window', () => {
      const baseline = createBaseline();
      // Configure so both sudden (z >= 3, consecutive = 1) and drift trigger at window 2
      const observations = [
        createObservation('obs-1', '2026-03-01T10:00:00Z', 10, ['evt-1']),
        createObservation('obs-2', '2026-03-01T10:15:00Z', 50, ['evt-2']),
      ];

      const result = detectChangePoints({
        actorEntityId: 'ACTOR-001',
        featureName: 'read_count',
        baseline,
        observations,
        config: {
          suddenZThreshold: 3.0,
          minConsecutiveWindows: 1, // Will trigger sudden on window 2
          driftAllowance: 0.1,
          driftThreshold: 2.0,      // Will also trigger drift on window 2
        },
      });

      // Exactly one ChangePoint at window 2
      const atWindow2 = result.changePoints.filter((cp) => cp.observedAt === '2026-03-01T10:15:00Z');
      expect(atWindow2).toHaveLength(1);
      // Canonical union of events
      expect(atWindow2[0].relatedEventIds).toEqual(['evt-1', 'evt-2']);
    });
  });

  describe('AT-TEMP-001: Temporal Leakage Prevention', () => {
    it('guarantees that future observations cannot influence earlier detection decisions', () => {
      const baseline = createBaseline();
      const prefixObservations = [
        createObservation('obs-1', '2026-03-01T10:00:00Z', 5, ['evt-1']),
        createObservation('obs-2', '2026-03-01T10:15:00Z', 30, ['evt-2']),
        createObservation('obs-3', '2026-03-01T10:30:00Z', 30, ['evt-3']),
      ];

      const futureObservations = [
        ...prefixObservations,
        createObservation('obs-4', '2026-03-01T10:45:00Z', 100, ['evt-future-1']),
        createObservation('obs-5', '2026-03-01T11:00:00Z', 0, ['evt-future-2']),
      ];

      // Evaluating prefix up to 10:30
      const prefixResult = detectChangePoints({
        actorEntityId: 'ACTOR-001',
        featureName: 'read_count',
        baseline,
        observations: prefixObservations,
        evaluationTime: '2026-03-01T10:30:00Z',
      });

      // Evaluating future sequence evaluated strictly at T = 10:30
      const boundedFutureResult = detectChangePoints({
        actorEntityId: 'ACTOR-001',
        featureName: 'read_count',
        baseline,
        observations: futureObservations,
        evaluationTime: '2026-03-01T10:30:00Z',
      });

      // Full sequence without evaluationTime filter
      const fullResult = detectChangePoints({
        actorEntityId: 'ACTOR-001',
        featureName: 'read_count',
        baseline,
        observations: futureObservations,
      });

      // 1. Prefix evaluation matches bounded future evaluation exactly
      expect(prefixResult.changePoints).toEqual(boundedFutureResult.changePoints);
      expect(prefixResult.latestScore).toBe(boundedFutureResult.latestScore);
      expect(prefixResult.evaluatedObservationCount).toBe(boundedFutureResult.evaluatedObservationCount);

      // 2. Change points up to T in the full sequence are identical to prefix evaluation
      const fullUpToT = fullResult.changePoints.filter((cp) => cp.observedAt <= '2026-03-01T10:30:00Z');
      expect(prefixResult.changePoints).toEqual(fullUpToT);
    });
  });

  describe('Canonical Ordering & Immutability', () => {
    it('does not mutate caller observation array', () => {
      const baseline = createBaseline();
      const original = [
        createObservation('obs-2', '2026-03-01T10:15:00Z', 30, ['evt-2']),
        createObservation('obs-1', '2026-03-01T10:00:00Z', 5, ['evt-1']),
      ];
      const copy = [...original];

      detectChangePoints({
        actorEntityId: 'ACTOR-001',
        featureName: 'read_count',
        baseline,
        observations: original,
      });

      expect(original).toEqual(copy);
      expect(original[0].id).toBe('obs-2');
    });

    it('produces identical results regardless of input array shuffling', () => {
      const baseline = createBaseline();
      const obs1 = createObservation('obs-1', '2026-03-01T10:00:00Z', 5, ['evt-1']);
      const obs2 = createObservation('obs-2', '2026-03-01T10:15:00Z', 30, ['evt-2']);
      const obs3 = createObservation('obs-3', '2026-03-01T10:30:00Z', 30, ['evt-3']);

      const sortedResult = detectChangePoints({
        actorEntityId: 'ACTOR-001',
        featureName: 'read_count',
        baseline,
        observations: [obs1, obs2, obs3],
      });

      const shuffledResult = detectChangePoints({
        actorEntityId: 'ACTOR-001',
        featureName: 'read_count',
        baseline,
        observations: [obs3, obs1, obs2],
      });

      expect(sortedResult.changePoints).toEqual(shuffledResult.changePoints);
      expect(sortedResult.latestScore).toBe(shuffledResult.latestScore);
    });

    it('canonicalizes and sorts relatedEventIds deterministically', () => {
      const baseline = createBaseline();
      const observations = [
        createObservation('obs-1', '2026-03-01T10:00:00Z', 5, ['evt-z']),
        createObservation('obs-2', '2026-03-01T10:15:00Z', 30, ['evt-b', 'evt-a']),
        createObservation('obs-3', '2026-03-01T10:30:00Z', 30, ['evt-c', 'evt-a']), // duplicate 'evt-a'
      ];

      const result = detectChangePoints({
        actorEntityId: 'ACTOR-001',
        featureName: 'read_count',
        baseline,
        observations,
      });

      expect(result.changePoints).toHaveLength(1);
      // Canonical: unique, ascending
      expect(result.changePoints[0].relatedEventIds).toEqual(['evt-a', 'evt-b', 'evt-c']);
    });
  });

  describe('Zero-MAD Sparse/Binary Feature Evaluation', () => {
    it('detects privilege activity jumps from zero baseline deterministically', () => {
      // Baseline: median = 0, mad = 0 (e.g. privilege escalation count)
      const baseline = createBaseline({
        featureName: 'privilege_activity_count',
        median: 0,
        mad: 0,
      });

      const observations = [
        createObservation('obs-1', '2026-03-01T10:00:00Z', 0, ['evt-1'], 'privilege_activity_count'),
        createObservation('obs-2', '2026-03-01T10:15:00Z', 12, ['evt-2'], 'privilege_activity_count'),
        createObservation('obs-3', '2026-03-01T10:30:00Z', 14, ['evt-3'], 'privilege_activity_count'),
      ];

      const result = detectChangePoints({
        actorEntityId: 'ACTOR-001',
        featureName: 'privilege_activity_count',
        baseline,
        observations,
      });

      expect(result.changePoints).toHaveLength(1);
      const cp = result.changePoints[0];
      expect(cp.observedAt).toBe('2026-03-01T10:30:00Z');
      expect(cp.rawDeviationScore).toBe(14.0); // (14 - 0) / 1.0 = 14.0
      expect(cp.relatedEventIds).toEqual(['evt-2', 'evt-3']);
    });
  });
});
