import type { BaselineSnapshot } from '../../domain/types';
import type {
  BaselineComparisonLens,
  BaselineVisualModel,
} from '../types/presentationTypes';

export const Y_SCALE = 1.6;
export const EPSILON = 1e-6;

export interface DeviationCalculationResult {
  readonly rawDelta: number | null;
  readonly presentationDeviation: number;
  readonly visualY: number;
  readonly isZeroMadFallback: boolean;
  readonly isBaselineAvailable: boolean;
}

/**
 * Calculates baseline-relative deviation and visual Y coordinate
 * adhering strictly to the non-negotiable visual semantics:
 * - Robust deviation: D = abs(value - median) / max(MAD, epsilon)
 * - Zero-MAD fallback: explicit bounded displacement when MAD = 0
 * - Monotonic Y compression: visualY = sign(delta) * log1p(D) * Y_SCALE
 */
export const calculateDeviationForValue = (
  value: number,
  baseline: BaselineVisualModel,
): DeviationCalculationResult => {
  if (!baseline.available || baseline.median === null) {
    return {
      rawDelta: null,
      presentationDeviation: 0,
      visualY: 0,
      isZeroMadFallback: false,
      isBaselineAvailable: false,
    };
  }

  const delta = value - baseline.median;

  if (delta === 0) {
    return {
      rawDelta: 0,
      presentationDeviation: 0,
      visualY: 0,
      isZeroMadFallback: false,
      isBaselineAvailable: true,
    };
  }

  const sign = Math.sign(delta);
  const absDelta = Math.abs(delta);
  const mad = baseline.mad ?? 0;

  // Zero-MAD handling policy:
  // If MAD > 0: standard robust MAD-normalized distance
  // If MAD == 0: use bounded fallback based on available range, or bounded step of 1.0
  if (mad > 0) {
    const d = absDelta / Math.max(mad, EPSILON);
    const visualY = sign * Math.log1p(d) * Y_SCALE;
    return {
      rawDelta: delta,
      presentationDeviation: d,
      visualY,
      isZeroMadFallback: false,
      isBaselineAvailable: true,
    };
  }

  // MAD === 0 fallback
  const range = (baseline.max ?? 0) - (baseline.min ?? 0);
  const fallbackD = range > 0 ? absDelta / range : Math.min(absDelta, 4.0);
  const visualY = sign * Math.log1p(fallbackD) * Y_SCALE;

  return {
    rawDelta: delta,
    presentationDeviation: fallbackD,
    visualY,
    isZeroMadFallback: true,
    isBaselineAvailable: true,
  };
};

/**
 * Adapts a domain BaselineSnapshot into a BaselineVisualModel
 */
export const adaptDomainBaseline = (
  snapshot: BaselineSnapshot,
  lens: BaselineComparisonLens,
): BaselineVisualModel => {
  return {
    id: snapshot.id,
    lens,
    featureName: snapshot.featureName,
    available: snapshot.available,
    median: snapshot.median,
    mad: snapshot.mad,
    min: snapshot.min,
    max: snapshot.max,
    sampleCount: snapshot.sampleCount,
    observationCount: snapshot.observationCount,
    quality: snapshot.quality,
    notes: snapshot.notes ?? '',
  };
};
