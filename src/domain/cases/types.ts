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
  AuditEvent,
  InvestigationCase,
  RiskAssessment,
  ShiftSequence,
} from '../types';

export type DerivedCaseStatus =
  | 'NEW'
  | 'PENDING_REVIEW'
  | 'CONTEXT_REQUESTED'
  | 'ESCALATED'
  | 'CLOSED_NO_ACTION'
  | 'CLOSED'
  | 'REOPENED';

export interface CreateCaseParams {
  readonly sequence: ShiftSequence;
  readonly riskAssessment: RiskAssessment;
  readonly evaluationTime: string; // knowledge-time for createdAt
  readonly actionId: string;       // caller-supplied action ID for audit idempotency
}

export interface UpdateCaseParams {
  readonly existingCase: InvestigationCase;
  readonly sequence: ShiftSequence;
  readonly updatedRiskAssessment: RiskAssessment;
  readonly evaluationTime: string; // knowledge-time of update
  readonly actionId: string;       // caller-supplied action ID
}

export interface RecordDecisionParams {
  readonly caseId: string;
  readonly actorEntityId: string; // pseudonymous analyst ID
  readonly decision: AnalystDecision['decision'];
  readonly rationale: string;
  readonly evidenceIds: readonly string[];
  readonly timestamp: string;     // knowledge-time of decision
  readonly actionId: string;      // caller-supplied action ID
}

export interface ProposeContextCorrectionParams {
  readonly caseId: string;
  readonly actorEntityId: string; // pseudonymous analyst ID
  readonly proposedGrantDescription: string;
  readonly evidenceIds: readonly string[];
  readonly timestamp: string;
  readonly actionId: string;
}

export interface ReopenCaseParams {
  readonly caseId: string;
  readonly actorEntityId: string; // pseudonymous analyst ID
  readonly rationale: string;
  readonly timestamp: string;
  readonly actionId: string;
}

export interface RankedCase {
  readonly investigationCase: InvestigationCase;
  readonly riskAssessment: RiskAssessment;
  readonly derivedStatus: DerivedCaseStatus;
  readonly rank: number; // 1-based rank
}
