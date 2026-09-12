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
  AuditEvent,
  ContextOutcome,
  IdRecord,
  InvestigationCase,
  RiskAssessment,
} from '../types';
import type { DerivedCaseStatus } from '../cases';

/**
 * Approved mutually exclusive claim dispositions per M9 exit criteria.
 */
export type ClaimStatus =
  | 'VERIFIED_IN_FIXTURES'     // Fully verified by executable benchmark code against canonical fixtures
  | 'SIMULATED'                // Disclosed as simulated demonstration behavior (e.g. synthetic replay)
  | 'PLANNED'                  // Documented architectural roadmap capability not yet scheduled/implemented
  | 'EXPERIMENTAL'             // Active research or heuristic feature without fixed stability guarantees
  | 'OUT_OF_SCOPE'             // Explicit product non-goal (e.g. autonomous containment, intent attribution)
  | 'REJECTED_UNSUPPORTED';    // Claim failed evaluation, lacks required evidence, or asserts forbidden claims

export type VerificationScope =
  | 'SYNTHETIC_FIXTURES_ONLY'
  | 'DETERMINISTIC_ENGINE_INVARIANT'
  | 'NOT_APPLICABLE'
  | 'PRODUCTION_EXTERNAL';

export type ClaimCategory =
  | 'BEHAVIORAL_DETECTION'
  | 'CONTEXT_RECONCILIATION'
  | 'RISK_SCORING'
  | 'PRIVACY'
  | 'AUDITABILITY'
  | 'SYSTEM_BOUNDARY'
  | 'NON_GOAL';

export type ClaimEvidenceType =
  | 'BENCHMARK_SCENARIO'
  | 'ACCEPTANCE_TEST'
  | 'UNIT_INVARIANT_TEST'
  | 'DOCUMENTATION_CONTRACT'
  | 'EXPLICIT_NON_GOAL';

export interface ClaimEvidenceReference {
  readonly evidenceType: ClaimEvidenceType;
  readonly identifier: string;
  readonly description: string;
}

/**
 * Immutable static product claim register entry.
 */
export interface ProductClaim extends IdRecord {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly sourceDocument: string;
  readonly category: ClaimCategory;
  readonly targetStatus: ClaimStatus;
  readonly verificationScope: VerificationScope;
  readonly requiresExternalValidation: boolean;
  readonly evidenceReferences: readonly ClaimEvidenceReference[];
  readonly limitations: string;
}

/**
 * Runtime result of evaluating a static ProductClaim against benchmark evidence.
 */
export interface ClaimEvaluationResult {
  readonly claimId: string;
  readonly targetStatus: ClaimStatus;
  readonly effectiveStatus: ClaimStatus;
  readonly passed: boolean;
  readonly evaluatedScope: VerificationScope;
  readonly requiresExternalValidation: boolean;
  readonly verifiedBenchmarkIds: readonly string[];
  readonly failedBenchmarkIds: readonly string[];
  readonly diagnostics: readonly string[];
  readonly limitations: string;
}

export type ComparisonOperator =
  | 'EQUALS'
  | 'GREATER_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_THAN_OR_EQUAL'
  | 'BETWEEN_EXCLUSIVE'
  | 'BETWEEN_INCLUSIVE';

export interface NumericConstraint {
  readonly operator: ComparisonOperator;
  readonly value: number;
  readonly secondaryValue?: number;
}

export interface ScenarioExpectation {
  readonly scenarioId: string;
  readonly expectedContextOutcome: ContextOutcome;
  readonly residualRiskConstraint: NumericConstraint;
  readonly rawDeviationConstraint: NumericConstraint;
  readonly contextCoverageConstraint: NumericConstraint;
  readonly expectedCaseCreated: boolean;
  readonly expectedAuditEventTypes: readonly AuditEvent['eventType'][];
  readonly expectedPseudonymousActors: boolean;
}

export interface BenchmarkTemporalContext {
  readonly validTimeEventCutoff: string;     // Upper boundary for SecurityEvent.timestamp
  readonly evaluationKnowledgeTime: string;  // Knowledge-time cutoff T passed to M7 risk & M8 case construction
}

export interface BenchmarkScenarioDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly fixtureId: string;
  readonly temporalContext: BenchmarkTemporalContext;
  readonly expectation: ScenarioExpectation;
}

export interface BenchmarkObservation {
  readonly scenarioId: string;
  readonly observedRawDeviation: number;
  readonly observedContextCoverage: number;
  readonly observedResidualRisk: number;
  readonly observedConfidence: number;
  readonly observedContextOutcome: ContextOutcome;
  readonly derivedCaseStatus: DerivedCaseStatus;
  readonly emittedAuditEventCount: number;
}

export interface BenchmarkScenarioResult {
  readonly scenarioId: string;
  readonly passed: boolean;
  readonly failures: readonly string[];
  readonly observation: BenchmarkObservation;
  readonly investigationCase?: InvestigationCase;
  readonly riskAssessment?: RiskAssessment;
  readonly auditEvents: readonly AuditEvent[];
}

export interface AggregateMetrics {
  readonly scenarioExpectationPassRate: number | null;
  readonly contextOutcomeExpectationAgreementRate: number | null;
  readonly evidenceResolutionRate: number | null;
  readonly caseConstructionExpectationPassRate: number | null;
  readonly auditActionExpectationPassRate: number | null;
  readonly privacyComplianceRate: number | null;
}

export interface EvaluationReportData {
  readonly schemaVersion: 'silent-shift.v1';
  readonly runId: string;
  readonly evaluationTime: string;
  readonly benchmarkResults: readonly BenchmarkScenarioResult[];
  readonly metrics: AggregateMetrics;
  readonly claimResults: readonly ClaimEvaluationResult[];
  readonly summary: {
    readonly totalScenarios: number;
    readonly passedScenarios: number;
    readonly verifiedInFixturesClaims: number;
    readonly simulatedClaims: number;
    readonly plannedClaims: number;
    readonly experimentalClaims: number;
    readonly outOfScopeClaims: number;
    readonly rejectedUnsupportedClaims: number;
  };
}
