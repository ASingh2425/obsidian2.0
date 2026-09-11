import {
  SCHEMA_VERSION,
  type ContextGrant,
  type Entity,
  type OrganizationalContextRecord,
  type Resource,
  type ScenarioFixture,
  type SecurityEvent,
  type ValidationIssue,
  type ValidationResult,
  type TelemetryDomain,
} from './types';

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const NATURAL_NAME_PATTERN = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/;

const DOMAIN_ACTIONS: Record<TelemetryDomain, readonly string[]> = {
  AUTHENTICATION: ['LOGIN', 'LOGOUT', 'MFA_CHALLENGE', 'DEVICE_CHANGE', 'SESSION_START', 'LOGIN_FAILURE'],
  FILE_RESOURCE_ACCESS: ['READ', 'WRITE', 'DOWNLOAD', 'UPLOAD', 'DELETE', 'MOVE', 'COPY'],
  PRIVILEGE_ACTIVITY: ['ROLE_CHANGE', 'GROUP_ASSIGNMENT', 'PRIVILEGE_ASSIGNMENT', 'ELEVATION', 'DELEGATION'],
};

const PSEUDONYM_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;

const compareOrdinalStrings = (left: string, right: string): number => {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
};

const isIso8601 = (value: string): boolean => {
  if (!value) {
    return false;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && value.includes('T');
};

const addIssue = (issues: ValidationIssue[], path: string, code: string, message: string): void => {
  issues.push({ path, code, message });
};

const isPseudonymous = (value: string): boolean => {
  if (!value) {
    return false;
  }

  if (EMAIL_PATTERN.test(value)) {
    return false;
  }

  if (NATURAL_NAME_PATTERN.test(value)) {
    return false;
  }

  return PSEUDONYM_PATTERN.test(value);
};

const getDuplicateIds = (items: Array<{ id?: string }>): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of items) {
    if (!item.id) {
      continue;
    }

    if (seen.has(item.id)) {
      duplicates.add(item.id);
    }

    seen.add(item.id);
  }

  return [...duplicates];
};

const ensureEntityExists = (
  entityIds: Set<string>,
  value: string | undefined,
  issues: ValidationIssue[],
  path: string,
): void => {
  if (!value) {
    return;
  }

  if (!entityIds.has(value)) {
    addIssue(issues, path, 'UNRESOLVED_ENTITY_REFERENCE', `Entity reference '${value}' was not found in the fixture.`);
  }
};

const ensureResourceExists = (
  resourceIds: Set<string>,
  value: string | undefined,
  issues: ValidationIssue[],
  path: string,
): void => {
  if (!value) {
    return;
  }

  if (!resourceIds.has(value)) {
    addIssue(issues, path, 'UNRESOLVED_RESOURCE_REFERENCE', `Resource reference '${value}' was not found in the fixture.`);
  }
};

export const validateFixtureScenario = (fixture: ScenarioFixture): ValidationResult => {
  const issues: ValidationIssue[] = [];
  const eventIds = new Set<string>();
  const entityIds = new Set<string>(fixture.entities.map((entity) => entity.id));
  const resourceIds = new Set<string>(fixture.resources.map((resource) => resource.id));

  if (!fixture || !fixture.id) {
    addIssue(issues, 'fixture', 'MISSING_ID', 'Fixture requires an id.');
    return { valid: false, issues };
  }

  if (fixture.schemaVersion !== SCHEMA_VERSION) {
    addIssue(issues, 'fixture.schemaVersion', 'INVALID_SCHEMA_VERSION', `The fixture schemaVersion must be '${SCHEMA_VERSION}'.`);
  }

  if (!fixture.metadata) {
    addIssue(issues, 'fixture.metadata', 'MISSING_METADATA', 'Fixture metadata is required.');
  } else {
    if (fixture.metadata.synthetic !== true) {
      addIssue(issues, 'fixture.metadata.synthetic', 'NON_SYNTHETIC_FIXTURE', 'Fixtures must be explicitly marked synthetic.');
    }

    if (!fixture.metadata.syntheticDisclosure || !/synthetic/i.test(fixture.metadata.syntheticDisclosure)) {
      addIssue(issues, 'fixture.metadata.syntheticDisclosure', 'MISSING_SYNTHETIC_DISCLOSURE', 'Synthetic data disclosure must be present and explicitly state that the fixture is synthetic.');
    }
  }

  for (const entity of fixture.entities) {
    if (!entity.id) {
      addIssue(issues, `entities[${fixture.entities.indexOf(entity)}].id`, 'MISSING_ID', 'Entity id is required.');
    }

    if (!entity.displayName || !isPseudonymous(entity.displayName)) {
      addIssue(issues, `entities[${fixture.entities.indexOf(entity)}].displayName`, 'RAW_IDENTITY_DATA', 'Entity display names must use pseudonymous identifiers and not human names or email addresses.');
    }

    if (entity.pseudonymizedName && !isPseudonymous(entity.pseudonymizedName)) {
      addIssue(issues, `entities[${fixture.entities.indexOf(entity)}].pseudonymizedName`, 'RAW_IDENTITY_DATA', 'Pseudonymous identifiers must not contain personal names or email addresses.');
    }
  }

  for (const resource of fixture.resources) {
    if (!resource.id) {
      addIssue(issues, `resources[${fixture.resources.indexOf(resource)}].id`, 'MISSING_ID', 'Resource id is required.');
    }

    if (!resource.resourceName || !isPseudonymous(resource.resourceName)) {
      addIssue(issues, `resources[${fixture.resources.indexOf(resource)}].resourceName`, 'RAW_IDENTITY_DATA', 'Resource names must use pseudonymous identifiers and not raw names or email addresses.');
    }
  }

  for (const duplicateId of getDuplicateIds(fixture.entities)) {
    addIssue(issues, 'entities', 'DUPLICATE_ID', `Duplicate entity id '${duplicateId}' was found.`);
  }

  for (const duplicateId of getDuplicateIds(fixture.resources)) {
    addIssue(issues, 'resources', 'DUPLICATE_ID', `Duplicate resource id '${duplicateId}' was found.`);
  }

  for (const event of fixture.events) {
    if (!event.id) {
      addIssue(issues, `events[${fixture.events.indexOf(event)}].id`, 'MISSING_ID', 'Event id is required.');
    }

    if (event.id) {
      if (eventIds.has(event.id)) {
        addIssue(issues, `events[${fixture.events.indexOf(event)}].id`, 'DUPLICATE_ID', `Duplicate event id '${event.id}' was found.`);
      }
      eventIds.add(event.id);
    }

    if (!isIso8601(event.timestamp)) {
      addIssue(issues, `events[${fixture.events.indexOf(event)}].timestamp`, 'INVALID_TIMESTAMP', `Event '${event.id}' has an invalid ISO-8601 timestamp.`);
    }

    if (!event.domain || !(event.domain in DOMAIN_ACTIONS)) {
      addIssue(issues, `events[${fixture.events.indexOf(event)}].domain`, 'UNRECOGNIZED_DOMAIN', `Event '${event.id}' has an unrecognized telemetry domain.`);
    }

    if (!event.action || !DOMAIN_ACTIONS[event.domain as TelemetryDomain]?.includes(event.action)) {
      addIssue(issues, `events[${fixture.events.indexOf(event)}].action`, 'UNRECOGNIZED_ACTION', `Event '${event.id}' has an unrecognized action for domain '${event.domain}'.`);
    }

    ensureEntityExists(entityIds, event.actorEntityId, issues, `events[${fixture.events.indexOf(event)}].actorEntityId`);
    ensureEntityExists(entityIds, event.deviceEntityId, issues, `events[${fixture.events.indexOf(event)}].deviceEntityId`);
    ensureEntityExists(entityIds, event.destinationEntityId, issues, `events[${fixture.events.indexOf(event)}].destinationEntityId`);
    ensureResourceExists(resourceIds, event.resourceId, issues, `events[${fixture.events.indexOf(event)}].resourceId`);
  }

  const sortedByTimestamp = [...fixture.events].slice().sort((left, right) => {
    const timeDelta = new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime();

    if (timeDelta !== 0) {
      return timeDelta;
    }

    return compareOrdinalStrings(left.id ?? '', right.id ?? '');
  });

  for (let index = 0; index < sortedByTimestamp.length; index += 1) {
    const expected = sortedByTimestamp[index];
    const actual = fixture.events[index];

    if (expected.id !== actual?.id || expected.timestamp !== actual?.timestamp) {
      addIssue(
        issues,
        'events',
        'UNSORTED_EVENT_ORDER',
        'Fixture events must be ordered by timestamp ascending, then by event id ascending using ordinal string comparison.',
      );
      break;
    }
  }

  for (const contextGrant of fixture.contextGrants) {
    if (!contextGrant.id) {
      addIssue(issues, `contextGrants[${fixture.contextGrants.indexOf(contextGrant)}].id`, 'MISSING_ID', 'ContextGrant id is required.');
    }

    if (!isIso8601(contextGrant.validFrom)) {
      addIssue(issues, `contextGrants[${fixture.contextGrants.indexOf(contextGrant)}].validFrom`, 'INVALID_TIMESTAMP', `ContextGrant '${contextGrant.id}' has an invalid validFrom timestamp.`);
    }

    if (!isIso8601(contextGrant.validTo)) {
      addIssue(issues, `contextGrants[${fixture.contextGrants.indexOf(contextGrant)}].validTo`, 'INVALID_TIMESTAMP', `ContextGrant '${contextGrant.id}' has an invalid validTo timestamp.`);
    }

    if (isIso8601(contextGrant.validFrom) && isIso8601(contextGrant.validTo) && new Date(contextGrant.validFrom).getTime() >= new Date(contextGrant.validTo).getTime()) {
      addIssue(issues, `contextGrants[${fixture.contextGrants.indexOf(contextGrant)}]`, 'INVALID_CONTEXT_WINDOW', `ContextGrant '${contextGrant.id}' must end after it begins.`);
    }

    ensureEntityExists(entityIds, contextGrant.actorEntityId, issues, `contextGrants[${fixture.contextGrants.indexOf(contextGrant)}].actorEntityId`);
    ensureEntityExists(entityIds, contextGrant.approvingAuthorityEntityId, issues, `contextGrants[${fixture.contextGrants.indexOf(contextGrant)}].approvingAuthorityEntityId`);

    for (const scopeId of contextGrant.resourceScope ?? []) {
      ensureResourceExists(resourceIds, scopeId, issues, `contextGrants[${fixture.contextGrants.indexOf(contextGrant)}].resourceScope`);
    }

    for (const approvedDestinationId of contextGrant.approvedDestinationIds ?? []) {
      ensureEntityExists(entityIds, approvedDestinationId, issues, `contextGrants[${fixture.contextGrants.indexOf(contextGrant)}].approvedDestinationIds`);
    }
  }

  for (const contextRecord of fixture.contextRecords) {
    if (!isIso8601(contextRecord.validFrom)) {
      addIssue(issues, `contextRecords[${fixture.contextRecords.indexOf(contextRecord)}].validFrom`, 'INVALID_TIMESTAMP', `Context record '${contextRecord.id}' has an invalid validFrom timestamp.`);
    }

    if (!isIso8601(contextRecord.validTo)) {
      addIssue(issues, `contextRecords[${fixture.contextRecords.indexOf(contextRecord)}].validTo`, 'INVALID_TIMESTAMP', `Context record '${contextRecord.id}' has an invalid validTo timestamp.`);
    }

    if (contextRecord.actorEntityId) {
      ensureEntityExists(entityIds, contextRecord.actorEntityId, issues, `contextRecords[${fixture.contextRecords.indexOf(contextRecord)}].actorEntityId`);
    }

    if (contextRecord.approvalAuthorityEntityId) {
      ensureEntityExists(entityIds, contextRecord.approvalAuthorityEntityId, issues, `contextRecords[${fixture.contextRecords.indexOf(contextRecord)}].approvalAuthorityEntityId`);
    }

    if (isIso8601(contextRecord.validFrom) && isIso8601(contextRecord.validTo) && new Date(contextRecord.validFrom).getTime() >= new Date(contextRecord.validTo).getTime()) {
      addIssue(issues, `contextRecords[${fixture.contextRecords.indexOf(contextRecord)}]`, 'INVALID_CONTEXT_WINDOW', `Context record '${contextRecord.id}' must end after it begins.`);
    }
  }

  const allIdContainers: Array<{ id?: string }> = [
    ...fixture.entities,
    ...fixture.resources,
    ...fixture.events,
    ...fixture.contextGrants,
    ...fixture.contextRecords,
  ];

  const duplicateIdSet = new Set<string>();
  for (const item of allIdContainers) {
    if (!item.id) {
      continue;
    }
    if (duplicateIdSet.has(item.id)) {
      addIssue(issues, 'fixture', 'DUPLICATE_ID', `Duplicate id '${item.id}' appears across fixture collections.`);
    }
    duplicateIdSet.add(item.id);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
};

export const validateFixtureSet = (fixtures: ScenarioFixture[]): ValidationResult[] => {
  return fixtures.map((fixture) => validateFixtureScenario(fixture));
};

export const isSyntheticScenario = (fixture: ScenarioFixture): boolean => fixture.metadata.synthetic === true && /synthetic/i.test(fixture.metadata.syntheticDisclosure ?? '');

export type StructuredValidationError = ValidationIssue;
