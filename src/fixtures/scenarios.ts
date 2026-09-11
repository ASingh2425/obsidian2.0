import {
  SCHEMA_VERSION,
  type ContextGrant,
  type ContextMatch,
  type Entity,
  type OrganizationalContextRecord,
  type Resource,
  type ScenarioFixture,
  type SecurityEvent,
} from '../domain/types';

const entity = (id: string, entityType: Entity['entityType'], displayName: string): Entity => ({
  id,
  entityType,
  tenantId: 'tenant-silent-shift',
  displayName,
  pseudonymizedName: displayName,
  attributes: {
    synthetic: true,
  },
});

const resource = (id: string, resourceType: Resource['resourceType'], resourceName: string): Resource => ({
  id,
  resourceType,
  resourceName,
});

const contextGrant = (
  id: string,
  actorEntityId: string,
  validFrom: string,
  validTo: string,
  resourceScope: string[],
  actionScope: string[],
  rationale: string,
): ContextGrant => ({
  id,
  schemaVersion: SCHEMA_VERSION,
  actorEntityId,
  validFrom,
  validTo,
  resourceScope,
  actionScope,
  expectedVolume: 200,
  approvingAuthorityEntityId: 'entity-role-ops-admin',
  rationale,
  sourceEvidenceIds: [`source-${id}-ctx-001`],
});

const contextRecord = (
  id: string,
  recordType: OrganizationalContextRecord['recordType'],
  actorEntityId: string,
  validFrom: string,
  validTo: string,
  rationale: string,
): OrganizationalContextRecord => ({
  id,
  schemaVersion: SCHEMA_VERSION,
  actorEntityId,
  recordType,
  validFrom,
  validTo,
  approvalAuthorityEntityId: 'entity-role-ops-admin',
  rationale,
  sourceEvidenceIds: [`source-${id}-record-001`],
});

const event = (
  id: string,
  actorEntityId: string,
  timestamp: string,
  domain: SecurityEvent['domain'],
  eventType: string,
  action: string,
  resourceId?: string,
  destinationEntityId?: string,
  deviceEntityId?: string,
  priorPrivilege?: string,
  newPrivilege?: string,
  observedVolume?: number,
): SecurityEvent => ({
  id,
  schemaVersion: SCHEMA_VERSION,
  actorEntityId,
  timestamp,
  domain,
  eventType,
  source: 'SYNTHETIC_REPLAY_FIXTURE',
  resourceId,
  destinationEntityId,
  deviceEntityId,
  priorPrivilege,
  newPrivilege,
  action,
  observedVolume,
  outcome: 'SUCCESS',
  rawMetadata: {
    synthetic: true,
  },
});

const contextMatch = (
  id: string,
  contextGrantId: string,
  changePointId: string,
  matchedEvidenceIds: string[],
  unmatchedEvidenceIds: string[],
  outcome: ContextMatch['outcome'],
  notes: string,
): ContextMatch => ({
  id,
  schemaVersion: SCHEMA_VERSION,
  contextGrantId,
  changePointId,
  matchedEvidenceIds,
  unmatchedEvidenceIds,
  outcome,
  notes,
});

const legitimateRoleChangeFixture: ScenarioFixture = {
  id: 'fixture-legitimate-role-change',
  schemaVersion: SCHEMA_VERSION,
  metadata: {
    name: 'legitimate-role-change',
    category: 'ROLE_CHANGE',
    synthetic: true,
    syntheticDisclosure: 'This fixture is synthetic and intended only for Milestone 1 validation.',
    expectedClassification: 'EXPLAINED',
    notes: 'Approved operational role change with matching context evidence.',
  },
  entities: [
    entity('entity-admin-user', 'USER', 'USER-OPS-ADMIN'),
    entity('entity-role-ops-admin', 'ROLE', 'ROLE-OPS-ADMIN'),
    entity('entity-device-laptop-01', 'DEVICE', 'DEVICE-OPS-LAPTOP-01'),
    entity('entity-project-migration', 'GROUP', 'GROUP-MIGRATION'),
  ],
  resources: [
    resource('resource-data-archive', 'DB', 'RESOURCE-DATA-ARCHIVE'),
    resource('resource-docs-ops', 'FOLDER', 'RESOURCE-DOCS-OPS'),
  ],
  contextRecords: [
    contextRecord(
      'context-record-role-change',
      'ROLE_CHANGE',
      'entity-admin-user',
      '2024-04-01T00:00:00Z',
      '2024-04-30T23:59:59Z',
      'Approved transition to operations admin role.',
    ),
  ],
  contextGrants: [
    contextGrant(
      'context-grant-role-change',
      'entity-admin-user',
      '2024-04-01T00:00:00Z',
      '2024-04-30T23:59:59Z',
      ['resource-data-archive', 'resource-docs-ops'],
      ['ROLE_CHANGE', 'READ', 'WRITE'],
      'Approval for role transition and archive access during migration.',
    ),
  ],
  contextMatches: [
    contextMatch(
      'context-match-role-change',
      'context-grant-role-change',
      'change-point-role-change',
      ['event-role-login-001', 'event-role-login-003'],
      [],
      'EXPLAINED',
      'Approved role change covers the observed access pattern.',
    ),
  ],
  events: [
    event('event-role-login-001', 'entity-admin-user', '2024-04-01T08:00:00Z', 'AUTHENTICATION', 'LOGIN', 'LOGIN', undefined, 'entity-device-laptop-01', 'entity-device-laptop-01'),
    event('event-role-change-002', 'entity-admin-user', '2024-04-01T08:10:00Z', 'PRIVILEGE_ACTIVITY', 'ROLE_CHANGE', 'ROLE_CHANGE', undefined, undefined, 'entity-device-laptop-01', 'ROLE-STD', 'ROLE-OPS-ADMIN', 1),
    event('event-role-read-003', 'entity-admin-user', '2024-04-01T08:12:00Z', 'FILE_RESOURCE_ACCESS', 'RESOURCE_ACCESS', 'READ', 'resource-data-archive', 'entity-project-migration', 'entity-device-laptop-01', 'ROLE-OPS-ADMIN', 'ROLE-OPS-ADMIN', 120),
  ],
};

const compromisedAccountFixture: ScenarioFixture = {
  id: 'fixture-compromised-account',
  schemaVersion: SCHEMA_VERSION,
  metadata: {
    name: 'compromised-account',
    category: 'ACCOUNT_COMPROMISE',
    synthetic: true,
    syntheticDisclosure: 'This fixture is synthetic and intended only for Milestone 1 validation.',
    expectedClassification: 'UNEXPLAINED',
    notes: 'Critical suspicious behavior without matching context or approval.',
  },
  entities: [
    entity('entity-user-suspicious', 'USER', 'USER-ALPHA-07'),
    entity('entity-role-ops-admin', 'ROLE', 'ROLE-OPS-ADMIN'),
    entity('entity-device-new-01', 'DEVICE', 'DEVICE-NEW-01'),
    entity('entity-resource-finance', 'RESOURCE', 'RESOURCE-FINANCE-ARCHIVE'),
    entity('entity-resource-hr', 'RESOURCE', 'RESOURCE-HR-LIST'),
    entity('entity-destination-external', 'DESTINATION', 'DESTINATION-EXTERNAL-01'),
  ],
  resources: [
    resource('resource-finance-archive', 'DB', 'RESOURCE-FINANCE-ARCHIVE'),
    resource('resource-hr-list', 'FILE', 'RESOURCE-HR-LIST'),
  ],
  contextRecords: [
    contextRecord(
      'context-record-unknown',
      'TEMPORARY_ACCESS_GRANT',
      'entity-user-suspicious',
      '2024-05-01T00:00:00Z',
      '2024-05-05T00:00:00Z',
      'Grant exists but does not apply to the observed external export.',
    ),
  ],
  contextGrants: [
    contextGrant(
      'context-grant-expired',
      'entity-user-suspicious',
      '2024-05-06T00:00:00Z',
      '2024-05-07T00:00:00Z',
      ['resource-finance-archive'],
      ['READ'],
      'Expired grant should not cover this activity.',
    ),
  ],
  contextMatches: [
    contextMatch(
      'context-match-expired',
      'context-grant-expired',
      'change-point-compromised',
      [],
      ['event-login-new-device-001'],
      'UNEXPLAINED',
      'The grant is outside the time range and cannot explain the observed access.',
    ),
  ],
  events: [
    event('event-login-new-device-001', 'entity-user-suspicious', '2024-05-08T22:50:00Z', 'AUTHENTICATION', 'LOGIN', 'LOGIN', undefined, 'entity-device-new-01', 'entity-device-new-01'),
    event('event-privilege-elevate-002', 'entity-user-suspicious', '2024-05-08T22:55:00Z', 'PRIVILEGE_ACTIVITY', 'PRIVILEGE_CHANGE', 'ELEVATION', undefined, undefined, 'entity-device-new-01', 'USER-STD', 'USER-ADMIN', 1),
    event('event-resource-read-003', 'entity-user-suspicious', '2024-05-08T22:58:00Z', 'FILE_RESOURCE_ACCESS', 'RESOURCE_ACCESS', 'READ', 'resource-finance-archive', 'entity-resource-finance', 'entity-device-new-01', 'USER-ADMIN', 'USER-ADMIN', 180),
    event('event-resource-download-004', 'entity-user-suspicious', '2024-05-08T23:00:00Z', 'FILE_RESOURCE_ACCESS', 'RESOURCE_ACCESS', 'DOWNLOAD', 'resource-hr-list', 'entity-destination-external', 'entity-device-new-01', 'USER-ADMIN', 'USER-ADMIN', 3200),
  ],
};

const partiallyLegitimateMigrationFixture: ScenarioFixture = {
  id: 'fixture-partially-legitimate-migration',
  schemaVersion: SCHEMA_VERSION,
  metadata: {
    name: 'partially-legitimate-migration',
    category: 'MIGRATION',
    synthetic: true,
    syntheticDisclosure: 'This fixture is synthetic and intended only for Milestone 1 validation.',
    expectedClassification: 'PARTIALLY_EXPLAINED',
    notes: 'Bulk migration is approved but one destination and resource scope fall outside the valid grant.',
  },
  entities: [
    entity('entity-user-migrator', 'USER', 'USER-MIGRATOR-11'),
    entity('entity-role-ops-admin', 'ROLE', 'ROLE-OPS-ADMIN'),
    entity('entity-device-ops', 'DEVICE', 'DEVICE-OPS-02'),
    entity('entity-resource-migration', 'RESOURCE', 'RESOURCE-MIGRATION-POOL'),
    entity('entity-resource-export', 'RESOURCE', 'RESOURCE-EXPORT-SHARE'),
    entity('entity-destination-approved', 'DESTINATION', 'DESTINATION-APPROVED-01'),
    entity('entity-destination-external', 'DESTINATION', 'DESTINATION-EXTERNAL-02'),
  ],
  resources: [
    resource('resource-migration-pool', 'DB', 'RESOURCE-MIGRATION-POOL'),
    resource('resource-export-share', 'FOLDER', 'RESOURCE-EXPORT-SHARE'),
  ],
  contextRecords: [
    contextRecord(
      'context-record-migration',
      'PROJECT_ASSIGNMENT',
      'entity-user-migrator',
      '2024-06-01T00:00:00Z',
      '2024-06-30T23:59:59Z',
      'Project migration grant authorizes the bulk transfer of archive resources.',
    ),
  ],
  contextGrants: [
    contextGrant(
      'context-grant-migration',
      'entity-user-migrator',
      '2024-06-01T00:00:00Z',
      '2024-06-30T23:59:59Z',
      ['resource-migration-pool'],
      ['READ', 'WRITE', 'MOVE'],
      'Approved workstream for migration archive transfer.',
    ),
  ],
  contextMatches: [
    contextMatch(
      'context-match-migration',
      'context-grant-migration',
      'change-point-migration',
      ['event-migration-write-001'],
      ['event-migration-export-002'],
      'PARTIALLY_EXPLAINED',
      'Specifically approved migration actions match, but external export violates scope.',
    ),
  ],
  events: [
    event('event-migration-write-001', 'entity-user-migrator', '2024-06-10T09:00:00Z', 'FILE_RESOURCE_ACCESS', 'RESOURCE_ACCESS', 'WRITE', 'resource-migration-pool', 'entity-destination-approved', 'entity-device-ops', 'USER-USER', 'USER-USER', 500),
    event('event-migration-export-002', 'entity-user-migrator', '2024-06-10T09:05:00Z', 'FILE_RESOURCE_ACCESS', 'RESOURCE_ACCESS', 'MOVE', 'resource-export-share', 'entity-destination-external', 'entity-device-ops', 'USER-USER', 'USER-USER', 800),
    event('event-migration-privilege-003', 'entity-user-migrator', '2024-06-10T09:07:00Z', 'PRIVILEGE_ACTIVITY', 'PRIVILEGE_CHANGE', 'ELEVATION', undefined, undefined, 'entity-device-ops', 'USER-USER', 'USER-ADMIN', 1),
  ],
};

export const fixtureScenarios: ScenarioFixture[] = [
  legitimateRoleChangeFixture,
  compromisedAccountFixture,
  partiallyLegitimateMigrationFixture,
];

export { legitimateRoleChangeFixture, compromisedAccountFixture, partiallyLegitimateMigrationFixture };
