import type {
  BaselineSnapshot,
  ContextGrant,
  Entity,
  FeatureObservation,
  Resource,
  SecurityEvent,
} from '../../domain/types';

export type BaselineComparisonLens = 'PERSONAL' | 'PEER' | 'RESOURCE';
export type AnalyticalProjectionMode = 'BEHAVIOR' | 'RESOURCE';

/**
 * View model for a baseline snapshot prepared for visual rendering.
 */
export interface BaselineVisualModel {
  readonly id: string;
  readonly lens: BaselineComparisonLens;
  readonly featureName: string;
  readonly available: boolean;
  readonly median: number | null;
  readonly mad: number | null;
  readonly min: number | null;
  readonly max: number | null;
  readonly sampleCount: number;
  readonly observationCount: number;
  readonly quality: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  readonly notes: string;
}

/**
 * View model for a single temporal observation on the trajectory.
 */
export interface TrajectoryPointViewModel {
  readonly observationId: string;
  readonly actorEntityId: string;
  readonly featureName: string;
  readonly featureValue: number;
  readonly timestamp: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly eventIds: readonly string[];
  readonly resourceIds: readonly string[];
  readonly deviceEntityIds: readonly string[];

  // Baseline comparison metrics computed for the active lens
  readonly baselineLens: BaselineComparisonLens;
  readonly baselineAvailable: boolean;
  readonly baselineMedian: number | null;
  readonly baselineMad: number | null;
  readonly rawDelta: number | null;
  readonly presentationDeviation: number;
  readonly isZeroMadFallback: boolean;
  readonly isOutlier: boolean;
}

/**
 * View model for organizational context envelope.
 */
export interface ContextEnvelopeViewModel {
  readonly grantId: string;
  readonly actorEntityId: string;
  readonly validFrom: string;
  readonly validTo: string;
  readonly resourceScope: readonly string[];
  readonly actionScope: readonly string[];
  readonly expectedVolume?: number;
  readonly rationale: string;
}

/**
 * View model for related entities (resources and devices).
 */
export interface RelatedEntityViewModel {
  readonly id: string;
  readonly entityType: 'RESOURCE' | 'DEVICE';
  readonly displayName: string;
  readonly category: string;
  readonly firstObservedAt: string;
  readonly lastObservedAt: string;
  readonly relatedEventIds: readonly string[];
}

/**
 * Complete presentation model assembled before projection.
 */
export interface ShiftGraphPresentationModel {
  readonly actor: Entity;
  readonly featureName: string;
  readonly temporalWindow: {
    readonly start: string;
    readonly end: string;
  };
  readonly trajectoryPoints: readonly TrajectoryPointViewModel[];
  readonly baselines: Record<BaselineComparisonLens, BaselineVisualModel>;
  readonly activeLens: BaselineComparisonLens;
  readonly contextGrants: readonly ContextEnvelopeViewModel[];
  readonly relatedResources: readonly RelatedEntityViewModel[];
  readonly relatedDevices: readonly RelatedEntityViewModel[];
  readonly securityEvents: readonly SecurityEvent[];
}
