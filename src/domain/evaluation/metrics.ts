/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { NumericConstraint } from './types';

/**
 * Pure, deterministic evaluation of a declarative numeric constraint.
 */
export function evaluateNumericConstraint(
  actual: number,
  constraint: NumericConstraint,
): { passed: boolean; message?: string } {
  const { operator, value, secondaryValue } = constraint;

  switch (operator) {
    case 'EQUALS': {
      // Use floating-point epsilon comparison
      const passed = Math.abs(actual - value) < 1e-5;
      return {
        passed,
        message: passed ? undefined : `Expected ${actual} to equal ${value}`,
      };
    }
    case 'GREATER_THAN': {
      const passed = actual > value;
      return {
        passed,
        message: passed ? undefined : `Expected ${actual} to be > ${value}`,
      };
    }
    case 'GREATER_THAN_OR_EQUAL': {
      const passed = actual >= value - 1e-5;
      return {
        passed,
        message: passed ? undefined : `Expected ${actual} to be >= ${value}`,
      };
    }
    case 'LESS_THAN': {
      const passed = actual < value;
      return {
        passed,
        message: passed ? undefined : `Expected ${actual} to be < ${value}`,
      };
    }
    case 'LESS_THAN_OR_EQUAL': {
      const passed = actual <= value + 1e-5;
      return {
        passed,
        message: passed ? undefined : `Expected ${actual} to be <= ${value}`,
      };
    }
    case 'BETWEEN_EXCLUSIVE': {
      if (secondaryValue === undefined) {
        return { passed: false, message: 'BETWEEN_EXCLUSIVE requires secondaryValue' };
      }
      const passed = actual > value && actual < secondaryValue;
      return {
        passed,
        message: passed ? undefined : `Expected ${actual} to be between (${value}, ${secondaryValue})`,
      };
    }
    case 'BETWEEN_INCLUSIVE': {
      if (secondaryValue === undefined) {
        return { passed: false, message: 'BETWEEN_INCLUSIVE requires secondaryValue' };
      }
      const passed = actual >= value - 1e-5 && actual <= secondaryValue + 1e-5;
      return {
        passed,
        message: passed ? undefined : `Expected ${actual} to be between [${value}, ${secondaryValue}]`,
      };
    }
    default:
      return { passed: false, message: `Unknown operator ${(operator as string)}` };
  }
}

/**
 * Calculates a guarded ratio.
 * When denominator is 0, returns null (rendered as "N/A"), never 1.0 or 100%.
 */
export function calculateRatio(numerator: number, denominator: number): number | null {
  if (denominator <= 0 || !Number.isFinite(denominator)) {
    return null;
  }
  return numerator / denominator;
}

/**
 * Format a ratio for display or report serialization.
 */
export function formatRatio(ratio: number | null): string {
  if (ratio === null) {
    return 'N/A';
  }
  return `${(ratio * 100).toFixed(1)}%`;
}
