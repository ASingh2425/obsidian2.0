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

import type { ProductClaim } from './types';

/**
 * Immutable canonical register of product claims.
 * Every claim has a documented source, an intended targetStatus,
 * explicit verificationScope, and traceable evidence references.
 */
export const PRODUCT_CLAIMS: readonly ProductClaim[] = Object.freeze([
  {
    id: 'CLAIM-BEHAVIOR-001',
    title: 'Context-Aware Behavioral Investigation System',
    text: 'Silent Shift detects meaningful transitions in user or account behavior, reconciles deviations against legitimate organizational context, and prioritizes unexplained activity for human investigation.',
    sourceDocument: 'PRODUCT_CONTRACT.md:Line 4 / AGENTS.md:Required product stance',
    category: 'BEHAVIORAL_DETECTION',
    targetStatus: 'VERIFIED_IN_FIXTURES',
    verificationScope: 'SYNTHETIC_FIXTURES_ONLY',
    requiresExternalValidation: true,
    evidenceReferences: [
      {
        evidenceType: 'BENCHMARK_SCENARIO',
        identifier: 'BENCH-01',
        description: 'Verifies legitimate role change detection and explanation.',
      },
      {
        evidenceType: 'BENCHMARK_SCENARIO',
        identifier: 'BENCH-02',
        description: 'Verifies compromised account unexplained shift detection.',
      },
      {
        evidenceType: 'BENCHMARK_SCENARIO',
        identifier: 'BENCH-03',
        description: 'Verifies partially legitimate migration split explanation.',
      },
      {
        evidenceType: 'ACCEPTANCE_TEST',
        identifier: 'AT-EVAL-001',
        description: 'Offline evaluation harness verification.',
      },
    ],
    limitations: 'Verified strictly against synthetic replay fixtures. Does not imply or measure detection performance, false-positive rates, or latency in live enterprise networks.',
  },
  {
    id: 'CLAIM-NO-INTENT-001',
    title: 'No Malicious Intent or Personal Blame Attribution',
    text: 'The system flags behavioral transitions and context gaps; it must never label an employee as malicious or infer intent.',
    sourceDocument: 'AGENTS.md:Core Rule 8 / PRODUCT_CONTRACT.md:Line 8',
    category: 'NON_GOAL',
    targetStatus: 'OUT_OF_SCOPE',
    verificationScope: 'NOT_APPLICABLE',
    requiresExternalValidation: false,
    evidenceReferences: [
      {
        evidenceType: 'EXPLICIT_NON_GOAL',
        identifier: 'AGENTS.md:Core Rule 8',
        description: 'Never infer malicious intent, guilt, or personal blame from raw behavioral anomalies.',
      },
      {
        evidenceType: 'DOCUMENTATION_CONTRACT',
        identifier: 'PRODUCT_CONTRACT.md:Line 8',
        description: 'The product must never label an employee as malicious or infer intent.',
      },
    ],
    limitations: 'Negative architectural guarantee enforced by domain design and vocabulary policies.',
  },
  {
    id: 'CLAIM-DIMENSIONS-001',
    title: 'Explicit Separation of Behavioral Dimensions',
    text: 'Every case visibly separates raw behavioral deviation, context coverage, and residual unexplained risk.',
    sourceDocument: 'PRODUCT_CONTRACT.md:Line 68 / AT-RISK-001',
    category: 'RISK_SCORING',
    targetStatus: 'VERIFIED_IN_FIXTURES',
    verificationScope: 'SYNTHETIC_FIXTURES_ONLY',
    requiresExternalValidation: true,
    evidenceReferences: [
      {
        evidenceType: 'BENCHMARK_SCENARIO',
        identifier: 'BENCH-01',
        description: 'Validates that raw deviation, coverage, and residual risk are distinct numbers.',
      },
      {
        evidenceType: 'BENCHMARK_SCENARIO',
        identifier: 'BENCH-03',
        description: 'Validates partial coverage yielding non-zero raw deviation alongside separate residual risk.',
      },
      {
        evidenceType: 'ACCEPTANCE_TEST',
        identifier: 'AT-RISK-001',
        description: 'Three-layer risk decomposition acceptance test.',
      },
    ],
    limitations: 'Verified strictly against synthetic replay fixtures. Mathematical formulas are deterministic functions of inputs.',
  },
  {
    id: 'CLAIM-CONTEXT-OUTCOMES-001',
    title: 'Deterministic Four-State Context Outcomes',
    text: 'Context outcome must be exactly one of EXPLAINED, PARTIALLY_EXPLAINED, UNEXPLAINED, or INDETERMINATE, without arbitrary percentage thresholds.',
    sourceDocument: 'PRODUCT_CONTRACT.md:Line 74 / AGENTS.md:Context outcomes',
    category: 'CONTEXT_RECONCILIATION',
    targetStatus: 'VERIFIED_IN_FIXTURES',
    verificationScope: 'SYNTHETIC_FIXTURES_ONLY',
    requiresExternalValidation: true,
    evidenceReferences: [
      {
        evidenceType: 'BENCHMARK_SCENARIO',
        identifier: 'BENCH-01',
        description: 'Produces EXPLAINED outcome when all material evidence is covered.',
      },
      {
        evidenceType: 'BENCHMARK_SCENARIO',
        identifier: 'BENCH-02',
        description: 'Produces UNEXPLAINED outcome when no applicable context covers material evidence.',
      },
      {
        evidenceType: 'BENCHMARK_SCENARIO',
        identifier: 'BENCH-03',
        description: 'Produces PARTIALLY_EXPLAINED outcome when some material evidence is covered and some remains.',
      },
      {
        evidenceType: 'ACCEPTANCE_TEST',
        identifier: 'AT-CONTEXT-001',
        description: 'Context reconciliation evaluation test.',
      },
    ],
    limitations: 'Verified strictly against synthetic replay fixtures. Relies on structured, authoritative ContextGrant data.',
  },
  {
    id: 'CLAIM-NO-LLM-001',
    title: 'Complete Deterministic Operation Without an LLM',
    text: 'Detection, correlation, reconciliation, and risk scoring are strictly deterministic and function completely without an LLM or network dependencies.',
    sourceDocument: 'AGENTS.md:LLM boundary / PRODUCT_CONTRACT.md:Line 138',
    category: 'SYSTEM_BOUNDARY',
    targetStatus: 'VERIFIED_IN_FIXTURES',
    verificationScope: 'DETERMINISTIC_ENGINE_INVARIANT',
    requiresExternalValidation: false,
    evidenceReferences: [
      {
        evidenceType: 'ACCEPTANCE_TEST',
        identifier: 'AT-EXPL-001',
        description: 'Deterministic fallback explanation invariant test.',
      },
      {
        evidenceType: 'UNIT_INVARIANT_TEST',
        identifier: 'M7:risk.test.ts',
        description: 'Verifies pure algorithmic explanation synthesis.',
      },
    ],
    limitations: 'Applies to core domain engine M1–M8. An optional LLM narrative layer is reserved for Milestone 12.',
  },
  {
    id: 'CLAIM-PRIVACY-001',
    title: 'Pseudonymous Identifiers in Domain & Audit Artifacts',
    text: 'Case, decision, and audit data use pseudonymous identifiers by default; direct raw personal identities and email addresses are rejected.',
    sourceDocument: 'ACCEPTANCE_TESTS.md:Line 178 / AT-PRIV-001',
    category: 'PRIVACY',
    targetStatus: 'VERIFIED_IN_FIXTURES',
    verificationScope: 'SYNTHETIC_FIXTURES_ONLY',
    requiresExternalValidation: true,
    evidenceReferences: [
      {
        evidenceType: 'ACCEPTANCE_TEST',
        identifier: 'AT-PRIV-001',
        description: 'Pseudonymization policy enforcement test.',
      },
      {
        evidenceType: 'BENCHMARK_SCENARIO',
        identifier: 'BENCH-01',
        description: 'Asserts all actors are pseudonymous in constructed case and audit events.',
      },
    ],
    limitations: 'Enforced on entity token formats. Unstructured free-text rationale sanitization is an operational governance responsibility.',
  },
  {
    id: 'CLAIM-AUDIT-PRESERVE-001',
    title: 'Immutable Append-Only Audit Preservation',
    text: 'Analyst decisions and context corrections produce append-only audit events without mutating historical raw telemetry or erasing prior risk records.',
    sourceDocument: 'AGENTS.md:Context corrections / ACCEPTANCE_TESTS.md:Line 171',
    category: 'AUDITABILITY',
    targetStatus: 'VERIFIED_IN_FIXTURES',
    verificationScope: 'SYNTHETIC_FIXTURES_ONLY',
    requiresExternalValidation: true,
    evidenceReferences: [
      {
        evidenceType: 'ACCEPTANCE_TEST',
        identifier: 'AT-AUDIT-001',
        description: 'Historical raw evidence preservation test.',
      },
      {
        evidenceType: 'UNIT_INVARIANT_TEST',
        identifier: 'M8:cases.test.ts',
        description: 'Verifies append-only in-memory audit store ordering and idempotency.',
      },
    ],
    limitations: 'In-memory prototype storage only. Durable persistent database storage is planned for future milestones.',
  },
  {
    id: 'CLAIM-SYNTHETIC-DATA-001',
    title: 'Disclosed Synthetic Replay Baseline',
    text: 'Initial data source consists of disclosed synthetic replay fixtures only; there is no claim of live enterprise ingestion.',
    sourceDocument: 'PRODUCT_CONTRACT.md:Line 54 / AGENTS.md:Initial data source',
    category: 'SYSTEM_BOUNDARY',
    targetStatus: 'SIMULATED',
    verificationScope: 'SYNTHETIC_FIXTURES_ONLY',
    requiresExternalValidation: true,
    evidenceReferences: [
      {
        evidenceType: 'DOCUMENTATION_CONTRACT',
        identifier: 'PRODUCT_CONTRACT.md:Line 54',
        description: 'Data source is disclosed synthetic replay fixtures only.',
      },
    ],
    limitations: 'Demonstrates domain logic under calibrated scenario conditions. Enterprise streaming integration is not implemented.',
  },
  {
    id: 'CLAIM-DURABLE-STORAGE-001',
    title: 'Durable Database Audit Storage',
    text: 'Durable, cryptographically verifiable, multi-session persistent audit storage.',
    sourceDocument: 'PRODUCT_CONTRACT.md:Line 151 / AGENTS.md:Prototype persistence',
    category: 'AUDITABILITY',
    targetStatus: 'PLANNED',
    verificationScope: 'NOT_APPLICABLE',
    requiresExternalValidation: false,
    evidenceReferences: [
      {
        evidenceType: 'DOCUMENTATION_CONTRACT',
        identifier: 'PRODUCT_CONTRACT.md:Line 151',
        description: 'Prototype persistence is in-memory/session-only. Durable audit storage is PLANNED.',
      },
    ],
    limitations: 'Roadmap capability. Current prototype uses deterministic in-memory audit logger.',
  },
  {
    id: 'CLAIM-SHIFT-GRAPH-001',
    title: 'Evidence-Linked Shift Graph Visualization',
    text: '2D/3D temporal evidence-linked visualization of behavioral shifts and organizational context.',
    sourceDocument: 'PRODUCT_CONTRACT.md:Line 156 / AGENTS.md:Shift Graph',
    category: 'SYSTEM_BOUNDARY',
    targetStatus: 'PLANNED',
    verificationScope: 'NOT_APPLICABLE',
    requiresExternalValidation: false,
    evidenceReferences: [
      {
        evidenceType: 'DOCUMENTATION_CONTRACT',
        identifier: 'PRODUCT_CONTRACT.md:Line 156',
        description: 'First production milestone for Shift Graph is Milestone 11.',
      },
    ],
    limitations: 'Roadmap capability scheduled for Milestone 11. Design contract exists in docs/ARCHITECTURE.md.',
  },
  {
    id: 'CLAIM-AUTONOMOUS-CONTAINMENT-001',
    title: 'Autonomous System or Account Containment',
    text: 'Automated containment, session termination, or access revocation without human review.',
    sourceDocument: 'AGENTS.md:Autonomous containment / PRODUCT_CONTRACT.md:Line 58',
    category: 'NON_GOAL',
    targetStatus: 'OUT_OF_SCOPE',
    verificationScope: 'NOT_APPLICABLE',
    requiresExternalValidation: false,
    evidenceReferences: [
      {
        evidenceType: 'EXPLICIT_NON_GOAL',
        identifier: 'AGENTS.md:Autonomous containment',
        description: 'Autonomous containment is out of scope for the product at this stage.',
      },
    ],
    limitations: 'Forbidden product action. Silent Shift prioritizes evidence for human analyst decisions.',
  },
  {
    id: 'CLAIM-ZERO-FALSE-POSITIVES-001',
    title: 'Zero False Positives or Guaranteed Threat Elimination',
    text: 'Zero false positive rate, unmeasured accuracy, or guaranteed breach prevention claims.',
    sourceDocument: 'AGENTS.md:Claims policy',
    category: 'NON_GOAL',
    targetStatus: 'OUT_OF_SCOPE',
    verificationScope: 'NOT_APPLICABLE',
    requiresExternalValidation: false,
    evidenceReferences: [
      {
        evidenceType: 'EXPLICIT_NON_GOAL',
        identifier: 'AGENTS.md:Claims policy',
        description: 'Zero false positives, unmeasured accuracy, and guaranteed prevention are unsupported and forbidden claims.',
      },
    ],
    limitations: 'Forbidden marketing claim. Efficacy depends on organizational context quality and behavioral variance.',
  },
]);
