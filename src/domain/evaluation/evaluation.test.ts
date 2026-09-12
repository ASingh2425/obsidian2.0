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

import { describe, it, expect } from 'vitest';
import {
  BENCHMARK_SCENARIOS,
  PRODUCT_CLAIMS,
  runOfflineEvaluation,
  runBenchmarkScenario,
  calculateRatio,
  evaluateNumericConstraint,
  renderReportToMarkdown,
  isValidPseudonymousId,
  type BenchmarkScenarioDefinition,
  type ProductClaim,
} from './index';

describe('Milestone 9: Offline Evaluation Harness and Claim Verification', () => {
  it('AT-EVAL-001: executes full offline evaluation harness on canonical fixtures deterministically', () => {
    const report1 = runOfflineEvaluation();
    const report2 = runOfflineEvaluation();

    // Invariant: Output is deterministic and reproducible
    expect(report1.summary.totalScenarios).toBe(3);
    expect(report1.summary.passedScenarios).toBe(3);
    expect(report1.benchmarkResults.every((b) => b.passed)).toBe(true);

    // Deep equality across runs without wall-clock drift
    expect(report1).toEqual(report2);

    // Metrics are valid numbers
    expect(report1.metrics.scenarioExpectationPassRate).toBe(1.0);
    expect(report1.metrics.contextOutcomeExpectationAgreementRate).toBe(1.0);
    expect(report1.metrics.evidenceResolutionRate).toBe(1.0);
    expect(report1.metrics.caseConstructionExpectationPassRate).toBe(1.0);
    expect(report1.metrics.auditActionExpectationPassRate).toBe(1.0);
    expect(report1.metrics.privacyComplianceRate).toBe(1.0);
  });

  it('AT-CLAIM-001: validates product claim register gating and preserves static immutability', () => {
    const report = runOfflineEvaluation();

    // Verify all claims have mutually exclusive dispositions from the 6 approved statuses
    const validStatuses = new Set([
      'VERIFIED_IN_FIXTURES',
      'SIMULATED',
      'PLANNED',
      'EXPERIMENTAL',
      'OUT_OF_SCOPE',
      'REJECTED_UNSUPPORTED',
    ]);

    for (const claimResult of report.claimResults) {
      expect(validStatuses.has(claimResult.effectiveStatus)).toBe(true);
      expect(claimResult.diagnostics).toBeDefined();
    }

    // Out-of-scope non-goals must be OUT_OF_SCOPE
    const noIntentClaim = report.claimResults.find((c) => c.claimId === 'CLAIM-NO-INTENT-001');
    expect(noIntentClaim?.effectiveStatus).toBe('OUT_OF_SCOPE');

    const containmentClaim = report.claimResults.find((c) => c.claimId === 'CLAIM-AUTONOMOUS-CONTAINMENT-001');
    expect(containmentClaim?.effectiveStatus).toBe('OUT_OF_SCOPE');

    const zeroFpClaim = report.claimResults.find((c) => c.claimId === 'CLAIM-ZERO-FALSE-POSITIVES-001');
    expect(zeroFpClaim?.effectiveStatus).toBe('OUT_OF_SCOPE');

    // Simulated claim must be SIMULATED
    const simClaim = report.claimResults.find((c) => c.claimId === 'CLAIM-SYNTHETIC-DATA-001');
    expect(simClaim?.effectiveStatus).toBe('SIMULATED');

    // Planned claims must be PLANNED
    const plannedClaim = report.claimResults.find((c) => c.claimId === 'CLAIM-SHIFT-GRAPH-001');
    expect(plannedClaim?.effectiveStatus).toBe('PLANNED');

    // Verified in fixtures claims must pass with scope SYNTHETIC_FIXTURES_ONLY
    const behaviorClaim = report.claimResults.find((c) => c.claimId === 'CLAIM-BEHAVIOR-001');
    expect(behaviorClaim?.effectiveStatus).toBe('VERIFIED_IN_FIXTURES');
    expect(behaviorClaim?.evaluatedScope).toBe('SYNTHETIC_FIXTURES_ONLY');
    expect(behaviorClaim?.requiresExternalValidation).toBe(true);

    // Static product claims must remain unmodified (immutable freeze)
    expect(Object.isFrozen(PRODUCT_CLAIMS)).toBe(true);
  });

  it('evaluates Benchmark 1 (Legitimate Role Change) accurately', () => {
    const bench1 = BENCHMARK_SCENARIOS.find((b) => b.id === 'BENCH-01')!;
    const result = runBenchmarkScenario(bench1);

    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.observation.observedContextOutcome).toBe('EXPLAINED');
    expect(result.observation.observedResidualRisk).toBe(0.0);
    expect(result.observation.observedContextCoverage).toBe(1.0);
    expect(result.observation.observedRawDeviation).toBeGreaterThan(0.0);
    expect(result.investigationCase).toBeDefined();
    expect(result.investigationCase?.status).toBe('OPEN_EXPLAINED');
    expect(result.auditEvents.some((ae) => ae.eventType === 'CASE_CREATED')).toBe(true);
  });

  it('evaluates Benchmark 2 (Compromised Account) accurately', () => {
    const bench2 = BENCHMARK_SCENARIOS.find((b) => b.id === 'BENCH-02')!;
    const result = runBenchmarkScenario(bench2);

    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.observation.observedContextOutcome).toBe('UNEXPLAINED');
    expect(result.observation.observedContextCoverage).toBe(0.0);
    expect(result.observation.observedResidualRisk).toBeGreaterThan(0.0);
    expect(result.observation.observedResidualRisk).toBeCloseTo(result.observation.observedRawDeviation, 4);
    expect(result.investigationCase?.status).toBe('OPEN_UNEXPLAINED');
  });

  it('evaluates Benchmark 3 (Partially Legitimate Migration) accurately', () => {
    const bench3 = BENCHMARK_SCENARIOS.find((b) => b.id === 'BENCH-03')!;
    const result = runBenchmarkScenario(bench3);

    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.observation.observedContextOutcome).toBe('PARTIALLY_EXPLAINED');
    expect(result.observation.observedContextCoverage).toBeGreaterThan(0.0);
    expect(result.observation.observedContextCoverage).toBeLessThan(1.0);
    expect(result.observation.observedResidualRisk).toBeGreaterThan(0.0);
    expect(result.observation.observedResidualRisk).toBeLessThan(result.observation.observedRawDeviation);
    expect(result.investigationCase?.status).toBe('OPEN_PARTIALLY_EXPLAINED');
  });

  it('safely handles zero denominators returning null / N/A', () => {
    expect(calculateRatio(5, 0)).toBeNull();
    expect(calculateRatio(0, 0)).toBeNull();
    expect(calculateRatio(5, -1)).toBeNull();
    expect(calculateRatio(5, Infinity)).toBeNull();
  });

  it('correctly checks numeric constraints across all operators', () => {
    expect(evaluateNumericConstraint(10, { operator: 'EQUALS', value: 10 }).passed).toBe(true);
    expect(evaluateNumericConstraint(10.000001, { operator: 'EQUALS', value: 10 }).passed).toBe(true);
    expect(evaluateNumericConstraint(11, { operator: 'EQUALS', value: 10 }).passed).toBe(false);

    expect(evaluateNumericConstraint(5, { operator: 'GREATER_THAN', value: 3 }).passed).toBe(true);
    expect(evaluateNumericConstraint(3, { operator: 'GREATER_THAN', value: 3 }).passed).toBe(false);

    expect(evaluateNumericConstraint(0.5, { operator: 'BETWEEN_EXCLUSIVE', value: 0.0, secondaryValue: 1.0 }).passed).toBe(true);
    expect(evaluateNumericConstraint(0.0, { operator: 'BETWEEN_EXCLUSIVE', value: 0.0, secondaryValue: 1.0 }).passed).toBe(false);
    expect(evaluateNumericConstraint(1.0, { operator: 'BETWEEN_EXCLUSIVE', value: 0.0, secondaryValue: 1.0 }).passed).toBe(false);
  });

  it('transitions claim to REJECTED_UNSUPPORTED when a linked benchmark fails', () => {
    // Construct a failing benchmark expectation
    const modifiedBench: BenchmarkScenarioDefinition = {
      ...BENCHMARK_SCENARIOS[0]!,
      expectation: {
        ...BENCHMARK_SCENARIOS[0]!.expectation,
        expectedContextOutcome: 'UNEXPLAINED', // Contradicts legitimate role change
      },
    };

    const report = runOfflineEvaluation([modifiedBench], PRODUCT_CLAIMS);
    const linkedClaim = report.claimResults.find((c) => c.claimId === 'CLAIM-BEHAVIOR-001');

    // Must be REJECTED_UNSUPPORTED with diagnostic info, while static register remains untouched
    expect(linkedClaim?.effectiveStatus).toBe('REJECTED_UNSUPPORTED');
    expect(linkedClaim?.passed).toBe(false);
    expect(linkedClaim?.failedBenchmarkIds).toContain('BENCH-01');
    expect(PRODUCT_CLAIMS.find((c) => c.id === 'CLAIM-BEHAVIOR-001')?.targetStatus).toBe('VERIFIED_IN_FIXTURES');
  });

  it('verifies privacy compliance across all generated benchmark entities', () => {
    const report = runOfflineEvaluation();
    for (const b of report.benchmarkResults) {
      if (b.investigationCase) {
        expect(isValidPseudonymousId(b.investigationCase.entityId)).toBe(true);
      }
      for (const ae of b.auditEvents) {
        expect(isValidPseudonymousId(ae.actor)).toBe(true);
      }
    }
    expect(report.metrics.privacyComplianceRate).toBe(1.0);
  });

  it('renders a deterministic, structured Markdown report without wall-clock dependencies', () => {
    const report = runOfflineEvaluation();
    const md = renderReportToMarkdown(report);

    expect(md).toContain('# SILENT SHIFT — OFFLINE EVALUATION & BENCHMARK REPORT');
    expect(md).toContain('ScenarioExpectationPassRate');
    expect(md).toContain('BENCH-01');
    expect(md).toContain('CLAIM-BEHAVIOR-001');
    expect(md).toContain('CLAIM-NO-INTENT-001');
    expect(md).toContain('Synthetic Fixture Scope');

    // Reproducibility
    const md2 = renderReportToMarkdown(report);
    expect(md).toBe(md2);
  });
});
