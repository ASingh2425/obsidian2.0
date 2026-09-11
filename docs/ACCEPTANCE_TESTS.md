# ACCEPTANCE_TESTS.md

## Purpose
This document is the single authoritative source for Silent Shift acceptance tests. The tests are designed for the deterministic domain engine and fixture-based prototype. They do not claim benchmark outcomes or live integration.

## General rules
- Tests must verify determinism, evidence linkage, uncertainty handling, and explicit ordering rules.
- All risk scores must be traceable to underlying evidence and calculation metadata.
- No test may assert malicious intent or guilt.
- Failures must be documented as evidence gaps, context mismatches, or unexpected scoring behavior.
- Context outcome states are defined as EXPLAINED, PARTIALLY_EXPLAINED, UNEXPLAINED, and INDETERMINATE without arbitrary percentage thresholds.
- Event ordering is defined before evaluation. A later event cannot affect an earlier detection result.
- Missing time windows may produce INDETERMINATE when the evaluation lacks sufficient coverage.

## Acceptance test map for Milestone 3

- AT-BASE-PERSONAL-001: personal actor filtering, cutoff semantics, invalid numeric values, minimum threshold behavior, canonical ordering, and immutability
- AT-BASE-PEER-001: peer weighting, cohort validation, unresolved/known-zero semantics, duplicate-member handling, and provenance integrity
- AT-BASE-RESOURCE-001: exact resource matching, cutoff exclusion, missing resource semantics, and resource anomaly threshold behavior
- AT-BASE-RESOURCE-002: multi-actor resource contribution isolation and exact entity/resource boundaries
- AT-BASE-RESOURCE-003: exact historical cutoff and future-event exclusion
- AT-BASE-RESOURCE-004: unavailable baseline representation and threshold insufficiency
- AT-BASE-RESOURCE-005: deterministic identical-input behavior

## Acceptance tests

### AT-NORM-001: Event normalization preserves behavioral telemetry and keeps context separate
Given a fixture set containing authentication, file/resource access, and privilege events plus organizational context records
When the system normalizes the input
Then the behavioral telemetry is retained as telemetry
And the organizational context records remain separate from behavioral telemetry
And the event stream preserves event ordering and source metadata

### AT-FIX-001: Fixture validation rejects invalid or structurally inconsistent fixtures
Given a fixture payload with missing identifiers, invalid timestamps, inconsistent schemaVersion, or invalid event ordering
When the system validates the fixture set
Then the fixture is rejected
And the system reports the validation failure with the exact violation

### AT-FEAT-001: Feature extraction produces deterministic features from ordered input
Given an ordered sequence of normalized telemetry events with stable window boundaries
When the system extracts features
Then the same input produces the same feature values
And each extracted feature is traceable to the input event set

### AT-FEAT-PROV-001: Feature provenance ties each derived feature to source events
Given a derived feature produced from multiple telemetry events
When the system records provenance
Then the feature references the exact source events used to calculate it
And no feature is recorded without provenance

### AT-BASE-PERSONAL-001: Personal baseline identifies repeated user behavior without cross-entity contamination
Given a user with repeated resource access and privilege patterns over time
When the personal baseline is computed
Then those patterns are treated as the user’s baseline
And the baseline does not incorporate another entity’s history

### AT-BASE-PEER-001: Peer baseline supports a cohort comparison without entity leakage
Given two users in the same peer cohort with different histories
When the peer baseline is computed
Then the cohort baseline reflects cohort behavior only
And one entity’s history does not affect another entity’s peer baseline result

### AT-BASE-RESOURCE-001: Previously common resource interaction has lower novelty than an unseen resource under otherwise identical input
Given the same user and same baseline quality with one common resource versus one unseen resource
When novelty is evaluated
Then the unseen resource yields higher novelty than the previously common resource
And the result is not reversed by a different entity or unrelated event stream

### AT-BASE-RESOURCE-002: One entity’s resource history cannot affect another entity
Given two entities with different resource histories under otherwise identical conditions
When the resource baseline is computed
Then each entity’s resource baseline remains isolated from the other entity’s history
And the novelty score for entity A cannot be derived from entity B’s resource activity

### AT-BASE-RESOURCE-003: Future events cannot influence a historical resource baseline
Given a resource baseline computed for an earlier window
When a future event occurs after the window closes
Then the earlier baseline remains unchanged
And the future event cannot retroactively alter the historical resource baseline

### AT-BASE-RESOURCE-004: Sparse resource history increases uncertainty
Given a user with few resource interactions and a narrow history window
When the resource baseline is evaluated
Then the uncertainty increases
And the result is not treated as a confident anomaly without supporting evidence

### AT-BASE-RESOURCE-005: Identical ordered input produces identical output
Given the same ordered resource interaction sequence under identical conditions
When the resource baseline is recomputed
Then the output is identical
And the same novelty and uncertainty values are produced

### AT-CHANGE-001: Sustained sudden deviation produces a change point
Given a sustained deviation that remains outside the expected profile across multiple relevant windows
When the system evaluates the sequence
Then a change point is produced
And it is linked to the relevant evidence IDs

### AT-CHANGE-002: Stable behavior produces no change point
Given a sequence of repeated behavioral events within the expected range and within stable windows
When the system evaluates the sequence
Then no change point is produced
And no transition is marked

### AT-CHANGE-003: A single isolated spike does not automatically establish a transition
Given a single large value or brief spike without continued evidence across the observation window
When the system evaluates the event stream
Then no transition is established solely by that spike
And the result remains stable unless corroborating evidence accumulates

### AT-CHANGE-004: Gradual drift is detected after sufficient accumulated evidence
Given gradual drift across several windows that exceeds the expected baseline over time
When the system evaluates the cumulative evidence
Then a change point is eventually produced
And the result is based on accumulated evidence rather than a single event

### AT-TEMP-001: Temporal leakage prevention blocks future influence on earlier detection results
Given a detection decision for a time window that closed earlier
When a later event occurs after that window
Then the earlier detection result remains unchanged
And the system uses event ordering and closed-window semantics

### AT-SEQ-001: Sequence correlation groups related events only within valid ordering
Given a sequence of timed events with a valid ordering relationship
When the system correlates related events
Then the sequence is grouped only in the correct time order
And unordered or future-leaning events are excluded from the correlation result

### AT-EVID-001: Evidence linkage preserves traceable source references
Given a change point, risk score, or context match
When the system constructs evidence items
Then each item references the exact source event IDs and related evidence IDs
And the evidence chain remains traceable end-to-end

### AT-CONTEXT-001: Context compatibility resolves EXPLAINED, PARTIALLY_EXPLAINED, UNEXPLAINED, and INDETERMINATE outcomes
Given a legitimate transition, a partially legitimate transition, an unexplained transition, and a missing-context scenario
When the system evaluates context compatibility
Then the context outcome matches the supported state for each scenario
And the raw deviation remains visible in the case record

### AT-RISK-001: Risk composition keeps raw deviation, context coverage, residual risk, confidence and data quality distinct
Given a case with raw deviation and context coverage results
When the system computes risk
Then the rawDeviation, contextCoverage, residualRisk, confidence, and dataQuality fields remain separate
And the residual risk reflects only unexplained behavior

### AT-EXPLAIN-001: Deterministic explanation generation returns the same evidence-linked explanation for identical input without calling an LLM
Given a structured evidence set and stable evaluation rules
When the explanation generator is run twice with identical input
Then the exact same evidence-linked explanation is returned
And no LLM is called

### AT-CASE-001: Case construction aggregates evidence, risk and decisions without losing prior history
Given a related set of events, context matches, and risk results
When the system constructs an investigation case
Then the case contains the relevant evidence IDs, risk object, and decision history
And prior raw evidence remains visible

### AT-ALERT-001: Alert-budget ranking is deterministic and evidence-backed
Given multiple candidate cases with different raw deviation, context coverage, and residual risk
When the cases are ranked for analyst review
Then the ordering reflects residual risk and evidence strength
And the ranking is deterministic for identical input

### AT-DECIDE-001: Analyst decisions are captured and logged with evidence references
Given a case reviewed by an analyst
When the analyst selects a decision
Then the decision is stored with the case and evidence IDs
And the rationale is retained in the case record

### AT-AUDIT-001: Audit correction preserves historical raw evidence while recording the correction
Given a context correction is proposed after initial review
When the analyst records the correction
Then the original raw evidence remains present in the historical record
And a correction audit event is created without deleting historical raw deviation data

### AT-PRIV-001: Case and audit data use pseudonymous identifiers by default
Given a case or audit record is created
When the system stores or displays the record
Then the record uses pseudonymous identifiers by default
And direct raw names are not surfaced unless explicitly permitted by governance policy

### AT-ACCESS-001: Application accessibility remains keyboard-accessible and motion-safe
Given a user with a keyboard and reduced-motion preference
When the system is navigated
Then primary review controls remain operable
And motion-heavy behavior is reduced or removed without losing clarity

### AT-SHIFT-001: Shift Graph evidence navigation links each graph element to evidence
Given a Shift Graph element representing a user, device, resource, privilege, destination, or event sequence
When the analyst navigates the graph
Then each element links to the underlying evidence and case metadata
And the graph does not obscure exact values or evidence

### AT-EVAL-001: Evaluation report generation produces benchmark output from code
Given a configured evaluation run for the deterministic engine
When the report is generated
Then the output is produced from implementation code and fixture data
And no public claim is accepted without traceable calculation and source data

### AT-CLAIM-001: Claim gating rejects unsupported public claims without evidence
Given a claim that lacks implementation, source data, or benchmark evidence
When the claim is evaluated against the product register
Then the claim is rejected or labeled as simulated, planned, or experimental
And no unsupported public claim is accepted as implemented

### AT-LLM-FAIL-001: Narrative LLM failure fallback rejects invalid narrative and returns the unchanged deterministic explanation
Given a configured narrative LLM that is unavailable, times out, or returns an invalid evidence reference
When the system attempts to generate a narrative summary
Then the narrative is rejected
And the system returns the unchanged deterministic Milestone 7 explanation instead

## Additional requirements
- Milestone 1 defines pseudonymous entity identifiers.
- Milestone 8 ensures cases and audit events use pseudonymous identifiers by default.
- Milestone 10 implements pseudonymized visual display.
- Milestone 13 audits privacy behavior.
- Deterministic explanation generation is distinct from LLM failure handling.
- LLM failure behavior is tested only in Milestone 12.
- No earlier milestone may require an installed LLM SDK.
