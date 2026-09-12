import type {
  AnalyticalProjectionMode,
  BaselineComparisonLens,
  ShiftGraphPresentationModel,
} from '../types/presentationTypes';
import type { ShiftGraphSceneModel } from '../types/sceneTypes';
import {
  projectBaselineCorridor,
  projectContextEnvelopes,
  projectDeviceNodes,
  projectEvidenceConnections,
  projectObservationNodes,
  projectResourceNodes,
} from '../projections/projectionEngine';

export interface BuildSceneOptions {
  readonly model: ShiftGraphPresentationModel;
  readonly projection: AnalyticalProjectionMode;
  readonly lens: BaselineComparisonLens;
  readonly cursorTime?: string;
}

/**
 * Builds the deterministic Shift Graph scene model from presentation data.
 * Pure function: identical inputs guarantee identical outputs.
 * Strictly enforces temporal boundary: observations with timestamp > cursorTime are excluded.
 */
export const buildShiftGraphScene = (
  options: BuildSceneOptions,
): ShiftGraphSceneModel => {
  const { model, projection, lens, cursorTime } = options;
  const { start, end } = model.temporalWindow;
  const effectiveCursor = cursorTime ?? end;

  const baseline = model.baselines[lens];

  // Strictly filter observations to those at or before cursorTime (no future leakage)
  const filteredPoints = model.trajectoryPoints.filter(
    (pt) => pt.timestamp <= effectiveCursor,
  );

  const observations = projectObservationNodes(
    filteredPoints,
    baseline,
    projection,
    start,
    end,
  );

  const trajectory = {
    points: observations.map((obs) => obs.position),
    observationIds: observations.map((obs) => obs.id),
  };

  const baselineCorridor = projectBaselineCorridor(
    baseline,
    projection,
    start,
    end,
  );

  const resources = projectResourceNodes(
    model.relatedResources,
    projection,
    start,
    end,
    observations,
  );

  const devices = projectDeviceNodes(
    model.relatedDevices,
    projection,
    start,
    end,
    observations,
  );

  const connections = projectEvidenceConnections(
    observations,
    resources,
    devices,
  );

  const contexts = projectContextEnvelopes(
    model.contextGrants,
    projection,
    start,
    end,
  );

  return {
    projection,
    lens,
    temporalRange: {
      start,
      end,
      cursorTime: effectiveCursor,
    },
    trajectory,
    observations,
    baseline: baselineCorridor,
    resources,
    devices,
    connections,
    contexts,
  };
};
