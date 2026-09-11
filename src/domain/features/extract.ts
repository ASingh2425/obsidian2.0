import {
  SCHEMA_VERSION,
  type Entity,
  type FeatureObservation,
  type Resource,
  type SecurityEvent,
  type ValidationIssue,
} from '../types';

export interface ExtractionWindow {
  startInclusive: string;
  endExclusive: string;
}

export interface ExtractFeatureInput {
  actorEntityId: string;
  events: SecurityEvent[];
  entities: Entity[];
  resources: Resource[];
  window: ExtractionWindow;
}

export class FeatureExtractionError extends Error implements ValidationIssue {
  code: string;
  path: string;

  constructor(code: string, path: string, message: string) {
    super(message);
    this.name = 'FeatureExtractionError';
    this.code = code;
    this.path = path;
  }
}

const validateFiniteNumber = (value: number | undefined, path: string): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new FeatureExtractionError('INVALID_NUMERIC_VALUE', path, `Numeric value at '${path}' must be a finite, non-negative number.`);
  }

  return value;
};

const compareOrdinalStrings = (left: string, right: string): number => {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
};

const toNumericTimestamp = (value: string): number => {
  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    throw new FeatureExtractionError('INVALID_TIMESTAMP', 'event.timestamp', `Timestamp '${value}' is not a valid ISO-8601 value.`);
  }

  return parsed;
};

const stableFeatureId = (
  actorEntityId: string,
  startInclusive: string,
  endExclusive: string,
  featureName: string,
): string => `feature|${[
  SCHEMA_VERSION,
  actorEntityId,
  startInclusive,
  endExclusive,
  featureName,
].map((value) => encodeURIComponent(value)).join('|')}`;

const canonicalOrderEvents = (events: SecurityEvent[]): SecurityEvent[] => {
  return [...events].sort((left, right) => {
    const timeDelta = toNumericTimestamp(left.timestamp) - toNumericTimestamp(right.timestamp);

    if (timeDelta !== 0) {
      return timeDelta;
    }

    return compareOrdinalStrings(left.id ?? '', right.id ?? '');
  });
};

const uniqueSortedIds = (ids: string[]): string[] => [...new Set(ids)].sort(compareOrdinalStrings);

const canonicalEventIds = (events: SecurityEvent[]): string[] => {
  const seen = new Set<string>();

  return [...events]
    .sort((left, right) => {
      const timeDelta = toNumericTimestamp(left.timestamp) - toNumericTimestamp(right.timestamp);
      if (timeDelta !== 0) {
        return timeDelta;
      }

      return compareOrdinalStrings(left.id ?? '', right.id ?? '');
    })
    .map((event) => event.id)
    .filter((eventId) => {
      if (!eventId || seen.has(eventId)) {
        return false;
      }

      seen.add(eventId);
      return true;
    });
};

const toFeatureObservation = (
  actorEntityId: string,
  featureName: string,
  featureValue: number,
  startInclusive: string,
  endExclusive: string,
  eventIds: string[],
  source: 'EVENT' | 'DERIVED' = 'DERIVED',
): FeatureObservation => ({
  id: stableFeatureId(actorEntityId, startInclusive, endExclusive, featureName),
  schemaVersion: SCHEMA_VERSION,
  actorEntityId,
  featureName,
  featureValue,
  observedAt: endExclusive,
  source,
  eventIds: eventIds.slice(),
});

const resourceTypeForEvent = (resourceId: string | undefined, resources: Resource[]): string | undefined => {
  if (!resourceId) {
    return undefined;
  }

  const resource = resources.find((item) => item.id === resourceId);
  return resource?.resourceType;
};

const resourceClassificationForEvent = (resourceId: string | undefined, resources: Resource[]): string | undefined => {
  if (!resourceId) {
    return undefined;
  }

  const resource = resources.find((item) => item.id === resourceId);
  return resource?.classification;
};

const filteredByWindow = (events: SecurityEvent[], window: ExtractionWindow, actorEntityId: string): SecurityEvent[] => {
  const startMs = toNumericTimestamp(window.startInclusive);
  const endMs = toNumericTimestamp(window.endExclusive);

  if (startMs >= endMs) {
    throw new FeatureExtractionError('INVALID_WINDOW', 'window', 'Window start must be strictly earlier than the end time.');
  }

  return canonicalOrderEvents(events).filter((event) => {
    if (event.actorEntityId !== actorEntityId) {
      return false;
    }

    const eventMs = toNumericTimestamp(event.timestamp);
    return eventMs >= startMs && eventMs < endMs;
  });
};

const eventCountsByKey = (
  events: SecurityEvent[],
  key: (event: SecurityEvent) => string | undefined,
  featurePrefix: string,
  actorEntityId: string,
  startInclusive: string,
  endExclusive: string,
): FeatureObservation[] => {
  const buckets = new Map<string, SecurityEvent[]>();

  for (const event of events) {
    const value = key(event);
    if (!value) {
      continue;
    }

    const bucket = buckets.get(value) ?? [];
    bucket.push(event);
    buckets.set(value, bucket);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => compareOrdinalStrings(left, right))
    .map(([bucketKey, bucketEvents]) => {
      const featureName = `${featurePrefix}:${bucketKey}`;
      return toFeatureObservation(
        actorEntityId,
        featureName,
        bucketEvents.length,
        startInclusive,
        endExclusive,
        canonicalEventIds(bucketEvents),
      );
    });
};

const sumObservedVolume = (
  events: SecurityEvent[],
  actorEntityId: string,
  startInclusive: string,
  endExclusive: string,
): FeatureObservation | undefined => {
  const contributing = events.filter((event) => event.observedVolume !== undefined);
  if (contributing.length === 0) {
    return undefined;
  }

  const numericValues = contributing
    .map((event) => validateFiniteNumber(event.observedVolume, `events[${event.id}].observedVolume`))
    .filter((value): value is number => value !== undefined);

  if (numericValues.length === 0) {
    return undefined;
  }

  return toFeatureObservation(
    actorEntityId,
    'observed_volume_sum',
    numericValues.reduce((total, value) => total + value, 0),
    startInclusive,
    endExclusive,
    canonicalEventIds(contributing),
  );
};

const maxObservedVolume = (
  events: SecurityEvent[],
  actorEntityId: string,
  startInclusive: string,
  endExclusive: string,
): FeatureObservation | undefined => {
  const contributing = events.filter((event) => event.observedVolume !== undefined);
  if (contributing.length === 0) {
    return undefined;
  }

  const numericValues = contributing
    .map((event) => validateFiniteNumber(event.observedVolume, `events[${event.id}].observedVolume`))
    .filter((value): value is number => value !== undefined);

  if (numericValues.length === 0) {
    return undefined;
  }

  const maxValue = Math.max(...numericValues);
  const matchingEvents = contributing.filter(
    (event) => validateFiniteNumber(event.observedVolume, `events[${event.id}].observedVolume`) === maxValue,
  );

  return toFeatureObservation(
    actorEntityId,
    'observed_volume_max',
    maxValue,
    startInclusive,
    endExclusive,
    canonicalEventIds(matchingEvents),
  );
};

export const extractFeaturesForWindow = (input: ExtractFeatureInput): FeatureObservation[] => {
  const entityIds = new Set(input.entities.map((entity) => entity.id));
  const resourceIds = new Set(input.resources.map((resource) => resource.id));
  const eventIdSet = new Set<string>();

  if (!input.actorEntityId || !entityIds.has(input.actorEntityId)) {
    throw new FeatureExtractionError('UNKNOWN_ACTOR_REFERENCE', 'actorEntityId', `Actor '${input.actorEntityId}' does not exist in the entity set.`);
  }

  const normalizedEvents = canonicalOrderEvents(input.events.map((event) => ({ ...event })));

  for (const event of normalizedEvents) {
    if (!event.id) {
      throw new FeatureExtractionError('MISSING_ID', 'events', 'Every event requires an id.');
    }

    if (eventIdSet.has(event.id)) {
      throw new FeatureExtractionError('DUPLICATE_ID', `events[${event.id}]`, `Duplicate event id '${event.id}' was found.`);
    }

    eventIdSet.add(event.id);

    if (!event.schemaVersion || event.schemaVersion !== SCHEMA_VERSION) {
      throw new FeatureExtractionError('INVALID_SCHEMA_VERSION', `events[${event.id}].schemaVersion`, `Event '${event.id}' has an unsupported schemaVersion.`);
    }

    if (!event.timestamp || !Number.isFinite(Date.parse(event.timestamp))) {
      throw new FeatureExtractionError('INVALID_TIMESTAMP', `events[${event.id}].timestamp`, `Event '${event.id}' has an invalid ISO-8601 timestamp.`);
    }

    if (!entityIds.has(event.actorEntityId)) {
      throw new FeatureExtractionError('UNKNOWN_ACTOR_REFERENCE', `events[${event.id}].actorEntityId`, `Event '${event.id}' references an unknown actor.`);
    }

    if (event.observedVolume !== undefined) {
      validateFiniteNumber(event.observedVolume, `events[${event.id}].observedVolume`);
    }
  }

  const inWindow = filteredByWindow(normalizedEvents, input.window, input.actorEntityId);

  for (const event of inWindow) {
    if (event.resourceId !== undefined && !resourceIds.has(event.resourceId)) {
      throw new FeatureExtractionError(
        'UNRESOLVED_RESOURCE_REFERENCE',
        `events[${event.id}].resourceId`,
        `Event '${event.id}' references an unknown resource '${event.resourceId}'.`,
      );
    }

    if (event.deviceEntityId !== undefined && !entityIds.has(event.deviceEntityId)) {
      throw new FeatureExtractionError(
        'UNRESOLVED_DEVICE_REFERENCE',
        `events[${event.id}].deviceEntityId`,
        `Event '${event.id}' references an unknown device entity '${event.deviceEntityId}'.`,
      );
    }

    if (event.destinationEntityId !== undefined && !entityIds.has(event.destinationEntityId)) {
      throw new FeatureExtractionError(
        'UNRESOLVED_DESTINATION_REFERENCE',
        `events[${event.id}].destinationEntityId`,
        `Event '${event.id}' references an unknown destination entity '${event.destinationEntityId}'.`,
      );
    }
  }

  const zeroAggregateFeatures = [
    toFeatureObservation(input.actorEntityId, 'total_event_count', 0, input.window.startInclusive, input.window.endExclusive, []),
    toFeatureObservation(input.actorEntityId, 'unique_resource_count', 0, input.window.startInclusive, input.window.endExclusive, []),
    toFeatureObservation(input.actorEntityId, 'unique_device_count', 0, input.window.startInclusive, input.window.endExclusive, []),
    toFeatureObservation(input.actorEntityId, 'unique_destination_count', 0, input.window.startInclusive, input.window.endExclusive, []),
    toFeatureObservation(input.actorEntityId, 'privilege_change_count', 0, input.window.startInclusive, input.window.endExclusive, []),
    toFeatureObservation(input.actorEntityId, 'failed_outcome_count', 0, input.window.startInclusive, input.window.endExclusive, []),
  ];

  if (inWindow.length === 0) {
    return zeroAggregateFeatures.sort((left, right) => compareOrdinalStrings(left.featureName, right.featureName));
  }

  const totalEventCount = toFeatureObservation(
    input.actorEntityId,
    'total_event_count',
    inWindow.length,
    input.window.startInclusive,
    input.window.endExclusive,
    inWindow.map((event) => event.id),
  );

  const domainBuckets = eventCountsByKey(
    inWindow,
    (event) => event.domain,
    'event_count_by_domain',
    input.actorEntityId,
    input.window.startInclusive,
    input.window.endExclusive,
  );
  const eventTypeBuckets = eventCountsByKey(
    inWindow,
    (event) => event.eventType,
    'event_count_by_event_type',
    input.actorEntityId,
    input.window.startInclusive,
    input.window.endExclusive,
  );
  const actionBuckets = eventCountsByKey(
    inWindow,
    (event) => event.action,
    'event_count_by_action',
    input.actorEntityId,
    input.window.startInclusive,
    input.window.endExclusive,
  );

  const resourceIdsInWindow = uniqueSortedIds(
    inWindow.filter((event) => event.resourceId).map((event) => event.resourceId as string),
  );

  const uniqueResourceCount = toFeatureObservation(
    input.actorEntityId,
    'unique_resource_count',
    resourceIdsInWindow.length,
    input.window.startInclusive,
    input.window.endExclusive,
    canonicalEventIds(inWindow.filter((event) => event.resourceId)),
  );

  const deviceIdsInWindow = uniqueSortedIds(
    inWindow.filter((event) => event.deviceEntityId).map((event) => event.deviceEntityId as string),
  );

  const uniqueDeviceCount = toFeatureObservation(
    input.actorEntityId,
    'unique_device_count',
    deviceIdsInWindow.length,
    input.window.startInclusive,
    input.window.endExclusive,
    canonicalEventIds(inWindow.filter((event) => event.deviceEntityId)),
  );

  const destinationIdsInWindow = uniqueSortedIds(
    inWindow.filter((event) => event.destinationEntityId).map((event) => event.destinationEntityId as string),
  );

  const uniqueDestinationCount = toFeatureObservation(
    input.actorEntityId,
    'unique_destination_count',
    destinationIdsInWindow.length,
    input.window.startInclusive,
    input.window.endExclusive,
    canonicalEventIds(inWindow.filter((event) => event.destinationEntityId)),
  );

  const volumeSum = sumObservedVolume(inWindow, input.actorEntityId, input.window.startInclusive, input.window.endExclusive);
  const volumeMax = maxObservedVolume(inWindow, input.actorEntityId, input.window.startInclusive, input.window.endExclusive);

  const privilegeTransitionEvents = inWindow.filter((event) => {
    if (event.domain !== 'PRIVILEGE_ACTIVITY') {
      return false;
    }

    const hasTransitionFields = event.priorPrivilege !== undefined || event.newPrivilege !== undefined;
    if (!hasTransitionFields) {
      return false;
    }

    return event.priorPrivilege !== event.newPrivilege;
  });

  const privilegeChangeCount = toFeatureObservation(
    input.actorEntityId,
    'privilege_change_count',
    privilegeTransitionEvents.length,
    input.window.startInclusive,
    input.window.endExclusive,
    canonicalEventIds(privilegeTransitionEvents),
  );

  const failedOutcomeEvents = inWindow.filter((event) => event.outcome === 'FAILURE');
  const failedOutcomeCount = toFeatureObservation(
    input.actorEntityId,
    'failed_outcome_count',
    failedOutcomeEvents.length,
    input.window.startInclusive,
    input.window.endExclusive,
    canonicalEventIds(failedOutcomeEvents),
  );

  const resourceTypeCounts = new Map<string, SecurityEvent[]>();
  const resourceClassificationCounts = new Map<string, SecurityEvent[]>();
  for (const event of inWindow) {
    const resourceType = resourceTypeForEvent(event.resourceId, input.resources);
    if (resourceType) {
      const bucket = resourceTypeCounts.get(resourceType) ?? [];
      bucket.push(event);
      resourceTypeCounts.set(resourceType, bucket);
    }

    const resourceClassification = resourceClassificationForEvent(event.resourceId, input.resources);
    if (resourceClassification) {
      const bucket = resourceClassificationCounts.get(resourceClassification) ?? [];
      bucket.push(event);
      resourceClassificationCounts.set(resourceClassification, bucket);
    }
  }

  const resourceTypeFeatures = [...resourceTypeCounts.entries()]
    .sort(([left], [right]) => compareOrdinalStrings(left, right))
    .map(([resourceType, events]) =>
      toFeatureObservation(
        input.actorEntityId,
        `resource_type_access_count:${resourceType}`,
        events.length,
        input.window.startInclusive,
        input.window.endExclusive,
        canonicalEventIds(events),
      ),
    );

  const classificationFeatures = [...resourceClassificationCounts.entries()]
    .sort(([left], [right]) => compareOrdinalStrings(left, right))
    .map(([classification, events]) =>
      toFeatureObservation(
        input.actorEntityId,
        `resource_classification_access_count:${classification}`,
        events.length,
        input.window.startInclusive,
        input.window.endExclusive,
        canonicalEventIds(events),
      ),
    );

  const features = [
    ...domainBuckets,
    ...eventTypeBuckets,
    ...actionBuckets,
    totalEventCount,
    uniqueResourceCount,
    uniqueDeviceCount,
    uniqueDestinationCount,
    ...(volumeSum ? [volumeSum] : []),
    ...(volumeMax ? [volumeMax] : []),
    privilegeChangeCount,
    failedOutcomeCount,
    ...resourceTypeFeatures,
    ...classificationFeatures,
  ].sort((left, right) => compareOrdinalStrings(left.featureName, right.featureName));

  return features;
};
