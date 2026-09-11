import { describe, expect, it } from 'vitest';

import { SCHEMA_VERSION, type ScenarioFixture } from '../domain/types';
import { validateFixtureScenario, validateFixtureSet } from '../domain/validation';
import { fixtureScenarios } from './scenarios';

const findIssue = (result: ReturnType<typeof validateFixtureScenario>, code: string, pathContains?: string) =>
  result.issues.find(
    (issue) => issue.code === code && (!pathContains || issue.path.includes(pathContains)),
  );

describe('Milestone 1 fixture validation', () => {
  it('accepts all three synthetic fixtures', () => {
    const results = validateFixtureSet(fixtureScenarios);

    expect(results.every((result) => result.valid)).toBe(true);
  });

  it('enforces the schema version exactly as silent-shift.v1', () => {
    const fixture = structuredClone(fixtureScenarios[0]);
    fixture.schemaVersion = 'wrong-version' as ScenarioFixture['schemaVersion'];

    const result = validateFixtureScenario(fixture);
    const issue = findIssue(result, 'INVALID_SCHEMA_VERSION', 'schemaVersion');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'INVALID_SCHEMA_VERSION',
      path: 'fixture.schemaVersion',
    });
    expect(issue?.message).toContain('silent-shift.v1');
  });

  it('keeps deterministic fixture behavior for identical input', () => {
    const first = structuredClone(fixtureScenarios[0]);
    const second = structuredClone(fixtureScenarios[0]);

    expect(validateFixtureScenario(first)).toEqual(validateFixtureScenario(second));
    expect(first.schemaVersion).toBe(SCHEMA_VERSION);
    expect(second.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('accepts equal timestamps when event IDs are in ascending order', () => {
    const fixture = structuredClone(fixtureScenarios[0]);
    fixture.events = [
      { ...fixture.events[0], id: 'event-a', timestamp: '2024-04-01T08:00:00Z' },
      { ...fixture.events[1], id: 'event-b', timestamp: '2024-04-01T08:00:00Z' },
      { ...fixture.events[2], id: 'event-c', timestamp: '2024-04-01T08:02:00Z' },
    ];

    const result = validateFixtureScenario(fixture);

    expect(result.valid).toBe(true);
    expect(findIssue(result, 'UNSORTED_EVENT_ORDER')).toBeUndefined();
  });

  it('rejects equal timestamps when event IDs are reversed', () => {
    const fixture = structuredClone(fixtureScenarios[0]);
    fixture.events = [
      { ...fixture.events[0], id: 'event-b', timestamp: '2024-04-01T08:00:00Z' },
      { ...fixture.events[1], id: 'event-a', timestamp: '2024-04-01T08:00:00Z' },
      { ...fixture.events[2], id: 'event-c', timestamp: '2024-04-01T08:02:00Z' },
    ];

    const result = validateFixtureScenario(fixture);
    const issue = findIssue(result, 'UNSORTED_EVENT_ORDER', 'events');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'UNSORTED_EVENT_ORDER',
      path: 'events',
    });
    expect(issue?.message).toContain('timestamp');
    expect(issue?.message).toContain('event id');
  });

  it('rejects unsorted event timestamps in ascending order', () => {
    const fixture = structuredClone(fixtureScenarios[0]);
    const [first, second] = fixture.events;
    fixture.events = [second, first];

    const result = validateFixtureScenario(fixture);
    const issue = findIssue(result, 'UNSORTED_EVENT_ORDER', 'events');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'UNSORTED_EVENT_ORDER',
      path: 'events',
    });
    expect(issue?.message).toContain('timestamp');
  });

  it('rejects missing fixture ids with a structured error', () => {
    const fixture = structuredClone(fixtureScenarios[0]) as ScenarioFixture & { id?: string };
    // Deliberate test-only cast to simulate invalid runtime data that TypeScript would otherwise reject.
    fixture.id = undefined as unknown as string;

    const result = validateFixtureScenario(fixture);
    const issue = findIssue(result, 'MISSING_ID', 'fixture');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'MISSING_ID',
      path: 'fixture',
    });
    expect(issue?.message).toContain('id');
  });

  it('rejects missing event ids with a structured error', () => {
    const fixture = structuredClone(fixtureScenarios[1]) as ScenarioFixture & { events: Array<{ id?: string }> };
    // Deliberate test-only cast to simulate invalid runtime data that TypeScript would otherwise reject.
    fixture.events[0].id = undefined as unknown as string;

    const result = validateFixtureScenario(fixture as unknown as ScenarioFixture);
    const issue = findIssue(result, 'MISSING_ID', 'events[0].id');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'MISSING_ID',
      path: 'events[0].id',
    });
    expect(issue?.message).toContain('Event id');
  });

  it('rejects missing entity ids with a structured error', () => {
    const fixture = structuredClone(fixtureScenarios[2]) as ScenarioFixture & { entities: Array<{ id?: string }> };
    // Deliberate test-only cast to simulate invalid runtime data that TypeScript would otherwise reject.
    fixture.entities[0].id = undefined as unknown as string;

    const result = validateFixtureScenario(fixture as unknown as ScenarioFixture);
    const issue = findIssue(result, 'MISSING_ID', 'entities[0].id');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'MISSING_ID',
      path: 'entities[0].id',
    });
    expect(issue?.message).toContain('Entity id');
  });

  it('rejects missing resource ids with a structured error', () => {
    const fixture = structuredClone(fixtureScenarios[2]) as ScenarioFixture & { resources: Array<{ id?: string }> };
    // Deliberate test-only cast to simulate invalid runtime data that TypeScript would otherwise reject.
    fixture.resources[0].id = undefined as unknown as string;

    const result = validateFixtureScenario(fixture as unknown as ScenarioFixture);
    const issue = findIssue(result, 'MISSING_ID', 'resources[0].id');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'MISSING_ID',
      path: 'resources[0].id',
    });
    expect(issue?.message).toContain('Resource id');
  });

  it('rejects missing context-grant ids with a structured error', () => {
    const fixture = structuredClone(fixtureScenarios[0]) as ScenarioFixture & { contextGrants: Array<{ id?: string }> };
    // Deliberate test-only cast to simulate invalid runtime data that TypeScript would otherwise reject.
    fixture.contextGrants[0].id = undefined as unknown as string;

    const result = validateFixtureScenario(fixture as unknown as ScenarioFixture);
    const issue = findIssue(result, 'MISSING_ID', 'contextGrants[0].id');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'MISSING_ID',
      path: 'contextGrants[0].id',
    });
    expect(issue?.message).toContain('ContextGrant id');
  });

  it('rejects duplicate entity ids with a structured error', () => {
    const fixture = structuredClone(fixtureScenarios[1]);
    fixture.entities[0].id = fixture.entities[1].id;

    const result = validateFixtureScenario(fixture);
    const issue = findIssue(result, 'DUPLICATE_ID', 'entities');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'DUPLICATE_ID',
      path: 'entities',
    });
    expect(issue?.message).toContain('Duplicate entity id');
  });

  it('rejects duplicate context-grant ids with a structured error', () => {
    const fixture = structuredClone(fixtureScenarios[0]);
    fixture.contextGrants[0].id = fixture.contextGrants[0].id;
    fixture.contextGrants.push({ ...fixture.contextGrants[0], id: fixture.contextGrants[0].id });

    const result = validateFixtureScenario(fixture);
    const issue = findIssue(result, 'DUPLICATE_ID', 'fixture');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'DUPLICATE_ID',
      path: 'fixture',
    });
    expect(issue?.message).toContain('Duplicate id');
  });

  it('rejects unknown telemetry domains at runtime', () => {
    const fixture = structuredClone(fixtureScenarios[0]) as ScenarioFixture & { events: Array<{ domain: string }> };
    // Deliberate test-only cast to simulate invalid runtime data that TypeScript would otherwise reject.
    fixture.events[0].domain = 'UNKNOWN_DOMAIN' as unknown as ScenarioFixture['events'][number]['domain'];

    const result = validateFixtureScenario(fixture as unknown as ScenarioFixture);
    const issue = findIssue(result, 'UNRECOGNIZED_DOMAIN', 'events[0].domain');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'UNRECOGNIZED_DOMAIN',
      path: 'events[0].domain',
    });
    expect(issue?.message).toContain('telemetry domain');
  });

  it('rejects unknown actions at runtime', () => {
    const fixture = structuredClone(fixtureScenarios[0]) as ScenarioFixture & { events: Array<{ domain: string; action: string }> };
    // Deliberate test-only cast to simulate invalid runtime data that TypeScript would otherwise reject.
    fixture.events[0].domain = 'AUTHENTICATION';
    fixture.events[0].action = 'UNKNOWN_ACTION' as unknown as string;

    const result = validateFixtureScenario(fixture as unknown as ScenarioFixture);
    const issue = findIssue(result, 'UNRECOGNIZED_ACTION', 'events[0].action');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'UNRECOGNIZED_ACTION',
      path: 'events[0].action',
    });
    expect(issue?.message).toContain('unrecognized action');
  });

  it('rejects unresolved context actor references', () => {
    const fixture = structuredClone(fixtureScenarios[0]);
    fixture.contextGrants[0].actorEntityId = 'entity-does-not-exist';

    const result = validateFixtureScenario(fixture);
    const issue = findIssue(result, 'UNRESOLVED_ENTITY_REFERENCE', 'contextGrants[0].actorEntityId');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'UNRESOLVED_ENTITY_REFERENCE',
      path: 'contextGrants[0].actorEntityId',
    });
    expect(issue?.message).toContain('Entity reference');
  });

  it('rejects unresolved context resource references', () => {
    const fixture = structuredClone(fixtureScenarios[0]);
    fixture.contextGrants[0].resourceScope = ['resource-does-not-exist'];

    const result = validateFixtureScenario(fixture);
    const issue = findIssue(result, 'UNRESOLVED_RESOURCE_REFERENCE', 'contextGrants[0].resourceScope');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'UNRESOLVED_RESOURCE_REFERENCE',
      path: 'contextGrants[0].resourceScope',
    });
    expect(issue?.message).toContain('Resource reference');
  });

  it('rejects unresolved approved destination entity references', () => {
    const fixture = structuredClone(fixtureScenarios[0]);
    fixture.contextGrants[0].approvedDestinationIds = ['entity-does-not-exist'];

    const result = validateFixtureScenario(fixture);
    const issue = findIssue(result, 'UNRESOLVED_ENTITY_REFERENCE', 'contextGrants[0].approvedDestinationIds');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'UNRESOLVED_ENTITY_REFERENCE',
      path: 'contextGrants[0].approvedDestinationIds',
    });
    expect(issue?.message).toContain('Entity reference');
  });

  it('rejects unresolved approving-authority entity references', () => {
    const fixture = structuredClone(fixtureScenarios[0]);
    fixture.contextGrants[0].approvingAuthorityEntityId = 'entity-does-not-exist';

    const result = validateFixtureScenario(fixture);
    const issue = findIssue(result, 'UNRESOLVED_ENTITY_REFERENCE', 'contextGrants[0].approvingAuthorityEntityId');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'UNRESOLVED_ENTITY_REFERENCE',
      path: 'contextGrants[0].approvingAuthorityEntityId',
    });
    expect(issue?.message).toContain('Entity reference');
  });

  it('rejects unresolved device entity references', () => {
    const fixture = structuredClone(fixtureScenarios[0]);
    fixture.events[0].deviceEntityId = 'entity-does-not-exist';

    const result = validateFixtureScenario(fixture);
    const issue = findIssue(result, 'UNRESOLVED_ENTITY_REFERENCE', 'events[0].deviceEntityId');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'UNRESOLVED_ENTITY_REFERENCE',
      path: 'events[0].deviceEntityId',
    });
    expect(issue?.message).toContain('Entity reference');
  });

  it('rejects unresolved destination entity references on security events', () => {
    const fixture = structuredClone(fixtureScenarios[0]);
    fixture.events[0].destinationEntityId = 'entity-does-not-exist';

    const result = validateFixtureScenario(fixture);
    const issue = findIssue(result, 'UNRESOLVED_ENTITY_REFERENCE', 'events[0].destinationEntityId');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'UNRESOLVED_ENTITY_REFERENCE',
      path: 'events[0].destinationEntityId',
    });
    expect(issue?.message).toContain('Entity reference');
  });

  it('rejects duplicate ids with a structured error', () => {
    const fixture = structuredClone(fixtureScenarios[1]);
    fixture.resources[0].id = fixture.resources[1].id;

    const result = validateFixtureScenario(fixture);
    const issue = findIssue(result, 'DUPLICATE_ID', 'resources');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'DUPLICATE_ID',
      path: 'resources',
    });
    expect(issue?.message).toContain('Duplicate resource id');
  });

  it('rejects unresolved entity reference ids', () => {
    const fixture = structuredClone(fixtureScenarios[2]);
    fixture.events[0].actorEntityId = 'entity-does-not-exist';

    const result = validateFixtureScenario(fixture);
    const issue = findIssue(result, 'UNRESOLVED_ENTITY_REFERENCE', 'events[0].actorEntityId');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'UNRESOLVED_ENTITY_REFERENCE',
      path: 'events[0].actorEntityId',
    });
    expect(issue?.message).toContain('Entity reference');
  });

  it('rejects unresolved resource reference ids', () => {
    const fixture = structuredClone(fixtureScenarios[2]);
    fixture.events[0].resourceId = 'resource-does-not-exist';

    const result = validateFixtureScenario(fixture);
    const issue = findIssue(result, 'UNRESOLVED_RESOURCE_REFERENCE', 'events[0].resourceId');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'UNRESOLVED_RESOURCE_REFERENCE',
      path: 'events[0].resourceId',
    });
    expect(issue?.message).toContain('Resource reference');
  });

  it('rejects invalid timestamps', () => {
    const fixture = structuredClone(fixtureScenarios[0]);
    fixture.events[0].timestamp = 'not-a-timestamp';

    const result = validateFixtureScenario(fixture);
    const issue = findIssue(result, 'INVALID_TIMESTAMP', 'events[0].timestamp');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'INVALID_TIMESTAMP',
      path: 'events[0].timestamp',
    });
    expect(issue?.message).toContain('invalid ISO-8601');
  });

  it('rejects invalid context windows', () => {
    const fixture = structuredClone(fixtureScenarios[0]);
    fixture.contextGrants[0].validFrom = '2024-05-10T00:00:00Z';
    fixture.contextGrants[0].validTo = '2024-05-01T00:00:00Z';

    const result = validateFixtureScenario(fixture);
    const issue = findIssue(result, 'INVALID_CONTEXT_WINDOW', 'contextGrants[0]');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'INVALID_CONTEXT_WINDOW',
      path: 'contextGrants[0]',
    });
    expect(issue?.message).toContain('end after it begins');
  });

  it('rejects fixtures that are not disclosed as synthetic data', () => {
    const fixture = structuredClone(fixtureScenarios[0]);
    fixture.metadata.synthetic = false;
    fixture.metadata.syntheticDisclosure = 'Internal test data';

    const result = validateFixtureScenario(fixture);
    const issue = findIssue(result, 'NON_SYNTHETIC_FIXTURE', 'fixture.metadata.synthetic');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'NON_SYNTHETIC_FIXTURE',
      path: 'fixture.metadata.synthetic',
    });
    expect(issue?.message).toContain('synthetic');
  });

  it('rejects raw personal names or emails in pseudonymous identity fields', () => {
    const fixture = structuredClone(fixtureScenarios[1]);
    fixture.entities[0].displayName = 'John Smith';

    const result = validateFixtureScenario(fixture);
    const issue = findIssue(result, 'RAW_IDENTITY_DATA', 'entities[0].displayName');

    expect(result.valid).toBe(false);
    expect(issue).toMatchObject({
      code: 'RAW_IDENTITY_DATA',
      path: 'entities[0].displayName',
    });
    expect(issue?.message).toContain('pseudonymous');
  });
});
