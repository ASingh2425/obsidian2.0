import {
  SCHEMA_VERSION,
  type BaselineSnapshot,
  type BaselineType,
  type PeerCohort,
  type Resource,
} from '../types';

export type { BaselineSnapshot, BaselineType, PeerCohort } from '../types';

export interface BaselineObservation {
  id: string;
  actorEntityId: string;
  observedAt: string;
  featureName: string;
  value: number;
  sourceEventIds?: string[];
  resourceId?: string;
}

export interface BaselineBuildInput {
  actorEntityId: string;
  asOf: string;
  observations: BaselineObservation[];
  featureName: string;
  minimumSampleCount?: number;
}

export interface PeerBaselineBuildInput extends BaselineBuildInput {
  cohort: PeerCohort;
  entities?: Array<{ id: string }>;
}

export interface ResourceBaselineBuildInput extends BaselineBuildInput {
  resourceId: string;
  resources: Resource[];
}

export interface BaselineHierarchyInput {
  actorEntityId: string;
  asOf: string;
  personalObservations: BaselineObservation[];
  peerObservations: BaselineObservation[];
  resourceObservations: BaselineObservation[];
  featureName: string;
  cohort?: PeerCohort;
  entities?: Array<{ id: string }>;
  resourceId?: string;
  resources?: Resource[];
  minimumSampleCount?: number;
}

export class BaselineConstructionError extends Error {
  code: string;
  path: string;

  constructor(code: string, path: string, message: string) {
    super(message);
    this.name = 'BaselineConstructionError';
    this.code = code;
    this.path = path;
  }
}

const compareOrdinalStrings = (left: string, right: string): number => {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
};

const sortByTimestampAndId = <T extends { id: string; observedAt: string }>(left: T, right: T): number => {
  const leftTime = numericTimestamp(left.observedAt, `observations[].observedAt:${left.id}`);
  const rightTime = numericTimestamp(right.observedAt, `observations[].observedAt:${right.id}`);

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return compareOrdinalStrings(left.id, right.id);
};

const numericTimestamp = (value: string, path: string): number => {
  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    throw new BaselineConstructionError('INVALID_TIMESTAMP', path, `Timestamp '${value}' is not a valid ISO-8601 value.`);
  }

  return parsed;
};

const isFiniteValue = (value: number, path: string): number => {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    throw new BaselineConstructionError('INVALID_NUMERIC_VALUE', path, `Numeric value at '${path}' must be finite.`);
  }

  return value;
};

const uniqueSorted = (values: string[]): string[] => [...new Set(values)].sort(compareOrdinalStrings);

const computeMedianAndMad = (sample: number[]) => {
  const sorted = [...sample].sort((left, right) => left - right);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  if (sorted.length === 0) {
    return {
      median: undefined,
      mad: undefined,
      min: undefined,
      max: undefined,
    };
  }

  let median: number;
  if (sorted.length % 2 === 0) {
    median = (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  } else {
    median = sorted[Math.floor(sorted.length / 2)];
  }

  const deviations = sorted.map((value) => Math.abs(value - median));
  const sortedDeviation = [...deviations].sort((left, right) => left - right);

  let mad: number;
  if (sortedDeviation.length % 2 === 0) {
    mad = (sortedDeviation[sortedDeviation.length / 2 - 1] + sortedDeviation[sortedDeviation.length / 2]) / 2;
  } else {
    mad = sortedDeviation[Math.floor(sortedDeviation.length / 2)];
  }

  return {
    median,
    mad,
    min,
    max,
  };
};

const emptyBaseline = ({
  actorEntityId,
  asOf,
  featureName,
  baselineType,
  cohortId,
  resourceId,
}: {
  actorEntityId: string;
  asOf: string;
  featureName: string;
  baselineType: BaselineType;
  cohortId?: string;
  resourceId?: string;
}): BaselineSnapshot => ({
  id: `baseline|${baselineType}|${actorEntityId}|${featureName}|${asOf}`,
  schemaVersion: SCHEMA_VERSION,
  actorEntityId,
  asOf,
  baselineType,
  featureName,
  sampleCount: 0,
  observationCount: 0,
  median: null,
  mad: null,
  min: null,
  max: null,
  coverage: 0,
  quality: 'LOW',
  available: false,
  sourceObservationIds: [],
  sourceEventIds: [],
  cohortId,
  resourceId,
  notes: 'The minimum sample threshold was not met.',
});

const validateMinimumSampleCount = (value: number | undefined, path: string): number => {
  const candidate = value ?? 1;

  if (!Number.isFinite(candidate)) {
    throw new BaselineConstructionError('INVALID_MINIMUM_SAMPLE_COUNT', path, `${path} must be a finite integer greater than or equal to 1.`);
  }

  if (!Number.isInteger(candidate) || candidate < 1) {
    throw new BaselineConstructionError('INVALID_MINIMUM_SAMPLE_COUNT', path, `${path} must be an integer greater than or equal to 1.`);
  }

  return candidate;
};

const normalizeBaselines = (items: BaselineObservation[]) =>
  items.map((item) => ({
    ...item,
    sourceEventIds: Array.isArray(item.sourceEventIds) ? item.sourceEventIds.slice() : [],
  }));

const validateCohortMembership = ({
  cohort,
  entities,
}: {
  cohort: { memberEntityIds: string[] };
  entities?: Array<{ id: string }>;
}) => {
  if (cohort.memberEntityIds.length !== new Set(cohort.memberEntityIds).size) {
    throw new BaselineConstructionError('DUPLICATE_COHORT_MEMBER', 'cohort.memberEntityIds', 'Peer cohort member ids must be unique.');
  }

  if (entities && entities.length > 0) {
    const explicit = new Set(entities.map((entity) => entity.id));
    const unknown = cohort.memberEntityIds.filter((memberId) => !explicit.has(memberId));

    if (unknown.length > 0) {
      throw new BaselineConstructionError('UNKNOWN_COHORT_MEMBER', 'cohort.memberEntityIds', `Peer cohort member(s) are not in the explicit entity list: ${unknown.join(', ')}`);
    }
  }
};

export const buildPersonalBaseline = ({
  actorEntityId,
  asOf,
  observations,
  featureName,
  minimumSampleCount,
}: BaselineBuildInput): BaselineSnapshot => {
  const minimum = validateMinimumSampleCount(minimumSampleCount, 'minimumSampleCount');
  const cutoff = numericTimestamp(asOf, 'asOf');

  const filtered = normalizeBaselines(observations)
    .filter((item) => item.featureName === featureName)
    .filter((item) => item.actorEntityId === actorEntityId)
    .filter((item) => numericTimestamp(item.observedAt, `observations[].observedAt:${item.id}`) < cutoff)
    .map((item) => {
      const value = isFiniteValue(item.value, `observations[${item.id}].value`);
      return { ...item, value };
    });

  const ordered = [...filtered].sort(sortByTimestampAndId);

  if (ordered.length === 0) {
    return emptyBaseline({ actorEntityId, asOf, featureName, baselineType: 'PERSONAL' });
  }

  const summary = computeMedianAndMad(ordered.map((item) => item.value));
  const sourceEventIds = uniqueSorted(ordered.flatMap((item) => item.sourceEventIds ?? []));
  const available = ordered.length >= minimum;

  return {
    id: `baseline|PERSONAL|${actorEntityId}|${featureName}|${asOf}`,
    schemaVersion: SCHEMA_VERSION,
    actorEntityId,
    asOf,
    baselineType: 'PERSONAL',
    featureName,
    sampleCount: ordered.length,
    observationCount: ordered.length,
    median: available ? summary.median ?? null : null,
    mad: available ? summary.mad ?? null : null,
    min: available ? summary.min ?? null : null,
    max: available ? summary.max ?? null : null,
    coverage: available ? 1 : Math.min(ordered.length / minimum, 1),
    quality: available ? (ordered.length >= 3 ? 'HIGH' : 'MEDIUM') : 'LOW',
    available,
    sourceObservationIds: ordered.map((item) => item.id),
    sourceEventIds,
    timeRangeStart: ordered[0].observedAt,
    timeRangeEnd: ordered[ordered.length - 1].observedAt,
    notes: available ? undefined : 'The minimum sample threshold was not met.',
  };
};

export const buildPeerBaseline = ({
  actorEntityId,
  asOf,
  observations,
  featureName,
  cohort,
  entities,
  minimumSampleCount,
}: PeerBaselineBuildInput): BaselineSnapshot => {
  const minimum = validateMinimumSampleCount(minimumSampleCount, 'minimumSampleCount');
  const cutoff = numericTimestamp(asOf, 'asOf');

  validateCohortMembership({ cohort, entities });

  const peerMemberIds = cohort.memberEntityIds.filter((memberId) => memberId !== actorEntityId);

  if (peerMemberIds.length === 0) {
    return emptyBaseline({ actorEntityId, asOf, featureName, baselineType: 'PEER_COHORT', cohortId: cohort.id });
  }

  const observedMembers = new Set(normalizeBaselines(observations).map((item) => item.actorEntityId));
  const unresolved = peerMemberIds.filter((memberId) => !observedMembers.has(memberId));

  if (peerMemberIds.length > 0 && !entities && unresolved.length === peerMemberIds.length) {
    throw new BaselineConstructionError('UNRESOLVED_COHORT_MEMBER', 'cohort.memberEntityIds', `Cohort member(s) not observed in the provided history: ${unresolved.join(', ')}`);
  }

  const filtered = normalizeBaselines(observations)
    .filter((item) => item.featureName === featureName)
    .filter((item) => peerMemberIds.includes(item.actorEntityId))
    .filter((item) => numericTimestamp(item.observedAt, `observations[].observedAt:${item.id}`) < cutoff)
    .map((item) => {
      const value = isFiniteValue(item.value, `observations[${item.id}].value`);
      return { ...item, value };
    });

  if (filtered.length === 0) {
    return emptyBaseline({ actorEntityId, asOf, featureName, baselineType: 'PEER_COHORT', cohortId: cohort.id });
  }

  const peerSummaries = Array.from(
    filtered.reduce((byActor, item) => {
      const actorValues = byActor.get(item.actorEntityId) ?? [];
      actorValues.push(item);
      byActor.set(item.actorEntityId, actorValues);
      return byActor;
    }, new Map<string, typeof filtered>()),
  )
    .sort(([left], [right]) => compareOrdinalStrings(left, right))
    .map(([actorId, items]) => {
      const orderedItems = [...items].sort(sortByTimestampAndId);
      const summary = computeMedianAndMad(orderedItems.map((item) => item.value));
      const sourceEventIds = uniqueSorted(orderedItems.flatMap((item) => item.sourceEventIds ?? []));

      return {
        actorId,
        actorEntityId: actorId,
        observedAt: orderedItems[orderedItems.length - 1].observedAt,
        featureName,
        value: summary.median ?? orderedItems[0].value,
        sourceEventIds,
        sourceObservationIds: orderedItems.map((item) => item.id),
        observationCount: orderedItems.length,
        timeRangeStart: orderedItems[0].observedAt,
        timeRangeEnd: orderedItems[orderedItems.length - 1].observedAt,
      };
    });

  const ordered = [...peerSummaries].sort((left, right) => {
    const leftTime = numericTimestamp(left.observedAt, `observations[].observedAt:${left.actorId}`);
    const rightTime = numericTimestamp(right.observedAt, `observations[].observedAt:${right.actorId}`);

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return compareOrdinalStrings(left.actorId, right.actorId);
  });
  const summary = computeMedianAndMad(ordered.map((item) => item.value));
  const sourceEventIds = uniqueSorted(ordered.flatMap((item) => item.sourceEventIds));
  const sourceObservationIds = uniqueSorted(ordered.flatMap((item) => item.sourceObservationIds));
  const observationCount = ordered.reduce((total, item) => total + item.observationCount, 0);
  const available = ordered.length >= minimum;

  return {
    id: `baseline|PEER_COHORT|${actorEntityId}|${cohort.id}|${featureName}|${asOf}`,
    schemaVersion: SCHEMA_VERSION,
    actorEntityId,
    asOf,
    baselineType: 'PEER_COHORT',
    featureName,
    sampleCount: ordered.length,
    observationCount,
    median: available ? summary.median ?? null : null,
    mad: available ? summary.mad ?? null : null,
    min: available ? summary.min ?? null : null,
    max: available ? summary.max ?? null : null,
    coverage: available ? 1 : Math.min(ordered.length / minimum, 1),
    quality: available ? (ordered.length >= 3 ? 'HIGH' : 'MEDIUM') : 'LOW',
    available,
    sourceObservationIds,
    sourceEventIds,
    cohortId: cohort.id,
    timeRangeStart: ordered[0]?.observedAt,
    timeRangeEnd: ordered[ordered.length - 1]?.observedAt,
    notes: available ? undefined : 'The minimum sample threshold was not met.',
  };
};

export const buildResourceBaseline = ({
  actorEntityId,
  asOf,
  observations,
  featureName,
  resourceId,
  resources,
  minimumSampleCount,
}: ResourceBaselineBuildInput): BaselineSnapshot => {
  const minimum = validateMinimumSampleCount(minimumSampleCount, 'minimumSampleCount');
  const cutoff = numericTimestamp(asOf, 'asOf');

  if (!resources.some((resource) => resource.id === resourceId)) {
    throw new BaselineConstructionError('UNRESOLVED_RESOURCE_REFERENCE', 'resourceId', `Resource '${resourceId}' is not present in the resource set.`);
  }

  const filtered = normalizeBaselines(observations)
    .filter((item) => item.featureName === featureName)
    .filter((item) => item.resourceId === resourceId)
    .filter((item) => numericTimestamp(item.observedAt, `observations[].observedAt:${item.id}`) < cutoff)
    .map((item) => {
      const value = isFiniteValue(item.value, `observations[${item.id}].value`);
      return { ...item, value };
    });

  if (filtered.length === 0) {
    return emptyBaseline({ actorEntityId, asOf, featureName, baselineType: 'RESOURCE', resourceId });
  }

  const ordered = [...filtered].sort((left, right) => {
    const actorOrder = compareOrdinalStrings(left.actorEntityId, right.actorEntityId);
    if (actorOrder !== 0) {
      return actorOrder;
    }

    return sortByTimestampAndId(left, right);
  });
  const summary = computeMedianAndMad(ordered.map((item) => item.value));
  const sourceEventIds = uniqueSorted(ordered.flatMap((item) => item.sourceEventIds ?? []));
  const available = ordered.length >= minimum;

  return {
    id: `baseline|RESOURCE|${actorEntityId}|${resourceId}|${featureName}|${asOf}`,
    schemaVersion: SCHEMA_VERSION,
    actorEntityId,
    asOf,
    baselineType: 'RESOURCE',
    featureName,
    sampleCount: ordered.length,
    observationCount: ordered.length,
    median: available ? summary.median ?? null : null,
    mad: available ? summary.mad ?? null : null,
    min: available ? summary.min ?? null : null,
    max: available ? summary.max ?? null : null,
    coverage: available ? 1 : Math.min(ordered.length / minimum, 1),
    quality: available ? (ordered.length >= 3 ? 'HIGH' : 'MEDIUM') : 'LOW',
    available,
    sourceObservationIds: ordered.map((item) => item.id),
    sourceEventIds,
    resourceId,
    timeRangeStart: ordered[0].observedAt,
    timeRangeEnd: ordered[ordered.length - 1].observedAt,
    notes: available ? undefined : 'The minimum sample threshold was not met.',
  };
};

export const buildBaselineHierarchy = ({
  actorEntityId,
  asOf,
  personalObservations,
  peerObservations,
  resourceObservations,
  featureName,
  cohort,
  entities,
  resourceId,
  resources = [],
  minimumSampleCount,
}: BaselineHierarchyInput) => {
  const minimum = validateMinimumSampleCount(minimumSampleCount, 'minimumSampleCount');

  const personalBaseline = buildPersonalBaseline({
    actorEntityId,
    asOf,
    observations: personalObservations,
    featureName,
    minimumSampleCount: minimum,
  });

  const peerBaseline = cohort
    ? buildPeerBaseline({
        actorEntityId,
        asOf,
        observations: peerObservations,
        featureName,
        cohort,
        entities,
        minimumSampleCount: minimum,
      })
    : emptyBaseline({ actorEntityId, asOf, featureName, baselineType: 'PEER_COHORT' });

  const resourceBaseline = resourceId
    ? buildResourceBaseline({
        actorEntityId,
        asOf,
        observations: resourceObservations,
        featureName,
        resourceId,
        resources,
        minimumSampleCount: minimum,
      })
    : emptyBaseline({ actorEntityId, asOf, featureName, baselineType: 'RESOURCE', resourceId });

  const available = [personalBaseline, peerBaseline, resourceBaseline].filter((baseline) => baseline.available);
  const quality: 'LOW' | 'MEDIUM' | 'HIGH' = available.length === 0
    ? 'LOW'
    : available.length < 3
      ? 'LOW'
      : 'HIGH';

  return {
    actorEntityId,
    asOf,
    featureName,
    personalBaseline,
    peerBaseline,
    resourceBaseline,
    personalAvailable: personalBaseline.available,
    peerAvailable: peerBaseline.available,
    resourceAvailable: resourceBaseline.available,
    coverage: available.length / 3,
    quality,
  };
};
