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
  AnalystDecision,
  InvestigationCase,
  RiskAssessment,
} from '../types';
import { deriveCaseStatus } from './caseManager';
import type { RankedCase } from './types';

export interface CaseRankingCandidate {
  readonly investigationCase: InvestigationCase;
  readonly riskAssessment: RiskAssessment;
  readonly decisions: readonly AnalystDecision[];
}

/**
 * Deterministically ranks investigation cases based on approved 4-element orthogonal tuple:
 * 1. residualRisk descending (unexplained behavioral magnitude)
 * 2. confidence descending (evidence strength when risk is equal)
 * 3. case.createdAt descending (newer activity first when risk & confidence tie)
 * 4. case.id ascending (stable deterministic string tie-break)
 *
 * Strict invariants:
 * - No contextOutcome priority tier
 * - No weights, multipliers, or severity bands
 * - Fully shuffle-invariant and caller-immutable
 */
export const rankInvestigationCases = (
  candidates: readonly CaseRankingCandidate[],
): RankedCase[] => {
  const sorted = [...candidates].sort((a, b) => {
    // 1. residualRisk descending
    const riskDiff = b.riskAssessment.residualRisk - a.riskAssessment.residualRisk;
    if (Math.abs(riskDiff) > 1e-6) {
      return riskDiff;
    }

    // 2. confidence descending
    const confDiff = b.riskAssessment.confidence - a.riskAssessment.confidence;
    if (Math.abs(confDiff) > 1e-6) {
      return confDiff;
    }

    // 3. case.createdAt descending
    const timeDiff = Date.parse(b.investigationCase.createdAt) - Date.parse(a.investigationCase.createdAt);
    if (timeDiff !== 0) {
      return timeDiff;
    }

    // 4. case.id ascending (stable tie-break)
    return a.investigationCase.id.localeCompare(b.investigationCase.id);
  });

  return sorted.map((item, index) => ({
    investigationCase: item.investigationCase,
    riskAssessment: item.riskAssessment,
    derivedStatus: deriveCaseStatus(item.decisions),
    rank: index + 1,
  }));
};
