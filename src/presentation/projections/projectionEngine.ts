import type {
  AnalyticalProjectionMode,
  BaselineVisualModel,
  ContextEnvelopeViewModel,
  RelatedEntityViewModel,
  TrajectoryPointViewModel,
} from '../types/presentationTypes';
import type {
  SceneBaselineCorridor,
  SceneContextEnvelope,
  SceneDeviceNode,
  SceneEvidenceConnection,
  SceneObservationNode,
  SceneResourceNode,
  Vector3Tuple,
} from '../types/sceneTypes';
import { calculateDeviationForValue, Y_SCALE } from '../adapters/baselineAdapter';

export const SCENE_WIDTH = 24.0;

// Deterministic Z Lane constants for BEHAVIOR projection
export const Z_LANES_BEHAVIOR = {
  DEVICE: -2.8,
  TRAJECTORY: 0.0,
  RESOURCES: 2.8,
  CONTEXT_CENTER: 0.0,
  CONTEXT_DEPTH: 2.2,
};

// Deterministic Z Lane constants for RESOURCE projection
export const Z_LANES_RESOURCE = {
  RESOURCE_0: -3.6,
  TRAJECTORY: 0.0,
  RESOURCE_1: 3.6,
  DEVICE: 6.0,
  CONTEXT_CENTER: -1.8,
  CONTEXT_DEPTH: 4.0,
};

/**
 * Maps an ISO-8601 timestamp monotonically onto the scene X axis.
 * Past is at negative X (left), Present / latest boundary is at positive X (right).
 */
export const temporalToSceneX = (
  timestamp: string,
  tStart: string,
  tEnd: string,
): number => {
  const msCurrent = Date.parse(timestamp);
  const msStart = Date.parse(tStart);
  const msEnd = Date.parse(tEnd);

  if (msEnd <= msStart) {
    return 0;
  }

  const normalized = Math.max(0, Math.min(1, (msCurrent - msStart) / (msEnd - msStart)));
  return (normalized - 0.5) * SCENE_WIDTH;
};

/**
 * Projects observation view models into 3D scene nodes according to the analytical projection mode.
 */
export const projectObservationNodes = (
  points: readonly TrajectoryPointViewModel[],
  baseline: BaselineVisualModel,
  projection: AnalyticalProjectionMode,
  tStart: string,
  tEnd: string,
): readonly SceneObservationNode[] => {
  const zTrajectory =
    projection === 'BEHAVIOR'
      ? Z_LANES_BEHAVIOR.TRAJECTORY
      : Z_LANES_RESOURCE.TRAJECTORY;

  return points.map((pt) => {
    const x = temporalToSceneX(pt.timestamp, tStart, tEnd);
    const dev = calculateDeviationForValue(pt.featureValue, baseline);
    const position: Vector3Tuple = [x, dev.visualY, zTrajectory];

    return {
      id: pt.observationId,
      position,
      timestamp: pt.timestamp,
      featureValue: pt.featureValue,
      rawDelta: dev.rawDelta,
      presentationDeviation: dev.presentationDeviation,
      isBaselineAvailable: dev.isBaselineAvailable,
      isZeroMadFallback: dev.isZeroMadFallback,
      contributingEventIds: pt.eventIds,
      resourceIds: pt.resourceIds,
      deviceIds: pt.deviceEntityIds,
    };
  });
};

/**
 * Projects baseline corridor reference geometry.
 */
export const projectBaselineCorridor = (
  baseline: BaselineVisualModel,
  projection: AnalyticalProjectionMode,
  tStart: string,
  tEnd: string,
): SceneBaselineCorridor => {
  const xStart = temporalToSceneX(tStart, tStart, tEnd);
  const xEnd = temporalToSceneX(tEnd, tStart, tEnd);
  const z =
    projection === 'BEHAVIOR'
      ? Z_LANES_BEHAVIOR.TRAJECTORY
      : Z_LANES_RESOURCE.TRAJECTORY;

  if (!baseline.available || baseline.median === null) {
    return {
      available: false,
      medianY: 0,
      madUpperY: 0,
      madLowerY: 0,
      xStart,
      xEnd,
      z,
      rawMedian: null,
      rawMad: null,
      sampleCount: baseline.sampleCount,
      quality: baseline.quality,
    };
  }

  // +1 MAD corridor band in compressed visual space
  const madSpan = Math.log1p(1.0) * Y_SCALE;

  return {
    available: true,
    medianY: 0,
    madUpperY: madSpan,
    madLowerY: -madSpan,
    xStart,
    xEnd,
    z,
    rawMedian: baseline.median,
    rawMad: baseline.mad,
    sampleCount: baseline.sampleCount,
    quality: baseline.quality,
  };
};

/**
 * Projects resource nodes into their deterministic Z lanes.
 */
export const projectResourceNodes = (
  resources: readonly RelatedEntityViewModel[],
  projection: AnalyticalProjectionMode,
  tStart: string,
  tEnd: string,
  observations: readonly SceneObservationNode[],
): readonly SceneResourceNode[] => {
  return resources.map((res, index) => {
    // In BEHAVIOR projection: resources share a common analytical lane
    // In RESOURCE projection: resources are placed in dedicated parallel lanes for multi-target comparison
    const z =
      projection === 'BEHAVIOR'
        ? Z_LANES_BEHAVIOR.RESOURCES
        : index === 0
          ? Z_LANES_RESOURCE.RESOURCE_0
          : Z_LANES_RESOURCE.RESOURCE_1;

    // Anchor X near the midpoint of its observation span
    const matchingObs = observations.filter((obs) => obs.resourceIds.includes(res.id));
    const avgX =
      matchingObs.length > 0
        ? matchingObs.reduce((acc, obs) => acc + obs.position[0], 0) / matchingObs.length
        : temporalToSceneX(res.firstObservedAt, tStart, tEnd);

    const position: Vector3Tuple = [avgX, 0.0, z];

    return {
      id: res.id,
      position,
      displayName: res.displayName,
      category: res.category,
      resourceType: res.category,
      relatedObservationIds: matchingObs.map((obs) => obs.id),
    };
  });
};

/**
 * Projects device nodes into their deterministic Z lane.
 */
export const projectDeviceNodes = (
  devices: readonly RelatedEntityViewModel[],
  projection: AnalyticalProjectionMode,
  tStart: string,
  tEnd: string,
  observations: readonly SceneObservationNode[],
): readonly SceneDeviceNode[] => {
  const z =
    projection === 'BEHAVIOR'
      ? Z_LANES_BEHAVIOR.DEVICE
      : Z_LANES_RESOURCE.DEVICE;

  return devices.map((dev) => {
    const matchingObs = observations.filter((obs) => obs.deviceIds.includes(dev.id));
    const avgX =
      matchingObs.length > 0
        ? matchingObs.reduce((acc, obs) => acc + obs.position[0], 0) / matchingObs.length
        : temporalToSceneX(dev.firstObservedAt, tStart, tEnd);

    const position: Vector3Tuple = [avgX, 0.0, z];

    return {
      id: dev.id,
      position,
      displayName: dev.displayName,
      relatedObservationIds: matchingObs.map((obs) => obs.id),
    };
  });
};

/**
 * Assembles evidence connections linking observations to their contributing resources and devices.
 */
export const projectEvidenceConnections = (
  observations: readonly SceneObservationNode[],
  resources: readonly SceneResourceNode[],
  devices: readonly SceneDeviceNode[],
): readonly SceneEvidenceConnection[] => {
  const connections: SceneEvidenceConnection[] = [];

  for (const obs of observations) {
    for (const resId of obs.resourceIds) {
      const res = resources.find((r) => r.id === resId);
      if (res) {
        connections.push({
          id: `conn-${obs.id}-${res.id}`,
          sourcePosition: obs.position,
          targetPosition: res.position,
          sourceId: obs.id,
          targetId: res.id,
          connectionType: 'OBSERVATION_TO_RESOURCE',
          timestamp: obs.timestamp,
        });
      }
    }

    for (const devId of obs.deviceIds) {
      const dev = devices.find((d) => d.id === devId);
      if (dev) {
        connections.push({
          id: `conn-${obs.id}-${dev.id}`,
          sourcePosition: obs.position,
          targetPosition: dev.position,
          sourceId: obs.id,
          targetId: dev.id,
          connectionType: 'OBSERVATION_TO_DEVICE',
          timestamp: obs.timestamp,
        });
      }
    }
  }

  return connections;
};

/**
 * Projects context grants as bounded envelopes.
 */
export const projectContextEnvelopes = (
  grants: readonly ContextEnvelopeViewModel[],
  projection: AnalyticalProjectionMode,
  tStart: string,
  tEnd: string,
): readonly SceneContextEnvelope[] => {
  const zCenter =
    projection === 'BEHAVIOR'
      ? Z_LANES_BEHAVIOR.CONTEXT_CENTER
      : Z_LANES_RESOURCE.CONTEXT_CENTER;
  const zDepth =
    projection === 'BEHAVIOR'
      ? Z_LANES_BEHAVIOR.CONTEXT_DEPTH
      : Z_LANES_RESOURCE.CONTEXT_DEPTH;

  return grants.map((grant) => {
    const xStart = temporalToSceneX(grant.validFrom, tStart, tEnd);
    const xEnd = temporalToSceneX(grant.validTo, tStart, tEnd);

    return {
      id: `envelope-${grant.grantId}`,
      grantId: grant.grantId,
      xStart,
      xEnd,
      yMin: -1.2,
      yMax: 3.5,
      zCenter,
      zDepth,
      resourceScope: grant.resourceScope,
      actionScope: grant.actionScope,
      rationale: grant.rationale,
    };
  });
};
