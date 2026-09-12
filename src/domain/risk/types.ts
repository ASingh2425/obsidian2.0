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

import type {
  ChangePoint,
  ContextOutcome,
  DataQuality,
  RiskAssessment,
  SecurityEvent,
  ShiftSequence,
} from '../types';
import type { ContextReconciliationResult } from '../context';

export interface ComposeRiskAssessmentParams {
  readonly sequence: ShiftSequence;
  readonly reconciliation: ContextReconciliationResult;
  readonly changePoints: readonly ChangePoint[];
  readonly sourceEvents: readonly SecurityEvent[];
  readonly evaluationTime?: string;
}

export interface DeterministicExplanation {
  readonly riskAssessmentId: string;
  readonly sequenceId: string;
  readonly summary: string;
  readonly behavioralFindings: readonly string[];
  readonly contextFindings: string;
  readonly residualRiskFindings: string;
  readonly dataQualityFindings: string;
  readonly sourceEvidenceIds: readonly string[];
  readonly coveredEvidenceIds: readonly string[];
  readonly uncoveredEvidenceIds: readonly string[];
  readonly narrativeEvidenceIds: readonly string[];
}
