import { describe, expect, it } from 'vitest';
import {
  calculateDeviationForValue,
  EPSILON,
} from './adapters/baselineAdapter';
import { assembleTrajectoryViewModels } from './adapters/trajectoryAdapter';
import {
  assembleContextViewModels,
  assembleDeviceViewModels,
  assembleResourceViewModels,
} from './adapters/evidenceAdapter';
import {
  projectBaselineCorridor,
  projectObservationNodes,
  temporalToSceneX,
  Z_LANES_BEHAVIOR,
  Z_LANES_RESOURCE,
} from './projections/projectionEngine';
import { buildShiftGraphScene } from './scene/buildShiftGraphScene';
import {
  PROTOTYPE_ACTOR,
  PROTOTYPE_BASELINES,
  PROTOTYPE_SECURITY_EVENTS,
  RAW_OBSERVATION_SEEDS,
} from './data/prototypeData';
import type { ShiftGraphPresentationModel } from './types/presentationTypes';

const createTestPresentationModel = (
  lens = 'PERSONAL' as const,
): ShiftGraphPresentationModel => {
  const points = assembleTrajectoryViewModels({
    actorEntityId: PROTOTYPE_ACTOR.id,
    featureName: 'event_count_by_action:READ',
    baseline: PROTOTYPE_BASELINES[lens],
    lens,
  });

  return {
    actor: PROTOTYPE_ACTOR,
    featureName: 'event_count_by_action:READ',
    temporalWindow: {
      start: '2024-04-01T08:00:00Z',
      end: '2024-04-01T10:30:00Z',
    },
    trajectoryPoints: points,
    baselines: PROTOTYPE_BASELINES,
    activeLens: lens,
    contextGrants: assembleContextViewModels(),
    relatedResources: assembleResourceViewModels(),
    relatedDevices: assembleDeviceViewModels(),
    securityEvents: PROTOTYPE_SECURITY_EVENTS,
  };
};

describe('Frontend Phase 0: Presentation & Projection Engine', () => {
  it('Temporal projection: earlier timestamps strictly map to earlier X coordinates', () => {
    const tStart = '2024-04-01T08:00:00Z';
    const tEnd = '2024-04-01T10:30:00Z';

    const x1 = temporalToSceneX('2024-04-01T08:00:00Z', tStart, tEnd);
    const x2 = temporalToSceneX('2024-04-01T08:30:00Z', tStart, tEnd);
    const x3 = temporalToSceneX('2024-04-01T09:15:00Z', tStart, tEnd);
    const x4 = temporalToSceneX('2024-04-01T10:30:00Z', tStart, tEnd);

    expect(x1).toBeLessThan(x2);
    expect(x2).toBeLessThan(x3);
    expect(x3).toBeLessThan(x4);

    // Boundary checks: normalized mapped to [-width/2, +width/2]
    expect(x1).toBeCloseTo(-12.0, 1);
    expect(x4).toBeCloseTo(12.0, 1);
  });

  it('Determinism: identical inputs produce strictly identical scene coordinates', () => {
    const model = createTestPresentationModel('PERSONAL');
    const sceneA = buildShiftGraphScene({
      model,
      projection: 'BEHAVIOR',
      lens: 'PERSONAL',
    });
    const sceneB = buildShiftGraphScene({
      model,
      projection: 'BEHAVIOR',
      lens: 'PERSONAL',
    });

    expect(sceneA.observations).toEqual(sceneB.observations);
    expect(sceneA.trajectory).toEqual(sceneB.trajectory);
    expect(sceneA.baseline).toEqual(sceneB.baseline);
    expect(sceneA.connections).toEqual(sceneB.connections);
  });

  it('Future-data filtering: time cursor T strictly excludes observations and connections past T', () => {
    const model = createTestPresentationModel('PERSONAL');
    const midTime = '2024-04-01T09:00:00Z';

    const fullScene = buildShiftGraphScene({
      model,
      projection: 'BEHAVIOR',
      lens: 'PERSONAL',
    });
    const filteredScene = buildShiftGraphScene({
      model,
      projection: 'BEHAVIOR',
      lens: 'PERSONAL',
      cursorTime: midTime,
    });

    expect(fullScene.observations.length).toBe(11);
    expect(filteredScene.observations.length).toBe(5); // 08:00, 08:15, 08:30, 08:45, 09:00

    // Verify all filtered observations have timestamp <= midTime
    for (const obs of filteredScene.observations) {
      expect(obs.timestamp <= midTime).toBe(true);
    }

    // Verify trajectory points match the filtered count
    expect(filteredScene.trajectory.points.length).toBe(5);

    // Verify connections only originate from observations <= midTime
    for (const conn of filteredScene.connections) {
      expect(conn.timestamp <= midTime).toBe(true);
    }
  });

  it('Baseline unavailable state: does not produce fake baseline geometry or fake medians', () => {
    const unavailableBaseline = PROTOTYPE_BASELINES.RESOURCE;
    expect(unavailableBaseline.available).toBe(false);

    const dev = calculateDeviationForValue(25, unavailableBaseline);
    expect(dev.isBaselineAvailable).toBe(false);
    expect(dev.rawDelta).toBeNull();
    expect(dev.presentationDeviation).toBe(0);
    expect(dev.visualY).toBe(0);

    const corridor = projectBaselineCorridor(
      unavailableBaseline,
      'BEHAVIOR',
      '2024-04-01T08:00:00Z',
      '2024-04-01T10:30:00Z',
    );
    expect(corridor.available).toBe(false);
    expect(corridor.rawMedian).toBeNull();
    expect(corridor.rawMad).toBeNull();
    expect(corridor.sampleCount).toBe(1);
    expect(corridor.quality).toBe('INSUFFICIENT');
  });

  it('Zero-MAD behavior: bounded fallback prevents Infinity/NaN and preserves numerical stability', () => {
    const zeroMadBaseline = {
      id: 'base-zero-mad',
      lens: 'PERSONAL' as const,
      featureName: 'event_count_by_action:READ',
      available: true,
      median: 10,
      mad: 0,
      min: 10,
      max: 10,
      sampleCount: 10,
      observationCount: 10,
      quality: 'HIGH' as const,
      notes: 'Zero MAD test baseline',
    };

    // Value equal to median
    const eqResult = calculateDeviationForValue(10, zeroMadBaseline);
    expect(eqResult.visualY).toBe(0);
    expect(eqResult.presentationDeviation).toBe(0);
    expect(eqResult.isZeroMadFallback).toBe(false);

    // Value diverging from median
    const divResult = calculateDeviationForValue(25, zeroMadBaseline);
    expect(Number.isFinite(divResult.visualY)).toBe(true);
    expect(Number.isNaN(divResult.visualY)).toBe(false);
    expect(divResult.visualY).toBeGreaterThan(0);
    expect(divResult.isZeroMadFallback).toBe(true);
    expect(divResult.presentationDeviation).toBeLessThanOrEqual(4.0); // Bounded fallback
  });

  it('Projection stability: Behavior and Resource projections preserve evidence identity', () => {
    const model = createTestPresentationModel('PERSONAL');

    const behaviorScene = buildShiftGraphScene({
      model,
      projection: 'BEHAVIOR',
      lens: 'PERSONAL',
    });
    const resourceScene = buildShiftGraphScene({
      model,
      projection: 'RESOURCE',
      lens: 'PERSONAL',
    });

    // Same observation IDs in both
    const behaviorIds = behaviorScene.observations.map((o) => o.id);
    const resourceObsIds = resourceScene.observations.map((o) => o.id);
    expect(behaviorIds).toEqual(resourceObsIds);

    // Same feature values and raw deltas
    for (let i = 0; i < behaviorScene.observations.length; i++) {
      expect(behaviorScene.observations[i].featureValue).toBe(
        resourceScene.observations[i].featureValue,
      );
      expect(behaviorScene.observations[i].rawDelta).toBe(
        resourceScene.observations[i].rawDelta,
      );
      // X and Y are identical because Time and Deviation semantics do not change
      expect(behaviorScene.observations[i].position[0]).toBeCloseTo(
        resourceScene.observations[i].position[0],
        4,
      );
      expect(behaviorScene.observations[i].position[1]).toBeCloseTo(
        resourceScene.observations[i].position[1],
        4,
      );
    }

    // Z lane changes deterministically for resources
    const bRes0 = behaviorScene.resources[0];
    const rRes0 = resourceScene.resources[0];
    expect(bRes0.position[2]).toBe(Z_LANES_BEHAVIOR.RESOURCES);
    expect(rRes0.position[2]).toBe(Z_LANES_RESOURCE.RESOURCE_0);
  });

  it('Scene construction: all connections reference valid observation, resource, or device objects', () => {
    const model = createTestPresentationModel('PERSONAL');
    const scene = buildShiftGraphScene({
      model,
      projection: 'BEHAVIOR',
      lens: 'PERSONAL',
    });

    const obsIds = new Set(scene.observations.map((o) => o.id));
    const targetIds = new Set([
      ...scene.resources.map((r) => r.id),
      ...scene.devices.map((d) => d.id),
    ]);

    for (const conn of scene.connections) {
      expect(obsIds.has(conn.sourceId)).toBe(true);
      expect(targetIds.has(conn.targetId)).toBe(true);
    }
  });
});
