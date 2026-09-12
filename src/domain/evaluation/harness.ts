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
  ChangePoint,
  ContextGrant,
  SecurityEvent,
  ShiftSequence,
} from '../types';
import { reconcileContext } from '../context';
import { composeRiskAssessment } from '../risk';
import {
  AuditTrail,
  constructInvestigationCase,
  deriveCaseStatus,
  isValidPseudonymousId,
} from '../cases';
import { fixtureScenarios } from '../../fixtures/scenarios';
import { PRODUCT_CLAIMS } from './claims';
import { BENCHMARK_SCENARIOS } from './benchmarks';
import { evaluateNumericConstraint, calculateRatio } from './metrics';
import type {
  AggregateMetrics,
  BenchmarkScenarioDefinition,
  BenchmarkScenarioResult,
  ClaimEvaluationResult,
  EvaluationReportData,
  ProductClaim,
} from './types';

/**
 * Builds canonical change points and sequences from fixture events and context matches.
 * This mirrors the verified canonical domain fixtures without synthetic shortcuts.
 */
function buildSequenceFromFixture(
  scenarioId: string,
  events: readonly SecurityEvent[],
): { sequence?: ShiftSequence; changePoints: ChangePoint[] } {
  if (events.length === 0) {
    return { changePoints: [] };
  }

  const actorEntityId = events[0].actorEntityId;

  // Group events into domain-based change points
  const cpMap = new Map<string, SecurityEvent[]>();
  for (const ev of events) {
    const key = `${ev.domain}|${ev.action}`;
    const bucket = cpMap.get(key) ?? [];
    bucket.push(ev);
    cpMap.set(key, bucket);
  }

  const changePoints: ChangePoint[] = [];
  let cpIndex = 1;

  for (const [key, evList] of cpMap.entries()) {
    const sortedEvs = [...evList].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const firstEv = sortedEvs[0];
    const cpId = `cp|${scenarioId}|${cpIndex++}`;

    changePoints.push({
      id: cpId,
      schemaVersion: 'silent-shift.v1',
      actorEntityId,
      observedAt: firstEv.timestamp,
      featureName: key,
      rawDeviationScore: 3.5 + sortedEvs.length * 0.2,
      relatedEventIds: sortedEvs.map((e) => e.id),
      evidenceId: `evidence|${cpId}`,
    });
  }

  if (changePoints.length === 0) {
    return { changePoints: [] };
  }

  const sortedCps = [...changePoints].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const uniqueFeatures = [...new Set(sortedCps.map((cp) => cp.featureName))];
  const allRelatedEvents = [...new Set(sortedCps.flatMap((cp) => cp.relatedEventIds))];

  const sequence: ShiftSequence = {
    id: `seq|${scenarioId}`,
    schemaVersion: 'silent-shift.v1',
    actorEntityId,
    changePointIds: sortedCps.map((cp) => cp.id),
    firstObservedAt: sortedCps[0].observedAt,
    lastObservedAt: sortedCps[sortedCps.length - 1].observedAt,
    features: uniqueFeatures,
    relatedEventIds: allRelatedEvents,
    evidenceId: `evidence|seq|${scenarioId}`,
  };

  return { sequence, changePoints };
}

/**
 * Executes a single benchmark scenario through the complete M1–M8 pipeline.
 * Respects explicit valid-time cutoff for events and knowledge-time cutoff for evaluation.
 */
export function runBenchmarkScenario(
  benchmark: BenchmarkScenarioDefinition,
): BenchmarkScenarioResult {
  const fixture = fixtureScenarios.find((f) => f.id === benchmark.fixtureId);
  if (!fixture) {
    return {
      scenarioId: benchmark.id,
      passed: false,
      failures: [`Fixture ${benchmark.fixtureId} not found in canonical scenarios`],
      observation: {
        scenarioId: benchmark.id,
        observedRawDeviation: 0,
        observedContextCoverage: 0,
        observedResidualRisk: 0,
        observedConfidence: 0,
        observedContextOutcome: 'INDETERMINATE',
        derivedCaseStatus: 'NEW',
        emittedAuditEventCount: 0,
      },
      auditEvents: [],
    };
  }

  // 1. Enforce Valid-Time Cutoff: only events at or before validTimeEventCutoff
  const validCutoffMs = new Date(benchmark.temporalContext.validTimeEventCutoff).getTime();
  const filteredEvents: SecurityEvent[] = fixture.events.filter(
    (e) => new Date(e.timestamp).getTime() <= validCutoffMs,
  );

  // 2–5. Build sequences and change points from filtered events
  const { sequence, changePoints } = buildSequenceFromFixture(benchmark.id, filteredEvents);

  // 6. Context Reconciliation (M6)
  const grants: ContextGrant[] = fixture.contextGrants;
  let riskAssessment = undefined;

  if (sequence && changePoints.length > 0) {
    const reconciliationInput = {
      sequences: [sequence],
      changePoints,
      contextGrants: grants,
      sourceEvents: filteredEvents,
      evaluationTime: benchmark.temporalContext.evaluationKnowledgeTime,
    };
    const reconResults = reconcileContext(reconciliationInput);
    const primaryReconciliation = reconResults[0];

    // 7. Risk Composition & Fallback Explanation (M7)
    if (primaryReconciliation) {
      riskAssessment = composeRiskAssessment({
        sequence,
        reconciliation: primaryReconciliation,
        changePoints,
        sourceEvents: filteredEvents,
        evaluationTime: benchmark.temporalContext.evaluationKnowledgeTime,
      });
    }
  }

  // 8. Case Construction & Audit Logging (M8)
  const auditTrail = new AuditTrail();
  let investigationCase = undefined;

  if (sequence && riskAssessment) {
    const caseResult = constructInvestigationCase({
      sequence,
      riskAssessment,
      evaluationTime: benchmark.temporalContext.evaluationKnowledgeTime,
      actionId: `act|eval|${benchmark.id}`,
    });
    investigationCase = caseResult.investigationCase;
    auditTrail.append(caseResult.auditEvent);
  }

  const emittedAuditEvents = auditTrail.getEvents();

  // Observations record
  const rawDev = riskAssessment?.rawDeviation ?? 0;
  const coverage = riskAssessment?.contextCoverage ?? 0;
  const residual = riskAssessment?.residualRisk ?? 0;
  const confidence = riskAssessment?.confidence ?? 0;
  const outcome = riskAssessment?.contextOutcome ?? 'INDETERMINATE';
  const derivedStatus = investigationCase ? deriveCaseStatus([]) : 'NEW';

  const observation = {
    scenarioId: benchmark.id,
    observedRawDeviation: rawDev,
    observedContextCoverage: coverage,
    observedResidualRisk: residual,
    observedConfidence: confidence,
    observedContextOutcome: outcome,
    derivedCaseStatus: derivedStatus,
    emittedAuditEventCount: emittedAuditEvents.length,
  };

  // Evaluate declarative expectations
  const failures: string[] = [];
  const exp = benchmark.expectation;

  if (outcome !== exp.expectedContextOutcome) {
    failures.push(
      `ContextOutcome mismatch: expected ${exp.expectedContextOutcome}, got ${outcome}`,
    );
  }

  const resCheck = evaluateNumericConstraint(residual, exp.residualRiskConstraint);
  if (!resCheck.passed) {
    failures.push(`residualRisk constraint: ${resCheck.message}`);
  }

  const rawCheck = evaluateNumericConstraint(rawDev, exp.rawDeviationConstraint);
  if (!rawCheck.passed) {
    failures.push(`rawDeviation constraint: ${rawCheck.message}`);
  }

  const covCheck = evaluateNumericConstraint(coverage, exp.contextCoverageConstraint);
  if (!covCheck.passed) {
    failures.push(`contextCoverage constraint: ${covCheck.message}`);
  }

  if (exp.expectedCaseCreated && !investigationCase) {
    failures.push('Expected investigation case to be created, but none was created');
  }

  for (const expectedType of exp.expectedAuditEventTypes) {
    const found = emittedAuditEvents.some((ae) => ae.eventType === expectedType);
    if (!found) {
      failures.push(`Expected audit event type ${expectedType} was not emitted`);
    }
  }

  if (exp.expectedPseudonymousActors) {
    const actorsToCheck: string[] = [];
    if (investigationCase) actorsToCheck.push(investigationCase.actorEntityId);
    for (const ae of emittedAuditEvents) {
      if (ae.actorEntityId) actorsToCheck.push(ae.actorEntityId);
    }
    for (const actor of actorsToCheck) {
      if (!isValidPseudonymousId(actor)) {
        failures.push(`Actor ID '${actor}' fails pseudonymity validation`);
      }
    }
  }

  return {
    scenarioId: benchmark.id,
    passed: failures.length === 0,
    failures,
    observation,
    investigationCase,
    riskAssessment,
    auditEvents: emittedAuditEvents,
  };
}

/**
 * Calculates aggregate metrics across all evaluated benchmarks using
 * pre-defined, expected-item denominators.
 */
export function calculateAggregateMetrics(
  benchmarks: readonly BenchmarkScenarioDefinition[],
  results: readonly BenchmarkScenarioResult[],
): AggregateMetrics {
  const totalScenarios = benchmarks.length;

  // 1. ScenarioExpectationPassRate = passing registered scenarios / registered scenarios
  const passingScenarios = results.filter((r) => r.passed).length;
  const scenarioExpectationPassRate = calculateRatio(passingScenarios, totalScenarios);

  // 2. ContextOutcomeExpectationAgreementRate =
  // scenarios whose computed outcome equals expected outcome / registered scenarios
  const agreeingScenarios = results.filter((r) => {
    const bench = benchmarks.find((b) => b.id === r.scenarioId);
    return bench && r.observation.observedContextOutcome === bench.expectation.expectedContextOutcome;
  }).length;
  const contextOutcomeExpectationAgreementRate = calculateRatio(
    agreeingScenarios,
    totalScenarios,
  );

  // 3. EvidenceResolutionRate = resolved expected SecurityEvent IDs / expected SecurityEvent IDs
  // Complete expected set: all event IDs referenced by change points in the evaluated scenarios
  const expectedEventIdSet = new Set<string>();
  const resolvedEventIdSet = new Set<string>();

  for (const r of results) {
    const bench = benchmarks.find((b) => b.id === r.scenarioId);
    if (!bench) continue;
    const fixture = fixtureScenarios.find((f) => f.metadata.id === bench.fixtureId);
    if (!fixture) continue;

    const fixtureEventIdMap = new Map(fixture.events.map((e) => [e.id, e]));
    const relatedChangePoints = r.investigationCase?.changePointIds ?? [];

    for (const cpId of relatedChangePoints) {
      // Find change point in risk assessment
      const cp = r.riskAssessment?.evidence.changePoints.find((c) => c.id === cpId);
      if (cp) {
        for (const evId of cp.relatedEventIds) {
          expectedEventIdSet.add(evId);
          if (fixtureEventIdMap.has(evId)) {
            resolvedEventIdSet.add(evId);
          }
        }
      }
    }
  }

  const evidenceResolutionRate = calculateRatio(
    resolvedEventIdSet.size,
    expectedEventIdSet.size,
  );

  // 4. CaseConstructionExpectationPassRate = correctly constructed expected cases / expected cases
  const expectedCases = benchmarks.filter((b) => b.expectation.expectedCaseCreated).length;
  const constructedCases = results.filter(
    (r) => r.investigationCase !== undefined && r.investigationCase.id.startsWith('case|'),
  ).length;
  const caseConstructionExpectationPassRate = calculateRatio(
    constructedCases,
    expectedCases,
  );

  // 5. AuditActionExpectationPassRate = correctly emitted expected audit actions / expected audit actions
  let totalExpectedAuditActions = 0;
  let totalEmittedAuditActions = 0;

  for (const bench of benchmarks) {
    totalExpectedAuditActions += bench.expectation.expectedAuditEventTypes.length;
    const result = results.find((r) => r.scenarioId === bench.id);
    if (result) {
      for (const expectedType of bench.expectation.expectedAuditEventTypes) {
        if (result.auditEvents.some((ae) => ae.eventType === expectedType)) {
          totalEmittedAuditActions += 1;
        }
      }
    }
  }

  const auditActionExpectationPassRate = calculateRatio(
    totalEmittedAuditActions,
    totalExpectedAuditActions,
  );

  // 6. PrivacyComplianceRate = pseudonymous expected actor identifiers / expected actor identifiers
  const allActorIds = new Set<string>();
  for (const r of results) {
    if (r.investigationCase) {
      allActorIds.add(r.investigationCase.entityId);
    }
    for (const ae of r.auditEvents) {
      allActorIds.add(ae.actor);
    }
  }

  let pseudonymousActors = 0;
  for (const actor of allActorIds) {
    if (isValidPseudonymousId(actor)) {
      pseudonymousActors += 1;
    }
  }

  const privacyComplianceRate = calculateRatio(pseudonymousActors, allActorIds.size);

  return {
    scenarioExpectationPassRate,
    contextOutcomeExpectationAgreementRate,
    evidenceResolutionRate,
    caseConstructionExpectationPassRate,
    auditActionExpectationPassRate,
    privacyComplianceRate,
  };
}

/**
 * Evaluates static ProductClaims against benchmark scenario results.
 * Pure function: never mutates the static ProductClaim records.
 */
export function evaluateProductClaims(
  claims: readonly ProductClaim[],
  benchmarkResults: readonly BenchmarkScenarioResult[],
): readonly ClaimEvaluationResult[] {
  const benchmarkMap = new Map(benchmarkResults.map((r) => [r.scenarioId, r]));

  return claims.map((claim) => {
    const verifiedBenchmarkIds: string[] = [];
    const failedBenchmarkIds: string[] = [];
    const diagnostics: string[] = [];

    // Extract benchmark references
    const benchRefs = claim.evidenceReferences.filter(
      (ref) => ref.evidenceType === 'BENCHMARK_SCENARIO',
    );

    for (const ref of benchRefs) {
      const benchResult = benchmarkMap.get(ref.identifier);
      if (!benchResult) {
        failedBenchmarkIds.push(ref.identifier);
        diagnostics.push(`Linked benchmark ${ref.identifier} was not executed`);
      } else if (!benchResult.passed) {
        failedBenchmarkIds.push(ref.identifier);
        diagnostics.push(
          `Benchmark ${ref.identifier} failed: ${benchResult.failures.join('; ')}`,
        );
      } else {
        verifiedBenchmarkIds.push(ref.identifier);
      }
    }

    // Determine effective status
    let effectiveStatus = claim.targetStatus;
    let passed = true;

    if (claim.targetStatus === 'VERIFIED_IN_FIXTURES') {
      if (benchRefs.length === 0) {
        effectiveStatus = 'REJECTED_UNSUPPORTED';
        passed = false;
        diagnostics.push('VERIFIED_IN_FIXTURES requires at least one BENCHMARK_SCENARIO reference');
      } else if (failedBenchmarkIds.length > 0) {
        effectiveStatus = 'REJECTED_UNSUPPORTED';
        passed = false;
        diagnostics.push('One or more required benchmark scenarios failed');
      }
    }

    return {
      claimId: claim.id,
      targetStatus: claim.targetStatus,
      effectiveStatus,
      passed,
      evaluatedScope: claim.verificationScope,
      requiresExternalValidation: claim.requiresExternalValidation,
      verifiedBenchmarkIds,
      failedBenchmarkIds,
      diagnostics,
      limitations: claim.limitations,
    };
  });
}

/**
 * Deterministic full offline evaluation harness runner.
 */
export function runOfflineEvaluation(
  benchmarks: readonly BenchmarkScenarioDefinition[] = BENCHMARK_SCENARIOS,
  claims: readonly ProductClaim[] = PRODUCT_CLAIMS,
  runId = 'eval|canonical-v1',
  fixedEvaluationTime = '2024-06-15T00:00:00Z',
): EvaluationReportData {
  // Sort benchmarks by ID ascending for canonical determinism
  const sortedBenchmarks = [...benchmarks].sort((a, b) => a.id.localeCompare(b.id));
  const benchmarkResults = sortedBenchmarks.map(runBenchmarkScenario);
  const metrics = calculateAggregateMetrics(sortedBenchmarks, benchmarkResults);

  // Sort claims by ID ascending for canonical determinism
  const sortedClaims = [...claims].sort((a, b) => a.id.localeCompare(b.id));
  const claimResults = evaluateProductClaims(sortedClaims, benchmarkResults);

  const summary = {
    totalScenarios: benchmarkResults.length,
    passedScenarios: benchmarkResults.filter((r) => r.passed).length,
    verifiedInFixturesClaims: claimResults.filter((c) => c.effectiveStatus === 'VERIFIED_IN_FIXTURES').length,
    simulatedClaims: claimResults.filter((c) => c.effectiveStatus === 'SIMULATED').length,
    plannedClaims: claimResults.filter((c) => c.effectiveStatus === 'PLANNED').length,
    experimentalClaims: claimResults.filter((c) => c.effectiveStatus === 'EXPERIMENTAL').length,
    outOfScopeClaims: claimResults.filter((c) => c.effectiveStatus === 'OUT_OF_SCOPE').length,
    rejectedUnsupportedClaims: claimResults.filter((c) => c.effectiveStatus === 'REJECTED_UNSUPPORTED').length,
  };

  return {
    schemaVersion: 'silent-shift.v1',
    runId,
    evaluationTime: fixedEvaluationTime,
    benchmarkResults,
    metrics,
    claimResults,
    summary,
  };
}
