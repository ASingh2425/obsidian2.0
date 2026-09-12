import type {
  AnalyticalProjectionMode,
  BaselineComparisonLens,
} from './presentationTypes';

export type Vector3Tuple = [x: number, y: number, z: number];

export interface SceneObservationNode {
  readonly id: string;
  readonly position: Vector3Tuple;
  readonly timestamp: string;
  readonly featureValue: number;
  readonly rawDelta: number | null;
  readonly presentationDeviation: number;
  readonly isBaselineAvailable: boolean;
  readonly isZeroMadFallback: boolean;
  readonly contributingEventIds: readonly string[];
  readonly resourceIds: readonly string[];
  readonly deviceIds: readonly string[];
}

export interface SceneTrajectoryPath {
  readonly points: readonly Vector3Tuple[];
  readonly observationIds: readonly string[];
}

export interface SceneBaselineCorridor {
  readonly available: boolean;
  readonly medianY: number;
  readonly madUpperY: number;
  readonly madLowerY: number;
  readonly xStart: number;
  readonly xEnd: number;
  readonly z: number;
  readonly rawMedian: number | null;
  readonly rawMad: number | null;
  readonly sampleCount: number;
  readonly quality: string;
}

export interface SceneResourceNode {
  readonly id: string;
  readonly position: Vector3Tuple;
  readonly displayName: string;
  readonly category: string;
  readonly resourceType: string;
  readonly relatedObservationIds: readonly string[];
}

export interface SceneDeviceNode {
  readonly id: string;
  readonly position: Vector3Tuple;
  readonly displayName: string;
  readonly relatedObservationIds: readonly string[];
}

export interface SceneEvidenceConnection {
  readonly id: string;
  readonly sourcePosition: Vector3Tuple;
  readonly targetPosition: Vector3Tuple;
  readonly sourceId: string;
  readonly targetId: string;
  readonly connectionType: 'OBSERVATION_TO_RESOURCE' | 'OBSERVATION_TO_DEVICE';
  readonly timestamp: string;
}

export interface SceneContextEnvelope {
  readonly id: string;
  readonly grantId: string;
  readonly xStart: number;
  readonly xEnd: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly zCenter: number;
  readonly zDepth: number;
  readonly resourceScope: readonly string[];
  readonly actionScope: readonly string[];
  readonly rationale: string;
}

export interface ShiftGraphSceneModel {
  readonly projection: AnalyticalProjectionMode;
  readonly lens: BaselineComparisonLens;
  readonly temporalRange: {
    readonly start: string;
    readonly end: string;
    readonly cursorTime: string;
  };
  readonly trajectory: SceneTrajectoryPath;
  readonly observations: readonly SceneObservationNode[];
  readonly baseline: SceneBaselineCorridor;
  readonly resources: readonly SceneResourceNode[];
  readonly devices: readonly SceneDeviceNode[];
  readonly connections: readonly SceneEvidenceConnection[];
  readonly contexts: readonly SceneContextEnvelope[];
}
