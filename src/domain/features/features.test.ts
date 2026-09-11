import { describe, expect, it } from 'vitest';

import { fixtureScenarios } from '../../fixtures/scenarios';
import { extractFeaturesForWindow, FeatureExtractionError } from './extract';

const findFeature = (features: ReturnType<typeof extractFeaturesForWindow>, featureName: string) =>
  features.find((feature) => feature.featureName === featureName);

describe('Milestone 2 feature extraction', () => {
  it('AT-FEAT-001: feature extraction produces deterministic features from ordered input', () => {
    const fixture = fixtureScenarios[0];
    const features = extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: fixture.events,
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    });

    expect(features.map((feature) => feature.featureName)).toEqual([
      'event_count_by_action:LOGIN',
      'event_count_by_action:READ',
      'event_count_by_action:ROLE_CHANGE',
      'event_count_by_domain:AUTHENTICATION',
      'event_count_by_domain:FILE_RESOURCE_ACCESS',
      'event_count_by_domain:PRIVILEGE_ACTIVITY',
      'event_count_by_event_type:LOGIN',
      'event_count_by_event_type:RESOURCE_ACCESS',
      'event_count_by_event_type:ROLE_CHANGE',
      'failed_outcome_count',
      'observed_volume_max',
      'observed_volume_sum',
      'privilege_change_count',
      'resource_type_access_count:DB',
      'total_event_count',
      'unique_destination_count',
      'unique_device_count',
      'unique_resource_count',
    ]);

    expect(findFeature(features, 'total_event_count')?.featureValue).toBe(3);
    expect(findFeature(features, 'event_count_by_domain:AUTHENTICATION')?.featureValue).toBe(1);
    expect(findFeature(features, 'event_count_by_domain:FILE_RESOURCE_ACCESS')?.featureValue).toBe(1);
    expect(findFeature(features, 'event_count_by_domain:PRIVILEGE_ACTIVITY')?.featureValue).toBe(1);
    expect(findFeature(features, 'event_count_by_action:ROLE_CHANGE')?.featureValue).toBe(1);
    expect(findFeature(features, 'resource_type_access_count:DB')?.featureValue).toBe(1);
    expect(findFeature(features, 'observed_volume_sum')?.featureValue).toBe(120 + 1 + 0);
    expect(findFeature(features, 'observed_volume_max')?.featureValue).toBe(120);
    expect(findFeature(features, 'unique_resource_count')?.featureValue).toBe(1);
    expect(findFeature(features, 'unique_device_count')?.featureValue).toBe(1);
    expect(findFeature(features, 'unique_destination_count')?.featureValue).toBe(2);
    expect(findFeature(features, 'privilege_change_count')?.featureValue).toBe(1);
    expect(findFeature(features, 'failed_outcome_count')?.featureValue).toBe(0);
  });

  it('AT-FEAT-PROV-001: feature provenance ties each feature to the exact source events', () => {
    const fixture = fixtureScenarios[0];
    const features = extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: fixture.events,
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    });

    const totalFeature = findFeature(features, 'total_event_count');
    const domainFeature = findFeature(features, 'event_count_by_domain:AUTHENTICATION');

    expect(totalFeature).toMatchObject({
      actorEntityId: 'entity-admin-user',
      source: 'DERIVED',
    });
    expect(totalFeature?.eventIds).toEqual(['event-role-login-001', 'event-role-change-002', 'event-role-read-003']);
    expect(new Set(totalFeature?.eventIds ?? []).size).toBe(totalFeature?.eventIds.length);
    expect(domainFeature?.eventIds).toEqual(['event-role-login-001']);
    expect(domainFeature?.eventIds.every((eventId) => totalFeature?.eventIds.includes(eventId))).toBe(true);
    expect(features.every((feature) => new Set(feature.eventIds).size === feature.eventIds.length)).toBe(true);
  });

  it('every event missing volume omits both observed-volume features', () => {
    const fixture = fixtureScenarios[0];
    const events = fixture.events.map((event) => ({ ...event, observedVolume: undefined }));
    const features = extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events,
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    });

    expect(findFeature(features, 'observed_volume_sum')).toBeUndefined();
    expect(findFeature(features, 'observed_volume_max')).toBeUndefined();
  });

  it('one observed zero emits both volume features with exact provenance', () => {
    const fixture = fixtureScenarios[0];
    const events = [
      { ...fixture.events[0], observedVolume: undefined },
      { ...fixture.events[1], observedVolume: 0 },
    ];

    const features = extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events,
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    });

    expect(findFeature(features, 'observed_volume_sum')?.featureValue).toBe(0);
    expect(findFeature(features, 'observed_volume_sum')?.eventIds).toEqual(['event-role-change-002']);
    expect(findFeature(features, 'observed_volume_max')?.featureValue).toBe(0);
    expect(findFeature(features, 'observed_volume_max')?.eventIds).toEqual(['event-role-change-002']);
  });

  it('missing plus zero plus non-zero volume emits only contributing events in sum and max', () => {
    const fixture = fixtureScenarios[0];
    const events = [
      { ...fixture.events[0], observedVolume: undefined },
      { ...fixture.events[1], observedVolume: 0 },
      { ...fixture.events[2], observedVolume: 4 },
      { ...fixture.events[2], id: 'event-role-read-004', timestamp: '2024-04-01T08:20:00Z', observedVolume: 6 },
    ];

    const features = extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events,
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    });

    expect(findFeature(features, 'observed_volume_sum')?.featureValue).toBe(10);
    expect(findFeature(features, 'observed_volume_sum')?.eventIds).toEqual(['event-role-change-002', 'event-role-read-003', 'event-role-read-004']);
    expect(findFeature(features, 'observed_volume_max')?.featureValue).toBe(6);
    expect(findFeature(features, 'observed_volume_max')?.eventIds).toEqual(['event-role-read-004']);
  });

  it('tied maxima cite all tied contributing events in canonical order', () => {
    const fixture = fixtureScenarios[0];
    const events = [
      { ...fixture.events[0], observedVolume: 25 },
      { ...fixture.events[1], observedVolume: 90 },
      { ...fixture.events[2], observedVolume: 90 },
    ];
    const features = extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events,
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    });

    expect(findFeature(features, 'observed_volume_max')?.eventIds).toEqual(['event-role-change-002', 'event-role-read-003']);
  });

  it('real old-to-new privilege transitions count, but identical or missing transitions do not', () => {
    const fixture = fixtureScenarios[0];
    const realTransition = {
      ...fixture.events[1],
      id: 'event-role-change-real-002',
      priorPrivilege: 'ROLE-STD',
      newPrivilege: 'ROLE-OPS-ADMIN',
    };
    const samePrivilege = {
      ...fixture.events[1],
      id: 'event-role-change-same-003',
      priorPrivilege: 'ROLE-OPS-ADMIN',
      newPrivilege: 'ROLE-OPS-ADMIN',
    };
    const genericPrivilege = {
      ...fixture.events[1],
      id: 'event-role-change-generic-004',
      priorPrivilege: undefined,
      newPrivilege: undefined,
    };
    const nonPrivilege = {
      ...fixture.events[0],
      id: 'event-role-login-no-privilege-005',
      priorPrivilege: 'OLD',
      newPrivilege: 'NEW',
    };

    const features = extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: [realTransition, samePrivilege, genericPrivilege, nonPrivilege],
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    });

    expect(findFeature(features, 'privilege_change_count')?.featureValue).toBe(1);
    expect(findFeature(features, 'privilege_change_count')?.eventIds).toEqual(['event-role-change-real-002']);
  });

  it('failed_outcome_count uses explicit outcome semantics and ignores text matches', () => {
    const fixture = fixtureScenarios[0];
    const textOnlyFailure = {
      ...fixture.events[0],
      id: 'event-failure-text-only',
      eventType: 'RESOURCE_ACCESS_FAILURE',
      outcome: 'SUCCESS' as const,
    };
    const realFailure = {
      ...fixture.events[0],
      id: 'event-real-failure',
      eventType: 'LOGIN',
      outcome: 'FAILURE' as const,
    };
    const features = extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: [textOnlyFailure, realFailure],
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    });

    expect(findFeature(features, 'failed_outcome_count')?.featureValue).toBe(1);
    expect(findFeature(features, 'failed_outcome_count')?.eventIds).toEqual(['event-real-failure']);
  });

  it('resource type and classification are not conflated, and unresolved resources are rejected', () => {
    const fixture = fixtureScenarios[0];
    const eventWithResource = { ...fixture.events[2], resourceId: 'resource-data-archive' };
    const noResourceEvent = { ...fixture.events[0], resourceId: undefined };
    const unresolvedResourceEvent = { ...fixture.events[2], id: 'event-unresolved-resource', resourceId: 'resource-missing' };

    const features = extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: [eventWithResource, noResourceEvent],
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    });

    expect(findFeature(features, 'resource_type_access_count:DB')?.featureValue).toBe(1);
    expect(findFeature(features, 'resource_type_access_count:DB')?.eventIds).toEqual(['event-role-read-003']);
    expect(findFeature(features, 'resource_classification_access_count:DB')).toBeUndefined();
    expect(findFeature(features, 'resource_type_access_count:DB')?.eventIds).not.toContain('event-role-login-001');

    expect(() => extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: [unresolvedResourceEvent],
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    })).toThrowError(new FeatureExtractionError('UNRESOLVED_RESOURCE_REFERENCE', 'events[event-unresolved-resource].resourceId', "Event 'event-unresolved-resource' references an unknown resource 'resource-missing'."));
  });

  it('stable feature IDs are deterministic and include schema, actor, start, end and feature name', () => {
    const fixture = fixtureScenarios[0];
    const featuresA = extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: fixture.events,
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    });
    const featuresB = extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: fixture.events,
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    });

    expect(featuresA.map((feature) => feature.id)).toEqual(featuresB.map((feature) => feature.id));
    expect(new Set(featuresA.map((feature) => feature.id)).size).toBe(featuresA.length);
    expect(featuresA[0]?.id).toContain('silent-shift.v1');
    expect(featuresA[0]?.id).toContain('entity-admin-user');
    expect(featuresA[0]?.id).toContain(encodeURIComponent('2024-04-01T08:00:00Z'));
    expect(featuresA[0]?.id).toContain(encodeURIComponent('2024-04-01T08:30:00Z'));
    expect(featuresA[0]?.id).toContain(encodeURIComponent('event_count_by_action:LOGIN'));
  });

  it('no-event window emits zero aggregate features and omits measurement features', () => {
    const fixture = fixtureScenarios[0];
    const features = extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: [],
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    });

    expect(findFeature(features, 'total_event_count')?.featureValue).toBe(0);
    expect(findFeature(features, 'total_event_count')?.eventIds).toEqual([]);
    expect(findFeature(features, 'unique_resource_count')?.featureValue).toBe(0);
    expect(findFeature(features, 'failed_outcome_count')?.featureValue).toBe(0);
    expect(findFeature(features, 'observed_volume_sum')).toBeUndefined();
    expect(findFeature(features, 'observed_volume_max')).toBeUndefined();
  });

  it('excludes cross-actor events and preserves canonical order for feature provenance', () => {
    const fixture = fixtureScenarios[0];
    const mixedEvents = [
      { ...fixture.events[2], id: 'event-other-actor', actorEntityId: 'entity-project-migration' },
      ...fixture.events,
    ];
    const features = extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: mixedEvents,
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    });

    expect(features.every((feature) => !feature.eventIds.includes('event-other-actor'))).toBe(true);
    expect(findFeature(features, 'total_event_count')?.eventIds).toEqual(['event-role-login-001', 'event-role-change-002', 'event-role-read-003']);
  });

  it('throws structured errors for invalid window values', () => {
    const fixture = fixtureScenarios[0];
    expect(() => extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: fixture.events,
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:30:00Z',
        endExclusive: '2024-04-01T08:00:00Z',
      },
    })).toThrow(FeatureExtractionError);
  });

  it('throws structured errors for malformed event timestamps', () => {
    const fixture = fixtureScenarios[0];
    expect(() => extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: [{ ...fixture.events[0], timestamp: 'not-a-time' }],
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    })).toThrow(FeatureExtractionError);
  });

  it('throws structured errors for invalid numeric values', () => {
    const fixture = fixtureScenarios[0];
    expect(() => extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: [{ ...fixture.events[0], observedVolume: Number.NaN }],
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    })).toThrow(FeatureExtractionError);
  });

  it('throws structured errors for duplicate event IDs', () => {
    const fixture = fixtureScenarios[0];
    const duplicateEvents = [
      ...fixture.events,
      { ...fixture.events[0], id: fixture.events[0].id, timestamp: '2024-04-01T08:02:00Z' },
    ];
    expect(() => extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: duplicateEvents,
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    })).toThrow(FeatureExtractionError);
  });

  it('throws structured errors for unsupported schema versions', () => {
    const fixture = fixtureScenarios[0];
    expect(() => extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: [{ ...fixture.events[0], schemaVersion: 'wrong-version' as any }],
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    })).toThrow(FeatureExtractionError);
  });

  it('accepts undefined, valid, and rejects unresolved resource references', () => {
    const fixture = fixtureScenarios[0];

    expect(() => extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: [{ ...fixture.events[0], resourceId: undefined }],
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    })).not.toThrow();

    expect(() => extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: [{ ...fixture.events[2], resourceId: 'resource-data-archive' }],
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    })).not.toThrow();

    try {
      extractFeaturesForWindow({
        actorEntityId: 'entity-admin-user',
        events: [{ ...fixture.events[2], id: 'event-missing-resource', resourceId: 'resource-does-not-exist' }],
        entities: fixture.entities,
        resources: fixture.resources,
        window: {
          startInclusive: '2024-04-01T08:00:00Z',
          endExclusive: '2024-04-01T08:30:00Z',
        },
      });
      throw new Error('expected unresolved resource error');
    } catch (error) {
      expect(error).toBeInstanceOf(FeatureExtractionError);
      expect((error as FeatureExtractionError).code).toBe('UNRESOLVED_RESOURCE_REFERENCE');
      expect((error as FeatureExtractionError).path).toBe('events[event-missing-resource].resourceId');
      expect((error as FeatureExtractionError).message).toContain('resource-does-not-exist');
    }
  });

  it('rejects unresolved selected in-window device and destination references without affecting unrelated actors', () => {
    const fixture = fixtureScenarios[0];
    const selectedEvents = [{
      ...fixture.events[0],
      deviceEntityId: 'entity-device-does-not-exist',
      destinationEntityId: 'entity-device-laptop-01',
    }];
    const unrelatedOutOfWindow = [{
      ...fixture.events[0],
      id: 'event-out-of-window-bad-device',
      actorEntityId: 'entity-project-migration',
      timestamp: '2024-04-01T07:00:00Z',
      deviceEntityId: 'entity-device-does-not-exist',
    }];

    try {
      extractFeaturesForWindow({
        actorEntityId: 'entity-admin-user',
        events: [...selectedEvents, ...unrelatedOutOfWindow],
        entities: fixture.entities,
        resources: fixture.resources,
        window: {
          startInclusive: '2024-04-01T08:00:00Z',
          endExclusive: '2024-04-01T08:30:00Z',
        },
      });
      throw new Error('expected unresolved device error');
    } catch (error) {
      expect(error).toBeInstanceOf(FeatureExtractionError);
      expect((error as FeatureExtractionError).code).toBe('UNRESOLVED_DEVICE_REFERENCE');
      expect((error as FeatureExtractionError).path).toBe('events[event-role-login-001].deviceEntityId');
      expect((error as FeatureExtractionError).message).toContain('entity-device-does-not-exist');
    }

    try {
      extractFeaturesForWindow({
        actorEntityId: 'entity-admin-user',
        events: [{
          ...fixture.events[0],
          id: 'event-missing-destination',
          deviceEntityId: undefined,
          destinationEntityId: 'entity-destination-missing',
        }, ...unrelatedOutOfWindow],
        entities: fixture.entities,
        resources: fixture.resources,
        window: {
          startInclusive: '2024-04-01T08:00:00Z',
          endExclusive: '2024-04-01T08:30:00Z',
        },
      });
      throw new Error('expected unresolved destination error');
    } catch (error) {
      expect(error).toBeInstanceOf(FeatureExtractionError);
      expect((error as FeatureExtractionError).code).toBe('UNRESOLVED_DESTINATION_REFERENCE');
      expect((error as FeatureExtractionError).path).toBe('events[event-missing-destination].destinationEntityId');
      expect((error as FeatureExtractionError).message).toContain('entity-destination-missing');
    }
  });

  it('uses unambiguous stable feature IDs with deterministic encoding', () => {
    const fixture = fixtureScenarios[0];
    const baseWindow = {
      startInclusive: '2024-04-01T08:00:00Z',
      endExclusive: '2024-04-01T08:30:00Z',
    };

    const featuresA = extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: fixture.events,
      entities: fixture.entities,
      resources: fixture.resources,
      window: baseWindow,
    });
    const featuresB = extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: fixture.events,
      entities: fixture.entities,
      resources: fixture.resources,
      window: baseWindow,
    });

    expect(featuresA.map((feature) => feature.id)).toEqual(featuresB.map((feature) => feature.id));
    expect(new Set(featuresA.map((feature) => feature.id)).size).toBe(featuresA.length);

    const window2 = {
      startInclusive: '2024-04-01T08:05:00Z',
      endExclusive: '2024-04-01T08:30:00Z',
    };
    const window3 = {
      startInclusive: '2024-04-01T08:00:00Z',
      endExclusive: '2024-04-01T08:35:00Z',
    };

    const featuresStart = extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: fixture.events,
      entities: fixture.entities,
      resources: fixture.resources,
      window: window2,
    });
    const featuresEnd = extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: fixture.events,
      entities: fixture.entities,
      resources: fixture.resources,
      window: window3,
    });
    const featuresActor = extractFeaturesForWindow({
      actorEntityId: 'entity-project-migration',
      events: fixture.events,
      entities: fixture.entities,
      resources: fixture.resources,
      window: baseWindow,
    });

    expect(featuresA[0]?.id).toContain('feature|');
    expect(featuresA[0]?.id).toContain('silent-shift.v1');
    expect(featuresA[0]?.id).toContain('entity-admin-user');
    expect(featuresA[0]?.id).toContain('2024-04-01T08%3A00%3A00Z');
    expect(featuresA[0]?.id).toContain('2024-04-01T08%3A30%3A00Z');
    expect(featuresA[0]?.id).toContain('event_count_by_action%3ALOGIN');

    expect(featuresA[0]?.id).not.toBe(featuresStart[0]?.id);
    expect(featuresA[0]?.id).not.toBe(featuresEnd[0]?.id);
    expect(featuresA[0]?.id).not.toBe(featuresActor[0]?.id);

    const actorWithSpecialChars = 'actor:with|space%/slash';
    const actorWithSpecialChars2 = 'actor:with|space%/slash-two';
    const specialFeatureId = extractFeaturesForWindow({
      actorEntityId: actorWithSpecialChars,
      events: [{ ...fixture.events[0], actorEntityId: actorWithSpecialChars, id: 'event-special-1', timestamp: '2024-04-01T08:00:00Z' }],
      entities: [...fixture.entities, { ...fixture.entities[0], id: actorWithSpecialChars, displayName: 'entity-actor-with-special-chars' }],
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    }).find((feature) => feature.featureName.includes('event_count_by_action'))?.id;
    const specialFeatureId2 = extractFeaturesForWindow({
      actorEntityId: actorWithSpecialChars2,
      events: [{ ...fixture.events[0], actorEntityId: actorWithSpecialChars2, id: 'event-special-2', timestamp: '2024-04-01T08:00:00Z' }],
      entities: [...fixture.entities, { ...fixture.entities[0], id: actorWithSpecialChars2, displayName: 'entity-actor-with-special-chars-2' }],
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    }).find((feature) => feature.featureName.includes('event_count_by_action'))?.id;

    expect(specialFeatureId).not.toBeUndefined();
    expect(specialFeatureId).not.toBe(specialFeatureId2);
    expect(specialFeatureId).toContain(encodeURIComponent(actorWithSpecialChars));
    expect(specialFeatureId).toContain(encodeURIComponent('event_count_by_action:LOGIN'));
  });

  it('treats categorical absence as zero, while missing volume remains absent', () => {
    const fixture = fixtureScenarios[0];
    const features = extractFeaturesForWindow({
      actorEntityId: 'entity-admin-user',
      events: [{ ...fixture.events[0], action: 'LOGIN' }],
      entities: fixture.entities,
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    });

    expect(findFeature(features, 'event_count_by_action:LOGIN')).toBeDefined();
    expect(findFeature(features, 'event_count_by_action:ROLE_CHANGE')).toBeUndefined();
    expect(findFeature(features, 'observed_volume_sum')).toBeUndefined();
    expect(findFeature(features, 'observed_volume_max')).toBeUndefined();
  });

  it('throws structured errors for unknown actor references when entity data is required', () => {
    const fixture = fixtureScenarios[0];
    expect(() => extractFeaturesForWindow({
      actorEntityId: 'entity-unknown-actor',
      events: fixture.events,
      entities: fixture.entities.slice(0, 2),
      resources: fixture.resources,
      window: {
        startInclusive: '2024-04-01T08:00:00Z',
        endExclusive: '2024-04-01T08:30:00Z',
      },
    })).toThrow(FeatureExtractionError);
  });
});
