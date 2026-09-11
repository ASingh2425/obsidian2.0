# BUILD_PLAN.md

## Goal
Provide a staged implementation plan for Silent Shift while preserving the working migration baseline and avoiding unsupported product claims.

## Milestone 1: domain types and fixture schema
Status: IMPLEMENTED

Entry criteria:
- product contract approved
- data contract agreed
- telemetry and context boundaries confirmed

Deliverables:
- TypeScript domain types
- schema version `silent-shift.v1`
- deterministic scenario fixtures
- runtime fixture validation
- Vitest setup
- fixture integrity tests
- pseudonymous entity identifiers defined for fixture and domain records

Acceptance references:
- AT-NORM-001
- AT-FIX-001

Exit criteria:
- domain contracts are implemented in TypeScript
- fixture format is frozen to `silent-shift.v1`
- fixture validation passes
- no scoring algorithm exists yet

Prohibited scope:
- dashboard redesign
- backend services
- LLM SDK installation or use
- application-shell UI migration

Rollback point:
- revert to contract-only and fixture-only state

## Milestone 2: deterministic feature extraction
Entry criteria:
- Milestone 1 complete
- fixture validation passes

Deliverables:
- deterministic feature extraction logic
- feature provenance records
- event-order and windowing rules
- feature extraction tests

Acceptance references:
- AT-FEAT-001
- AT-FEAT-PROV-001

Exit criteria:
- each derived feature is traceable to input events
- feature extraction is deterministic and inspectable

Prohibited scope:
- baseline scoring
- change-point logic based on unbounded future data
- UI redesign

Rollback point:
- pause feature extraction and revalidate event-order rules

## Milestone 3: hierarchical baselines
Entry criteria:
- Milestone 2 complete
- feature provenance validated

Deliverables:
- hierarchical personal, cohort, and resource baselines
- cold-start and sparse-history uncertainty handling
- baseline tests

Acceptance references:
- AT-BASE-PERSONAL-001
- AT-BASE-PEER-001
- AT-BASE-RESOURCE-001
- AT-BASE-RESOURCE-002
- AT-BASE-RESOURCE-003
- AT-BASE-RESOURCE-004
- AT-BASE-RESOURCE-005

Exit criteria:
- baseline coverage, quality, and uncertainty are explicit
- low-quality baselines increase uncertainty instead of risk

Prohibited scope:
- change-point detection thresholds
- UI redesign
- LLM integration

Rollback point:
- revert to feature-only baseline state and re-evaluate uncertainty rules

## Milestone 4: online change-point detection
Entry criteria:
- Milestone 3 complete
- baseline tests pass

Deliverables:
- online change-point detection logic
- temporal-leakage prevention rules
- gradual and sudden transition tests

Acceptance references:
- AT-CHANGE-001
- AT-CHANGE-002
- AT-CHANGE-003
- AT-CHANGE-004
- AT-TEMP-001

Exit criteria:
- change points are produced only under valid evidence windows
- temporal leakage is prevented

Prohibited scope:
- context matching rules that suppress raw deviation
- application-shell migration

Rollback point:
- revert to baseline-only evaluation and re-check windowing semantics

## Milestone 5: sequence correlation and evidence-item construction
Entry criteria:
- Milestone 4 complete
- change-point tests pass

Deliverables:
- sequence correlation logic
- evidence-item construction
- sequence tests

Acceptance references:
- AT-SEQ-001
- AT-EVID-001

Exit criteria:
- related behaviors are correlated without leaking future events
- every evidence item is attributable to a source event set

Prohibited scope:
- risk composition
- analyst UI
- LLM narrative layer

Rollback point:
- revert to change-point-only evaluation and revalidate sequence boundaries

## Milestone 6: context compatibility and outcomes
Entry criteria:
- Milestone 5 complete
- sequence tests pass

Deliverables:
- context compatibility engine
- EXPLAINED / PARTIALLY_EXPLAINED / UNEXPLAINED / INDETERMINATE outcome logic
- context-scope tests

Acceptance references:
- AT-CONTEXT-001

Exit criteria:
- context explains only approved portions of behavior
- unexplained residual evidence remains visible

Prohibited scope:
- classification as malicious behavior
- autonomous containment
- any UI migration before the application-shell milestone

Rollback point:
- reduce matching scope and require manual review of context rules

## Milestone 7: deterministic risk composition and explanations
Entry criteria:
- Milestone 6 complete
- context outcome tests pass

Deliverables:
- deterministic risk composition
- separate raw deviation, context coverage, residual risk, confidence, and data quality
- deterministic fallback explanation
- scoring and explanation-fidelity tests

Acceptance references:
- AT-RISK-001
- AT-EXPLAIN-001

Exit criteria:
- risk composition is deterministic and inspectable
- a fallback explanation exists without an LLM

Prohibited scope:
- installed LLM SDK requirements
- LLM narrative features

Rollback point:
- revert to context-only output and re-test risk separation

## Milestone 8: case construction and analyst workflow
Entry criteria:
- Milestone 7 complete
- deterministic scoring and explanation tests pass

Deliverables:
- case construction
- alert-budget ranking
- analyst decisions
- correction audit events
- ordering and evidence-preservation tests
- cases and audit events use pseudonymous identifiers by default

Acceptance references:
- AT-CASE-001
- AT-ALERT-001
- AT-DECIDE-001
- AT-AUDIT-001
- AT-PRIV-001

Exit criteria:
- cases are rank-ordered and evidence-backed
- analyst actions are logged and contestable

Prohibited scope:
- production retention defaults as a hard-coded guarantee
- redesign activity

Rollback point:
- revert to evidence-only case assembly and review audit behavior

## Milestone 9: evaluation harness and claim evidence
Entry criteria:
- Milestone 8 complete
- analyst workflow tests pass

Deliverables:
- evaluation harness
- benchmark reports generated from code
- claim-register evidence updates

Acceptance references:
- AT-EVAL-001
- AT-CLAIM-001

Exit criteria:
- every public claim is backed by generated code evidence or explicitly labeled as simulated/planned
- benchmark outputs are produced by implementation, not by hand-written claims

Prohibited scope:
- public performance claims without benchmark code
- unmeasured live claims

Rollback point:
- return to planned-only status until generated evidence exists

## Milestone 10: application-shell migration
Entry criteria:
- Milestone 9 complete
- evaluation harness evidence approved

Deliverables:
- application-shell migration
- overview, cases and entity views
- pseudonymized visual display
- no decorative metrics

Acceptance references:
- AT-PRIV-001
- AT-ACCESS-001

Exit criteria:
- the application shell is migrated without redesigning the product narrative
- overview, cases, and entity views are available in the approved shell

Prohibited scope:
- decorative metrics
- redesign beyond the approved shell

Rollback point:
- revert to the prior migration baseline and reapply only the approved shell scope

## Milestone 11: 2D evidence-linked Shift Graph
Entry criteria:
- Milestone 10 complete
- shell migration approved

Deliverables:
- 2D evidence-linked Shift Graph
- keyboard interaction
- reduced-motion behavior
- evidence navigation tests

Acceptance references:
- AT-SHIFT-001
- AT-ACCESS-001

Exit criteria:
- the graph presents evidence-linked temporal relationships without sacrificing precision
- keyboard and reduced-motion behavior meet the required baseline

Prohibited scope:
- 3D visual reliance for core interpretation
- decorative motion-heavy exploration

Rollback point:
- keep the design contract only and defer the graph implementation until evidence and UX requirements are re-approved

## Milestone 12: optional grounded LLM narrative layer
Entry criteria:
- Milestone 11 complete
- optional LLM milestone explicitly approved

Deliverables:
- optional grounded LLM narrative layer
- evidence-ID citations
- deterministic fallback and LLM-failure tests

Acceptance references:
- AT-LLM-FAIL-001
- AT-EXPLAIN-001

Exit criteria:
- the LLM layer is grounded only in structured evidence and cannot calculate risk or infer guilt
- failed or unavailable narratives fall back to the unchanged deterministic explanation

Prohibited scope:
- any earlier milestone requiring an installed LLM SDK
- risk calculation by the LLM
- suppression or hiding of evidence

Rollback point:
- disable the narrative layer and revert to the deterministic fallback

## Milestone 13: final accessibility, responsive, security, privacy, claim and demo audit
Entry criteria:
- all prior milestones complete
- final governance review approved

Deliverables:
- accessibility audit
- responsive behavior audit
- security and privacy review
- claim audit
- demo audit
- privacy behavior audit for pseudonymized case data

Acceptance references:
- AT-ACCESS-001
- AT-PRIV-001
- AT-CLAIM-001

Exit criteria:
- all milestone outputs are consistent with product scope, claim status, and safety constraints
- unsupported claims are excluded

Prohibited scope:
- unapproved feature claims
- unverified benchmark claims
- unapproved redesign or new dependency groups

Rollback point:
- pause release and require a governance re-audit before any public-facing claim

## Dependency rule for the first coding milestone
Vitest may be added as the only new dependency group in the first coding milestone, unless another dependency is separately justified.

## Unresolved decisions that remain open
- production retention defaults
- alert-budget value for a real deployment
- minimum benchmark performance for public claims
- whether the optional LLM milestone will be approved

A demo alert budget may be configured as fixture data, but it must not be presented as a universal threshold.
