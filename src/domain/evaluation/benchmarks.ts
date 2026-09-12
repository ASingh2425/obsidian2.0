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

import type { BenchmarkScenarioDefinition } from './types';

/**
 * Approved canonical benchmark scenarios mapped directly to fixtures in src/fixtures/scenarios.ts.
 * All temporal parameters strictly separate valid-time cutoff from evaluation knowledge-time cutoff.
 */
export const BENCHMARK_SCENARIOS: readonly BenchmarkScenarioDefinition[] = Object.freeze([
  {
    id: 'BENCH-01',
    name: 'Legitimate Role Change',
    description: 'Verifies complete context coverage (EXPLAINED) resulting in zero residual risk when an active role-change grant matches all anomalous actions.',
    fixtureId: 'fixture-legitimate-role-change',
    temporalContext: {
      validTimeEventCutoff: '2024-04-15T18:00:00Z',
      evaluationKnowledgeTime: '2024-04-16T00:00:00Z',
    },
    expectation: {
      scenarioId: 'fixture-legitimate-role-change',
      expectedContextOutcome: 'EXPLAINED',
      residualRiskConstraint: { operator: 'EQUALS', value: 0.0 },
      rawDeviationConstraint: { operator: 'GREATER_THAN', value: 0.0 },
      contextCoverageConstraint: { operator: 'EQUALS', value: 1.0 },
      expectedCaseCreated: true,
      expectedAuditEventTypes: ['CASE_CREATED'],
      expectedPseudonymousActors: true,
    },
  },
  {
    id: 'BENCH-02',
    name: 'Compromised Account Exfiltration',
    description: 'Verifies zero context coverage (UNEXPLAINED) resulting in residual risk equal to raw deviation when only an expired grant exists.',
    fixtureId: 'fixture-compromised-account',
    temporalContext: {
      validTimeEventCutoff: '2024-05-08T23:59:59Z',
      evaluationKnowledgeTime: '2024-05-09T00:00:00Z',
    },
    expectation: {
      scenarioId: 'fixture-compromised-account',
      expectedContextOutcome: 'UNEXPLAINED',
      residualRiskConstraint: { operator: 'GREATER_THAN', value: 0.0 },
      rawDeviationConstraint: { operator: 'GREATER_THAN', value: 0.0 },
      contextCoverageConstraint: { operator: 'EQUALS', value: 0.0 },
      expectedCaseCreated: true,
      expectedAuditEventTypes: ['CASE_CREATED'],
      expectedPseudonymousActors: true,
    },
  },
  {
    id: 'BENCH-03',
    name: 'Partially Legitimate Migration Export',
    description: 'Verifies partial context coverage (PARTIALLY_EXPLAINED) where migration pool writes are approved but external exports and privilege elevations remain unexplained.',
    fixtureId: 'fixture-partially-legitimate-migration',
    temporalContext: {
      validTimeEventCutoff: '2024-06-12T16:00:00Z',
      evaluationKnowledgeTime: '2024-06-12T18:00:00Z',
    },
    expectation: {
      scenarioId: 'fixture-partially-legitimate-migration',
      expectedContextOutcome: 'PARTIALLY_EXPLAINED',
      residualRiskConstraint: { operator: 'BETWEEN_EXCLUSIVE', value: 0.0, secondaryValue: 1.0 },
      rawDeviationConstraint: { operator: 'GREATER_THAN', value: 0.0 },
      contextCoverageConstraint: { operator: 'BETWEEN_EXCLUSIVE', value: 0.0, secondaryValue: 1.0 },
      expectedCaseCreated: true,
      expectedAuditEventTypes: ['CASE_CREATED'],
      expectedPseudonymousActors: true,
    },
  },
]);
