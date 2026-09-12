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

import type { EvaluationReportData } from './types';
import { formatRatio } from './metrics';

/**
 * Renders structured evaluation output into an inspectable Markdown report.
 * Guaranteed deterministic: no wall-clock time, sorted tables, explicit limitations.
 */
export function renderReportToMarkdown(report: EvaluationReportData): string {
  const lines: string[] = [];

  lines.push('# SILENT SHIFT — OFFLINE EVALUATION & BENCHMARK REPORT');
  lines.push('');
  lines.push(`- **Schema Version**: \`${report.schemaVersion}\``);
  lines.push(`- **Run ID**: \`${report.runId}\``);
  lines.push(`- **Evaluation Cutoff Time**: \`${report.evaluationTime}\``);
  lines.push(`- **Execution Mode**: Deterministic Offline Fixture Replay (No LLM, No Network)`);
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## 1. Executive Evaluation Summary');
  lines.push('');
  lines.push(`- **Scenarios Evaluated**: ${report.summary.totalScenarios} (${report.summary.passedScenarios} passed, ${report.summary.totalScenarios - report.summary.passedScenarios} failed)`);
  lines.push(`- **Verified in Fixtures**: ${report.summary.verifiedInFixturesClaims} claims`);
  lines.push(`- **Disclosed as Simulated**: ${report.summary.simulatedClaims} claims`);
  lines.push(`- **Roadmap / Planned**: ${report.summary.plannedClaims} claims`);
  lines.push(`- **Experimental**: ${report.summary.experimentalClaims} claims`);
  lines.push(`- **Out of Scope (Non-Goals)**: ${report.summary.outOfScopeClaims} claims`);
  lines.push(`- **Rejected / Unsupported**: ${report.summary.rejectedUnsupportedClaims} claims`);
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## 2. Aggregate Evaluation Metrics');
  lines.push('');
  lines.push('| Metric | Value | Formula & Denominator Definition |');
  lines.push('| :--- | :--- | :--- |');
  lines.push(`| **ScenarioExpectationPassRate** | \`${formatRatio(report.metrics.scenarioExpectationPassRate)}\` | Passing registered scenarios / Registered scenarios |`);
  lines.push(`| **ContextOutcomeExpectationAgreementRate** | \`${formatRatio(report.metrics.contextOutcomeExpectationAgreementRate)}\` | Scenarios with computed outcome == expected outcome / Registered scenarios |`);
  lines.push(`| **EvidenceResolutionRate** | \`${formatRatio(report.metrics.evidenceResolutionRate)}\` | Resolved expected SecurityEvent IDs / Expected SecurityEvent IDs |`);
  lines.push(`| **CaseConstructionExpectationPassRate** | \`${formatRatio(report.metrics.caseConstructionExpectationPassRate)}\` | Correctly constructed expected cases / Expected cases |`);
  lines.push(`| **AuditActionExpectationPassRate** | \`${formatRatio(report.metrics.auditActionExpectationPassRate)}\` | Correctly emitted expected audit actions / Expected audit actions |`);
  lines.push(`| **PrivacyComplianceRate** | \`${formatRatio(report.metrics.privacyComplianceRate)}\` | Pseudonymous expected actor identifiers / Expected actor identifiers |`);
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## 3. Benchmark Scenario Observations');
  lines.push('');
  lines.push('| Scenario ID | Status | Outcome | Raw Dev | Coverage | Residual Risk | Case Status | Audit Events |');
  lines.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
  for (const r of report.benchmarkResults) {
    const statusStr = r.passed ? 'PASS' : 'FAIL';
    const o = r.observation;
    lines.push(
      `| \`${r.scenarioId}\` | **${statusStr}** | \`${o.observedContextOutcome}\` | ${o.observedRawDeviation.toFixed(3)} | ${o.observedContextCoverage.toFixed(2)} | ${o.observedResidualRisk.toFixed(3)} | \`${o.derivedCaseStatus}\` | ${o.emittedAuditEventCount} |`,
    );
  }
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## 4. Product Claims Register & Verification Dispositions');
  lines.push('');
  lines.push('| Claim ID | Category | Target Status | Effective Disposition | Scope | External Validation |');
  lines.push('| :--- | :--- | :--- | :--- | :--- | :--- |');
  for (const c of report.claimResults) {
    const extValStr = c.requiresExternalValidation ? 'Yes' : 'No';
    lines.push(
      `| \`${c.claimId}\` | \`${c.targetStatus}\` | \`${c.effectiveStatus}\` | \`${c.evaluatedScope}\` | ${extValStr} |`,
    );
  }
  lines.push('');

  const failedClaims = report.claimResults.filter((c) => c.effectiveStatus === 'REJECTED_UNSUPPORTED');
  if (failedClaims.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## 5. Failed or Unsupported Claims');
    lines.push('');
    for (const fc of failedClaims) {
      lines.push(`### Claim \`${fc.claimId}\``);
      lines.push(`- **Target Status**: \`${fc.targetStatus}\``);
      lines.push(`- **Effective Disposition**: \`REJECTED_UNSUPPORTED\``);
      lines.push(`- **Diagnostics**: ${fc.diagnostics.join('; ')}`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('## 6. Accepted Scope & Limitations');
  lines.push('');
  lines.push('1. **Synthetic Fixture Scope**: All benchmarks are executed strictly against synthetic replay fixtures (`src/fixtures/scenarios.ts`). They demonstrate algorithmic correctness of feature extraction, change-point detection, correlation, reconciliation, risk scoring, and case creation.');
  lines.push('2. **No Production Efficacy Claims**: Benchmark success does not imply or measure detection performance, precision, recall, false-positive rates, or breach prevention in live enterprise IT environments.');
  lines.push('3. **No Intent or Guilt Attribution**: Silent Shift prioritizes unexplained deviations for human analysts; it never labels employees as malicious.');
  lines.push('4. **In-Memory Prototype**: Audit logging and case tracking are session-scoped in-memory structures; durable persistent storage is planned for future milestones.');
  lines.push('');

  return lines.join('\n');
}
