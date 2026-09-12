import type {
  ContextEnvelopeViewModel,
  RelatedEntityViewModel,
} from '../types/presentationTypes';
import {
  PROTOTYPE_CONTEXT_GRANT,
  PROTOTYPE_DEVICE,
  PROTOTYPE_RESOURCES,
  RAW_OBSERVATION_SEEDS,
} from '../data/prototypeData';

/**
 * Assembles context grants, filtering out grants that start strictly in the future relative to cursorTime.
 */
export const assembleContextViewModels = (
  cursorTime?: string,
): readonly ContextEnvelopeViewModel[] => {
  if (cursorTime && PROTOTYPE_CONTEXT_GRANT.validFrom > cursorTime) {
    return [];
  }
  return [PROTOTYPE_CONTEXT_GRANT];
};

/**
 * Assembles related resources with observed temporal boundaries.
 */
export const assembleResourceViewModels = (
  cursorTime?: string,
): readonly RelatedEntityViewModel[] => {
  const visibleObservations = RAW_OBSERVATION_SEEDS.filter(
    (obs) => !cursorTime || obs.timestamp <= cursorTime,
  );

  return PROTOTYPE_RESOURCES.map((res) => {
    const matchingObs = visibleObservations.filter((obs) =>
      obs.resourceIds.includes(res.id),
    );
    const relatedEventIds = matchingObs.flatMap((obs) => obs.eventIds);
    const firstObservedAt = matchingObs[0]?.timestamp ?? '2024-04-01T08:00:00Z';
    const lastObservedAt =
      matchingObs[matchingObs.length - 1]?.timestamp ?? firstObservedAt;

    return {
      id: res.id,
      entityType: 'RESOURCE',
      displayName: res.resourceName,
      category: res.resourceType,
      firstObservedAt,
      lastObservedAt,
      relatedEventIds,
    };
  });
};

/**
 * Assembles related device view model.
 */
export const assembleDeviceViewModels = (
  cursorTime?: string,
): readonly RelatedEntityViewModel[] => {
  const visibleObservations = RAW_OBSERVATION_SEEDS.filter(
    (obs) => !cursorTime || obs.timestamp <= cursorTime,
  );
  const matchingObs = visibleObservations.filter((obs) =>
    obs.deviceIds.includes(PROTOTYPE_DEVICE.id),
  );
  const relatedEventIds = matchingObs.flatMap((obs) => obs.eventIds);

  return [
    {
      id: PROTOTYPE_DEVICE.id,
      entityType: 'DEVICE',
      displayName: PROTOTYPE_DEVICE.displayName,
      category: 'WORKSTATION',
      firstObservedAt: matchingObs[0]?.timestamp ?? '2024-04-01T08:00:00Z',
      lastObservedAt:
        matchingObs[matchingObs.length - 1]?.timestamp ?? '2024-04-01T08:00:00Z',
      relatedEventIds,
    },
  ];
};
