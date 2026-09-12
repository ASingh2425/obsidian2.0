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
  RiskAssessment,
  ShiftSequence,
} from '../types';
import type {
  ChangePointContextMatch,
  ContextReconciliationResult,
} from '../context';
import type { DeterministicExplanation } from './types';

export interface GenerateExplanationParams {
  readonly riskAssessment: RiskAssessment;
  readonly sequence: ShiftSequence;
  readonly reconciliation: ContextReconciliationResult;
  readonly changePoints: readonly ChangePoint[];
}

/**
 * Generates a repeatable, deterministic, evidence-linked explanation
 * strictly from structured domain artifacts, without using an LLM.
 *
 * Strictly adheres to non-evaluative reporting:
 * Banned words: malicious, benign, safe, innocent, guilty, suspicious, rogue, attack, critical, high risk.
 */
export const generateDeterministicExplanation = (
  params: GenerateExplanationParams,
): DeterministicExplanation => {
  const { riskAssessment, sequence, reconciliation, changePoints } = params;

  // 1. Behavioral findings
  const cpMap = new Map(changePoints.map((cp) => [cp.id, cp]));
  const behavioralFindings: string[] = [];

  for (const cpId of riskAssessment.relatedChangePointIds) {
    const cp = cpMap.get(cpId);
    if (cp) {
      behavioralFindings.push(
        `Observed transition on feature '${cp.featureName}' at ${cp.observedAt} with robust deviation score ${cp.rawDeviationScore.toFixed(2)} (change point ID: ${cp.id}).`,
      );
    }
  }

  // 2. Context findings
  let contextFindings: string;
  const matchedGrantsStr = reconciliation.matchedGrantIds.length > 0
    ? reconciliation.matchedGrantIds.join(', ')
    : 'none';

  if (riskAssessment.contextOutcome === 'EXPLAINED') {
    contextFindings = `All constituent change points are covered by valid organizational context (matching grant IDs: ${matchedGrantsStr}). Context coverage ratio is ${riskAssessment.contextCoverage.toFixed(2)}.`;
  } else if (riskAssessment.contextOutcome === 'PARTIALLY_EXPLAINED') {
    contextFindings = `Constituent change points are partially covered by valid organizational context (matching grant IDs: ${matchedGrantsStr}). Context coverage ratio is ${riskAssessment.contextCoverage.toFixed(2)}.`;
  } else if (riskAssessment.contextOutcome === 'UNEXPLAINED') {
    contextFindings = `No matching organizational context records were identified for this activity sequence. Context coverage ratio is 0.00.`;
  } else {
    contextFindings = `Context reconciliation is indeterminate due to missing evidence or incomplete grant scope. Context coverage ratio is ${riskAssessment.contextCoverage.toFixed(2)}.`;
  }

  // 3. Residual risk findings
  let residualRiskFindings: string;
  if (riskAssessment.residualRisk === 0.0 && riskAssessment.contextOutcome === 'EXPLAINED') {
    residualRiskFindings = `Residual risk is 0.00. All observed behavioral deviation is accounted for by valid organizational context; no unexplained material evidence remains.`;
  } else {
    const uncoveredCpCount = riskAssessment.relatedChangePointIds.length - reconciliation.changePointMatches.filter((m) => m.matched).length;
    residualRiskFindings = `Residual risk is ${riskAssessment.residualRisk.toFixed(4)} (raw deviation: ${riskAssessment.rawDeviation.toFixed(4)}). ${uncoveredCpCount} of ${riskAssessment.relatedChangePointIds.length} constituent change points remain unexplained or unverified.`;
  }

  // 4. Data quality findings
  let dataQualityFindings: string;
  if (riskAssessment.dataQuality.level === 'HIGH') {
    dataQualityFindings = `Data quality is HIGH (confidence: ${riskAssessment.confidence.toFixed(2)}). All required source events resolved and all context evaluations are complete.`;
  } else if (riskAssessment.dataQuality.level === 'MEDIUM') {
    dataQualityFindings = `Data quality is MEDIUM (confidence: ${riskAssessment.confidence.toFixed(2)}). Minor telemetry gaps noted.`;
  } else {
    const missingStr = riskAssessment.dataQuality.missingFields.length > 0
      ? riskAssessment.dataQuality.missingFields.join(', ')
      : 'incomplete context scope';
    dataQualityFindings = `Data quality is LOW (confidence: ${riskAssessment.confidence.toFixed(2)}). Missing or incomplete telemetry: ${missingStr}. Incomplete context evaluations: ${riskAssessment.dataQuality.incompleteContextCount}.`;
  }

  // 5. Executive summary
  const summary = `Deterministic risk assessment for sequence ${sequence.id} (actor: ${sequence.actorEntityId}). Context status: ${riskAssessment.contextOutcome}. Raw deviation magnitude: ${riskAssessment.rawDeviation.toFixed(4)}, context coverage: ${riskAssessment.contextCoverage.toFixed(2)}, residual risk: ${riskAssessment.residualRisk.toFixed(4)}.`;

  return {
    riskAssessmentId: riskAssessment.id,
    sequenceId: sequence.id,
    summary,
    behavioralFindings,
    contextFindings,
    residualRiskFindings,
    dataQualityFindings,
    sourceEvidenceIds: riskAssessment.sourceEvidenceIds,
    coveredEvidenceIds: riskAssessment.coveredEvidenceIds,
    uncoveredEvidenceIds: riskAssessment.uncoveredEvidenceIds,
    narrativeEvidenceIds: riskAssessment.narrativeEvidenceIds,
  };
};
