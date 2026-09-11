import { describe, expect, it } from 'vitest';

import {
  BaselineConstructionError,
  buildBaselineHierarchy,
  buildPeerBaseline,
  buildPersonalBaseline,
  buildResourceBaseline,
  type BaselineObservation,
  type PeerCohort,
} from './index';

const obs = (
  id: string,
  actorEntityId: string,
  value: number,
  observedAt: string,
  featureName: string,
  sourceEventIds: string[] = [id],
  resourceId?: string,
): BaselineObservation => ({
  id,
  actorEntityId,
  observedAt,
  featureName,
  value,
  sourceEventIds,
  resourceId,
});

describe('Milestone 3 hierarchical baselines', () => {
  it('AT-BASE-PERSONAL-001: personal baseline only uses the target actor and excludes future values', () => {
    const observations = [
      obs('obs-1', 'entity-user-a', 10, '2024-04-01T00:00:00Z', 'event_count_by_action:READ', ['ev-1']),
      obs('obs-2', 'entity-user-a', 20, '2024-04-01T00:05:00Z', 'event_count_by_action:READ', ['ev-2']),
      obs('obs-3', 'entity-user-b', 99, '2024-04-01T00:06:00Z', 'event_count_by_action:READ', ['ev-3']),
      obs('obs-4', 'entity-user-a', 30, '2024-04-01T09:00:00Z', 'event_count_by_action:READ', ['ev-4']),
      obs('obs-5', 'entity-user-a', 40, '2024-04-01T09:01:00Z', 'event_count_by_action:READ', ['ev-5']),
    ];

    const baseline = buildPersonalBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T09:00:00Z',
      observations,
      featureName: 'event_count_by_action:READ',
    });

    expect(baseline.sampleCount).toBe(2);
    expect(baseline.median).toBe(15);
    expect(baseline.sourceObservationIds).toEqual(['obs-1', 'obs-2']);
    expect(baseline.available).toBe(true);
    expect(baseline.sourceObservationIds.every((id) => ['obs-1', 'obs-2'].includes(id))).toBe(true);
  });

  it('AT-BASE-PERSONAL-001: median and MAD are deterministic for even and odd samples', () => {
    const even = [
      obs('obs-a', 'entity-user-a', 10, '2024-04-01T00:00:00Z', 'event_count_by_action:READ'),
      obs('obs-b', 'entity-user-a', 20, '2024-04-01T00:01:00Z', 'event_count_by_action:READ'),
      obs('obs-c', 'entity-user-a', 30, '2024-04-01T00:02:00Z', 'event_count_by_action:READ'),
      obs('obs-d', 'entity-user-a', 40, '2024-04-01T00:03:00Z', 'event_count_by_action:READ'),
    ];
    const odd = [
      obs('obs-e', 'entity-user-a', 8, '2024-04-01T00:00:00Z', 'event_count_by_action:READ'),
      obs('obs-f', 'entity-user-a', 12, '2024-04-01T00:01:00Z', 'event_count_by_action:READ'),
      obs('obs-g', 'entity-user-a', 20, '2024-04-01T00:02:00Z', 'event_count_by_action:READ'),
    ];

    const evenBaseline = buildPersonalBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T01:00:00Z',
      observations: even,
      featureName: 'event_count_by_action:READ',
    });
    const oddBaseline = buildPersonalBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T01:00:00Z',
      observations: odd,
      featureName: 'event_count_by_action:READ',
    });

    expect(evenBaseline.median).toBe(25);
    expect(evenBaseline.mad).toBe(10);
    expect(oddBaseline.median).toBe(12);
    expect(oddBaseline.mad).toBe(4);
    expect(evenBaseline.min).toBe(10);
    expect(evenBaseline.max).toBe(40);
  });

  it('AT-BASE-PERSONAL-001: one-sample and zero-sample cases are explicit and do not fabricate values', () => {
    const one = buildPersonalBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T01:00:00Z',
      observations: [obs('obs-s', 'entity-user-a', 8, '2024-04-01T00:00:00Z', 'event_count_by_action:READ')],
      featureName: 'event_count_by_action:READ',
    });
    const zero = buildPersonalBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T01:00:00Z',
      observations: [],
      featureName: 'event_count_by_action:READ',
    });

    expect(one.sampleCount).toBe(1);
    expect(one.median).toBe(8);
    expect(one.mad).toBe(0);
    expect(one.min).toBe(8);
    expect(one.max).toBe(8);
    expect(one.available).toBe(true);

    expect(zero.sampleCount).toBe(0);
    expect(zero.median).toBeNull();
    expect(zero.mad).toBeNull();
    expect(zero.min).toBeNull();
    expect(zero.max).toBeNull();
    expect(zero.available).toBe(false);
  });

  it('AT-BASE-PERSONAL-001: rejects NaN and Infinity and leaves input objects unchanged', () => {
    const observations = [obs('obs-nan', 'entity-user-a', Number.NaN, '2024-04-01T00:00:00Z', 'event_count_by_action:READ')];
    const original = JSON.stringify(observations);

    expect(() => buildPersonalBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T01:00:00Z',
      observations,
      featureName: 'event_count_by_action:READ',
    })).toThrow(BaselineConstructionError);

    expect(JSON.stringify(observations)).toBe(original);
  });

  it('AT-BASE-PEER-001: peer cohort excludes the target actor and rejects unresolved members', () => {
    const cohort: PeerCohort = {
      id: 'cohort-admins',
      name: 'admins',
      cohortType: 'ROLE',
      memberEntityIds: ['entity-user-a', 'entity-user-b', 'entity-user-z'],
      scope: ['role-admin'],
    };
    const observations = [
      obs('obs-1', 'entity-user-a', 10, '2024-04-01T00:00:00Z', 'event_count_by_action:READ', ['ev-1']),
      obs('obs-2', 'entity-user-b', 30, '2024-04-01T00:01:00Z', 'event_count_by_action:READ', ['ev-2']),
      obs('obs-3', 'entity-user-c', 90, '2024-04-01T00:02:00Z', 'event_count_by_action:READ', ['ev-3']),
      obs('obs-4', 'entity-user-b', 40, '2024-04-01T00:03:00Z', 'event_count_by_action:READ', ['ev-4']),
    ];

    const baseline = buildPeerBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T01:00:00Z',
      observations,
      cohort,
      featureName: 'event_count_by_action:READ',
    });

    expect(baseline.sampleCount).toBe(1);
    expect(baseline.sourceObservationIds).toEqual(['obs-2', 'obs-4']);
    expect(baseline.median).toBe(35);
    expect(baseline.sourceObservationIds.every((id) => id !== 'obs-1')).toBe(true);

    expect(() => buildPeerBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T01:00:00Z',
      observations,
      cohort: { ...cohort, memberEntityIds: ['entity-user-a', 'entity-user-z'] },
      featureName: 'event_count_by_action:READ',
    })).toThrow(BaselineConstructionError);
  });

  it('AT-BASE-PEER-001: empty and target-only cohorts are explicit and non-fabricated', () => {
    const observations = [
      obs('obs-1', 'entity-user-a', 10, '2024-04-01T00:00:00Z', 'event_count_by_action:READ'),
      obs('obs-2', 'entity-user-a', 15, '2024-04-01T00:01:00Z', 'event_count_by_action:READ'),
    ];

    const empty = buildPeerBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T01:00:00Z',
      observations,
      cohort: { id: 'empty', name: 'empty', cohortType: 'ROLE', memberEntityIds: [], scope: [] },
      featureName: 'event_count_by_action:READ',
    });

    const targetOnly = buildPeerBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T01:00:00Z',
      observations,
      cohort: { id: 'target-only', name: 'target-only', cohortType: 'ROLE', memberEntityIds: ['entity-user-a'], scope: [] },
      featureName: 'event_count_by_action:READ',
    });

    expect(empty.available).toBe(false);
    expect(empty.sampleCount).toBe(0);
    expect(targetOnly.available).toBe(false);
    expect(targetOnly.sampleCount).toBe(0);
  });

  it('AT-BASE-RESOURCE-001 through AT-BASE-RESOURCE-005: resource baseline resolves exact resources and rejects missing ones', () => {
    const observations = [
      obs('obs-r-1', 'entity-user-a', 12, '2024-04-01T00:00:00Z', 'event_count_by_action:READ', ['ev-r-1'], 'resource-db-1'),
      obs('obs-r-2', 'entity-user-a', 18, '2024-04-01T00:02:00Z', 'event_count_by_action:READ', ['ev-r-2'], 'resource-db-1'),
      obs('obs-r-3', 'entity-user-b', 45, '2024-04-01T00:03:00Z', 'event_count_by_action:READ', ['ev-r-3'], 'resource-db-2'),
      obs('obs-r-4', 'entity-user-a', 20, '2024-04-02T00:00:00Z', 'event_count_by_action:READ', ['ev-r-4'], 'resource-db-1'),
    ];

    const baseline = buildResourceBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-03T00:00:00Z',
      observations,
      resourceId: 'resource-db-1',
      featureName: 'event_count_by_action:READ',
      resources: [{ id: 'resource-db-1', resourceType: 'DB', resourceName: 'DB-01' }, { id: 'resource-db-2', resourceType: 'DB', resourceName: 'DB-02' }],
    });

    expect(baseline.sampleCount).toBe(3);
    expect(baseline.sourceObservationIds).toEqual(['obs-r-1', 'obs-r-2', 'obs-r-4']);
    expect(baseline.median).toBe(18);
    expect(baseline.sourceObservationIds.every((id) => id !== 'obs-r-3')).toBe(true);

    expect(() => buildResourceBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-03T00:00:00Z',
      observations: [obs('obs-missing', 'entity-user-a', 10, '2024-04-01T00:00:00Z', 'event_count_by_action:READ', ['ev-missing'], 'resource-missing')],
      resourceId: 'resource-missing',
      featureName: 'event_count_by_action:READ',
      resources: [{ id: 'resource-db-1', resourceType: 'DB', resourceName: 'DB-01' }],
    })).toThrow(BaselineConstructionError);

    expect(() => buildResourceBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-03T00:00:00Z',
      observations: [obs('obs-no-res', 'entity-user-a', 10, '2024-04-01T00:00:00Z', 'event_count_by_action:READ', ['ev-no-res'])],
      resourceId: 'resource-db-1',
      featureName: 'event_count_by_action:READ',
      resources: [{ id: 'resource-db-1', resourceType: 'DB', resourceName: 'DB-01' }],
    })).not.toThrow();
  });

  it('AT-BASE-PEER-001: peer baselines weight each peer equally and respect the minimum sample threshold', () => {
    const observations = [
      obs('obs-1', 'entity-user-a', 10, '2024-04-01T00:00:00Z', 'event_count_by_action:READ'),
      obs('obs-2', 'entity-user-b', 100, '2024-04-01T00:00:00Z', 'event_count_by_action:READ'),
      obs('obs-3', 'entity-user-b', 200, '2024-04-01T00:01:00Z', 'event_count_by_action:READ'),
      obs('obs-4', 'entity-user-b', 300, '2024-04-01T00:02:00Z', 'event_count_by_action:READ'),
      obs('obs-5', 'entity-user-b', 400, '2024-04-01T00:03:00Z', 'event_count_by_action:READ'),
      obs('obs-6', 'entity-user-c', 50, '2024-04-01T00:00:00Z', 'event_count_by_action:READ'),
    ];

    const baseline = buildPeerBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T01:00:00Z',
      observations,
      cohort: { id: 'q', name: 'q', cohortType: 'ROLE', memberEntityIds: ['entity-user-a', 'entity-user-b', 'entity-user-c'], scope: [] },
      featureName: 'event_count_by_action:READ',
    });

    expect(baseline.sampleCount).toBe(2);
    expect(baseline.sourceObservationIds).toEqual(['obs-2', 'obs-3', 'obs-4', 'obs-5', 'obs-6']);
    expect(baseline.sourceObservationIds.every((id) => id !== 'obs-1')).toBe(true);
    expect(baseline.median).toBe(150);
    expect(baseline.available).toBe(true);

    const insufficient = buildPeerBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T01:00:00Z',
      observations,
      cohort: { id: 'q', name: 'q', cohortType: 'ROLE', memberEntityIds: ['entity-user-a', 'entity-user-b', 'entity-user-c'], scope: [] },
      featureName: 'event_count_by_action:READ',
      minimumSampleCount: 3,
    });

    expect(insufficient.available).toBe(false);
    expect(insufficient.sampleCount).toBe(2);
  });

  it('AT-BASE-RESOURCE-001: future resource events are excluded and provenance is exact', () => {
    const observations = [
      obs('obs-f-1', 'entity-user-a', 6, '2024-04-01T00:00:00Z', 'event_count_by_action:READ', ['ev-f-1'], 'resource-db-1'),
      obs('obs-f-2', 'entity-user-a', 8, '2024-04-01T00:01:00Z', 'event_count_by_action:READ', ['ev-f-2'], 'resource-db-1'),
      obs('obs-f-3', 'entity-user-a', 9, '2024-04-03T00:00:00Z', 'event_count_by_action:READ', ['ev-f-3'], 'resource-db-1'),
    ];

    const baseline = buildResourceBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-03T00:00:00Z',
      observations,
      resourceId: 'resource-db-1',
      featureName: 'event_count_by_action:READ',
      resources: [{ id: 'resource-db-1', resourceType: 'DB', resourceName: 'DB-01' }],
    });

    expect(baseline.sampleCount).toBe(2);
    expect(baseline.sourceObservationIds).toEqual(['obs-f-1', 'obs-f-2']);
    expect(baseline.sourceEventIds).toEqual(['ev-f-1', 'ev-f-2']);
  });

  it('AT-BASE-RESOURCE-004 and AT-BASE-PEER-001: hierarchy availability marks cold starts and sparse history without fabricating data', () => {
    const hierarchy = buildBaselineHierarchy({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T09:00:00Z',
      personalObservations: [
        obs('obs-cold', 'entity-user-a', 8, '2024-04-01T00:00:00Z', 'event_count_by_action:READ'),
      ],
      peerObservations: [],
      resourceObservations: [
        obs('obs-res-cold', 'entity-user-a', 5, '2024-04-01T00:00:00Z', 'event_count_by_action:READ', ['ev-1'], 'resource-db-1'),
      ],
      cohort: { id: 'cohort-empty', name: 'empty', cohortType: 'ROLE', memberEntityIds: [], scope: [] },
      resourceId: 'resource-db-1',
      featureName: 'event_count_by_action:READ',
      resources: [{ id: 'resource-db-1', resourceType: 'DB', resourceName: 'DB-01' }],
      minimumSampleCount: 2,
    });

    expect(hierarchy.personalAvailable).toBe(false);
    expect(hierarchy.peerAvailable).toBe(false);
    expect(hierarchy.resourceAvailable).toBe(false);
    expect(hierarchy.coverage).toBeLessThanOrEqual(1);
    expect(hierarchy.quality).toBe('LOW');
  });

  it('AT-BASE-PEER-001: duplicate membership is normalized or rejected consistently', () => {
    expect(() => buildPeerBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T01:00:00Z',
      observations: [
        obs('obs-1', 'entity-user-b', 10, '2024-04-01T00:00:00Z', 'event_count_by_action:READ'),
      ],
      cohort: { id: 'dup', name: 'dup', cohortType: 'ROLE', memberEntityIds: ['entity-user-b', 'entity-user-b'], scope: [] },
      featureName: 'event_count_by_action:READ',
    })).toThrow(BaselineConstructionError);
  });

  it('AT-BASE-PEER-001: duplicate peer history does not change peer weight when the same peer contributes repeated observations', () => {
    const cohort: PeerCohort = { id: 'peer-dup', name: 'peer-dup', cohortType: 'ROLE', memberEntityIds: ['entity-user-a', 'entity-user-b', 'entity-user-c'], scope: [] };
    const observations = [
      obs('obs-1', 'entity-user-a', 10, '2024-04-01T00:00:00Z', 'event_count_by_action:READ'),
      obs('obs-2', 'entity-user-b', 100, '2024-04-01T00:00:00Z', 'event_count_by_action:READ'),
      obs('obs-3', 'entity-user-b', 200, '2024-04-01T00:01:00Z', 'event_count_by_action:READ'),
      obs('obs-4', 'entity-user-b', 300, '2024-04-01T00:02:00Z', 'event_count_by_action:READ'),
      obs('obs-5', 'entity-user-c', 50, '2024-04-01T00:00:00Z', 'event_count_by_action:READ'),
      obs('obs-6', 'entity-user-c', 60, '2024-04-01T00:01:00Z', 'event_count_by_action:READ'),
    ];

    const baseline = buildPeerBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T01:00:00Z',
      observations,
      cohort,
      featureName: 'event_count_by_action:READ',
    });

    expect(baseline.sampleCount).toBe(2);
    expect(baseline.observationCount).toBe(5);
    expect(baseline.sourceObservationIds).toEqual(['obs-2', 'obs-3', 'obs-4', 'obs-5', 'obs-6']);
    expect(baseline.median).toBe(127.5);
  });

  it('AT-BASE-PEER-001: cohort validation uses explicit entities and allows known members with zero observations', () => {
    const cohort: PeerCohort = { id: 'peer-entities', name: 'peer-entities', cohortType: 'ROLE', memberEntityIds: ['entity-user-a', 'entity-user-b', 'entity-user-c'], scope: [] };

    const knownZero = buildPeerBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T01:00:00Z',
      observations: [obs('obs-1', 'entity-user-b', 20, '2024-04-01T00:00:00Z', 'event_count_by_action:READ')],
      cohort,
      featureName: 'event_count_by_action:READ',
      entities: [{ id: 'entity-user-a' }, { id: 'entity-user-b' }, { id: 'entity-user-c' }],
    });

    expect(knownZero.available).toBe(true);
    expect(knownZero.sampleCount).toBe(1);
    expect(knownZero.median).toBe(20);

    expect(() => buildPeerBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T01:00:00Z',
      observations: [obs('obs-1', 'entity-user-b', 20, '2024-04-01T00:00:00Z', 'event_count_by_action:READ')],
      cohort: { ...cohort, memberEntityIds: ['entity-user-a', 'entity-user-b', 'entity-user-z'] },
      featureName: 'event_count_by_action:READ',
      entities: [{ id: 'entity-user-a' }, { id: 'entity-user-b' }, { id: 'entity-user-c' }],
    })).toThrow(BaselineConstructionError);
  });

  it('AT-BASE-PERSONAL-001: invalid minimumSampleCount values are rejected before building a baseline', () => {
    expect(() => buildPersonalBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T01:00:00Z',
      observations: [obs('obs-invalid', 'entity-user-a', 10, '2024-04-01T00:00:00Z', 'event_count_by_action:READ')],
      featureName: 'event_count_by_action:READ',
      minimumSampleCount: 0,
    })).toThrow(BaselineConstructionError);

    expect(() => buildPeerBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T01:00:00Z',
      observations: [obs('obs-1', 'entity-user-b', 10, '2024-04-01T00:00:00Z', 'event_count_by_action:READ')],
      cohort: { id: 'c', name: 'c', cohortType: 'ROLE', memberEntityIds: ['entity-user-a', 'entity-user-b'], scope: [] },
      featureName: 'event_count_by_action:READ',
      minimumSampleCount: 1.5,
    })).toThrow(BaselineConstructionError);

    const invalidThresholds = [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    for (const value of invalidThresholds) {
      expect(() => buildPersonalBaseline({
        actorEntityId: 'entity-user-a',
        asOf: '2024-04-01T01:00:00Z',
        observations: [obs('obs-1', 'entity-user-a', 10, '2024-04-01T00:00:00Z', 'event_count_by_action:READ')],
        featureName: 'event_count_by_action:READ',
        minimumSampleCount: value,
      })).toThrow(BaselineConstructionError);
    }
  });

  it('AT-BASE-PERSONAL-001: asOf and observedAt are validated strictly before baseline computation', () => {
    expect(() => buildPersonalBaseline({
      actorEntityId: 'entity-user-a',
      asOf: 'not-a-date',
      observations: [obs('obs-1', 'entity-user-a', 10, '2024-04-01T00:00:00Z', 'event_count_by_action:READ')],
      featureName: 'event_count_by_action:READ',
    })).toThrow(BaselineConstructionError);

    expect(() => buildPersonalBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T05:00:00Z',
      observations: [obs('obs-1', 'entity-user-a', 10, 'not-a-date', 'event_count_by_action:READ')],
      featureName: 'event_count_by_action:READ',
    })).toThrow(BaselineConstructionError);
  });

  it('AT-BASE-PERSONAL-001: equal timestamps use canonical ID ordering and input permutation does not change output', () => {
    const a = [
      obs('obs-b', 'entity-user-a', 30, '2024-04-01T00:00:00Z', 'event_count_by_action:READ'),
      obs('obs-a', 'entity-user-a', 10, '2024-04-01T00:00:00Z', 'event_count_by_action:READ'),
    ];
    const b = [
      obs('obs-a', 'entity-user-a', 10, '2024-04-01T00:00:00Z', 'event_count_by_action:READ'),
      obs('obs-b', 'entity-user-a', 30, '2024-04-01T00:00:00Z', 'event_count_by_action:READ'),
    ];

    const baselineA = buildPersonalBaseline({ actorEntityId: 'entity-user-a', asOf: '2024-04-01T01:00:00Z', observations: a, featureName: 'event_count_by_action:READ' });
    const baselineB = buildPersonalBaseline({ actorEntityId: 'entity-user-a', asOf: '2024-04-01T01:00:00Z', observations: b, featureName: 'event_count_by_action:READ' });

    expect(baselineA.sourceObservationIds).toEqual(['obs-a', 'obs-b']);
    expect(baselineA.median).toBe(20);
    expect(baselineA).toEqual(baselineB);
  });

  it('AT-BASE-RESOURCE-001: exact resource match is required and mixed resource history is excluded', () => {
    const observations = [
      obs('obs-r-a', 'entity-user-a', 5, '2024-04-01T00:00:00Z', 'event_count_by_action:READ', ['ev-a'], 'resource-db-1'),
      obs('obs-r-b', 'entity-user-a', 15, '2024-04-01T00:01:00Z', 'event_count_by_action:READ', ['ev-b'], 'resource-db-1'),
      obs('obs-r-c', 'entity-user-a', 99, '2024-04-01T00:02:00Z', 'event_count_by_action:READ', ['ev-c'], 'resource-db-2'),
    ];

    const baseline = buildResourceBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T05:00:00Z',
      observations,
      resourceId: 'resource-db-1',
      featureName: 'event_count_by_action:READ',
      resources: [{ id: 'resource-db-1', resourceType: 'DB', resourceName: 'DB-01' }, { id: 'resource-db-2', resourceType: 'DB', resourceName: 'DB-02' }],
    });

    expect(baseline.sampleCount).toBe(2);
    expect(baseline.sourceObservationIds).toEqual(['obs-r-a', 'obs-r-b']);
    expect(baseline.median).toBe(10);
  });

  it('AT-BASE-RESOURCE-002: multiple actors can contribute to the same resource without leaking across entities', () => {
    const observations = [
      obs('obs-a1', 'entity-user-a', 7, '2024-04-01T00:00:00Z', 'event_count_by_action:READ', ['ev-a1'], 'resource-db-1'),
      obs('obs-a2', 'entity-user-a', 9, '2024-04-01T00:01:00Z', 'event_count_by_action:READ', ['ev-a2'], 'resource-db-1'),
      obs('obs-b1', 'entity-user-b', 70, '2024-04-01T00:00:00Z', 'event_count_by_action:READ', ['ev-b1'], 'resource-db-1'),
      obs('obs-b2', 'entity-user-b', 90, '2024-04-01T00:01:00Z', 'event_count_by_action:READ', ['ev-b2'], 'resource-db-1'),
    ];

    const baseline = buildResourceBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T05:00:00Z',
      observations,
      resourceId: 'resource-db-1',
      featureName: 'event_count_by_action:READ',
      resources: [{ id: 'resource-db-1', resourceType: 'DB', resourceName: 'DB-01' }],
    });

    expect(baseline.sampleCount).toBe(4);
    expect(baseline.median).toBe(39.5);
    expect(baseline.sourceObservationIds).toEqual(['obs-a1', 'obs-a2', 'obs-b1', 'obs-b2']);
  });

  it('AT-BASE-RESOURCE-004: unavailable resource baseline retains counts and null statistics when below threshold', () => {
    const baseline = buildResourceBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T05:00:00Z',
      observations: [obs('obs-r', 'entity-user-a', 5, '2024-04-01T00:00:00Z', 'event_count_by_action:READ', ['ev-r'], 'resource-db-1')],
      resourceId: 'resource-db-1',
      featureName: 'event_count_by_action:READ',
      resources: [{ id: 'resource-db-1', resourceType: 'DB', resourceName: 'DB-01' }],
      minimumSampleCount: 2,
    });

    expect(baseline.available).toBe(false);
    expect(baseline.sampleCount).toBe(1);
    expect(baseline.observationCount).toBe(1);
    expect(baseline.median).toBeNull();
    expect(baseline.mad).toBeNull();
    expect(baseline.min).toBeNull();
    expect(baseline.max).toBeNull();
    expect(baseline.notes).toBe('The minimum sample threshold was not met.');
  });

  it('AT-BASE-PERSONAL-001: NaN and infinite numeric values are rejected for feature values', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => buildPersonalBaseline({
        actorEntityId: 'entity-user-a',
        asOf: '2024-04-01T01:00:00Z',
        observations: [obs('obs-n', 'entity-user-a', value, '2024-04-01T00:00:00Z', 'event_count_by_action:READ')],
        featureName: 'event_count_by_action:READ',
      })).toThrow(BaselineConstructionError);
    }
  });

  it('AT-BASE-RESOURCE-001: unknown resource reference returns a structured error and missing resourceId is excluded', () => {
    expect(() => buildResourceBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T05:00:00Z',
      observations: [obs('obs-r', 'entity-user-a', 5, '2024-04-01T00:00:00Z', 'event_count_by_action:READ', ['ev-r'], 'resource-db-1')],
      resourceId: 'resource-missing',
      featureName: 'event_count_by_action:READ',
      resources: [{ id: 'resource-db-1', resourceType: 'DB', resourceName: 'DB-01' }],
    })).toThrow(BaselineConstructionError);

    const baseline = buildResourceBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T05:00:00Z',
      observations: [obs('obs-r', 'entity-user-a', 5, '2024-04-01T00:00:00Z', 'event_count_by_action:READ', ['ev-r'])],
      resourceId: 'resource-db-1',
      featureName: 'event_count_by_action:READ',
      resources: [{ id: 'resource-db-1', resourceType: 'DB', resourceName: 'DB-01' }],
    });

    expect(baseline.available).toBe(false);
    expect(baseline.sampleCount).toBe(0);
  });

  it('AT-BASE-PERSONAL-001: identical input including IDs is deterministic across repeated runs', () => {
    const observations = [
      obs('obs-1', 'entity-user-a', 10, '2024-04-01T00:00:00Z', 'event_count_by_action:READ'),
      obs('obs-2', 'entity-user-a', 20, '2024-04-01T00:00:01Z', 'event_count_by_action:READ'),
    ];

    const first = buildPersonalBaseline({ actorEntityId: 'entity-user-a', asOf: '2024-04-01T01:00:00Z', observations, featureName: 'event_count_by_action:READ' });
    const second = buildPersonalBaseline({ actorEntityId: 'entity-user-a', asOf: '2024-04-01T01:00:00Z', observations: [...observations], featureName: 'event_count_by_action:READ' });

    expect(first).toEqual(second);
  });

  it('AT-BASE-PERSONAL-001: input immutability is preserved for array and object inputs', () => {
    const observations = [
      obs('obs-exact-1', 'entity-user-a', 7, '2024-04-01T00:00:00Z', 'event_count_by_action:READ', ['ev-exact-1'], 'resource-db-1'),
      obs('obs-exact-2', 'entity-user-a', 11, '2024-04-01T00:01:00Z', 'event_count_by_action:READ', ['ev-exact-2'], 'resource-db-1'),
      obs('obs-exact-3', 'entity-user-a', 13, '2024-04-01T00:00:00Z', 'event_count_by_action:READ', ['ev-exact-3'], 'resource-db-2'),
      obs('obs-exact-4', 'entity-user-a', 17, '2024-04-01T00:02:00Z', 'event_count_by_action:READ', ['ev-exact-4'], 'resource-db-1'),
    ];

    const baseline = buildResourceBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T00:02:00Z',
      observations,
      resourceId: 'resource-db-1',
      featureName: 'event_count_by_action:READ',
      resources: [{ id: 'resource-db-1', resourceType: 'DB', resourceName: 'DB-01' }, { id: 'resource-db-2', resourceType: 'DB', resourceName: 'DB-02' }],
    });

    expect(baseline.sampleCount).toBe(2);
    expect(baseline.sourceObservationIds).toEqual(['obs-exact-1', 'obs-exact-2']);
    expect(baseline.sourceEventIds).toEqual(['ev-exact-1', 'ev-exact-2']);
    expect(baseline.available).toBe(true);
  });

  it('AT-BASE-PERSONAL-001: input immutability is preserved for array and object inputs', () => {
    const observations = [obs('obs-a', 'entity-user-a', 10, '2024-04-01T00:00:00Z', 'event_count_by_action:READ')];
    const cohort = { id: 'c', name: 'c', cohortType: 'ROLE' as const, memberEntityIds: ['entity-user-a'], scope: [] };

    const before = JSON.stringify({ observations, cohort });
    buildPersonalBaseline({
      actorEntityId: 'entity-user-a',
      asOf: '2024-04-01T01:00:00Z',
      observations,
      featureName: 'event_count_by_action:READ',
    });

    expect(JSON.stringify({ observations, cohort })).toBe(before);
  });
});
