import { calculateDeviationForValue } from './baselineAdapter';
import type {
  BaselineComparisonLens,
  BaselineVisualModel,
  TrajectoryPointViewModel,
} from '../types/presentationTypes';
import { RAW_OBSERVATION_SEEDS } from '../data/prototypeData';

export interface AssembleTrajectoryOptions {
  readonly actorEntityId: string;
  readonly featureName: string;
  readonly baseline: BaselineVisualModel;
  readonly lens: BaselineComparisonLens;
  readonly timeCursor?: string;
}

/**
 * Assembles trajectory points with calculated deviation metrics against the active baseline lens.
 * Strictly enforces temporal knowledge boundary: excludes observations with timestamp > timeCursor.
 */
export const assembleTrajectoryViewModels = (
  options: AssembleTrajectoryOptions,
): readonly TrajectoryPointViewModel[] => {
  const { actorEntityId, featureName, baseline, lens, timeCursor } = options;

  return RAW_OBSERVATION_SEEDS
    .filter((obs) => !timeCursor || obs.timestamp <= timeCursor)
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0))
    .map((obs) => {
      const dev = calculateDeviationForValue(obs.value, baseline);

      return {
        observationId: obs.id,
        actorEntityId,
        featureName,
        featureValue: obs.value,
        timestamp: obs.timestamp,
        windowStart: obs.windowStart,
        windowEnd: obs.windowEnd,
        eventIds: obs.eventIds,
        resourceIds: obs.resourceIds,
        deviceEntityIds: obs.deviceIds,

        baselineLens: lens,
        baselineAvailable: dev.isBaselineAvailable,
        baselineMedian: baseline.median,
        baselineMad: baseline.mad,
        rawDelta: dev.rawDelta,
        presentationDeviation: dev.presentationDeviation,
        isZeroMadFallback: dev.isZeroMadFallback,
        isOutlier: dev.presentationDeviation > 3.0,
      };
    });
};
