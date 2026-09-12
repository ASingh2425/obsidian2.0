import { SCHEMA_VERSION, type Entity, type Resource, type SecurityEvent } from '../../domain/types';
import type {
  BaselineVisualModel,
  ContextEnvelopeViewModel,
  RelatedEntityViewModel,
  TrajectoryPointViewModel,
} from '../types/presentationTypes';

export const PROTOTYPE_ACTOR: Entity = {
  id: 'entity-admin-user',
  entityType: 'USER',
  tenantId: 'tenant-silent-shift',
  displayName: 'ACTOR-SEC-0941',
  pseudonymizedName: 'ACTOR-SEC-0941',
  attributes: {
    role: 'SYSTEMS_ENGINEER',
    cohortId: 'cohort-infra-eng',
    synthetic: true,
  },
};

export const PROTOTYPE_RESOURCES: Resource[] = [
  {
    id: 'resource-customer-db',
    resourceType: 'DB',
    resourceName: 'RES-CUST-DB-01',
  },
  {
    id: 'resource-auth-service',
    resourceType: 'API',
    resourceName: 'RES-AUTH-SVC-02',
  },
];

export const PROTOTYPE_DEVICE: Entity = {
  id: 'device-workstation-01',
  entityType: 'DEVICE',
  tenantId: 'tenant-silent-shift',
  displayName: 'DEV-LINUX-WS01',
  pseudonymizedName: 'DEV-LINUX-WS01',
  attributes: {
    ip: '10.240.12.8',
    synthetic: true,
  },
};

export const PROTOTYPE_CONTEXT_GRANT: ContextEnvelopeViewModel = {
  grantId: 'grant-admin-db-001',
  actorEntityId: 'entity-admin-user',
  validFrom: '2024-04-01T08:15:00Z',
  validTo: '2024-04-01T10:00:00Z',
  resourceScope: ['resource-customer-db'],
  actionScope: ['READ', 'ROLE_CHANGE'],
  expectedVolume: 200,
  rationale: 'Scheduled quarterly database index maintenance and read performance profiling',
};

export const PROTOTYPE_BASELINES: Record<'PERSONAL' | 'PEER' | 'RESOURCE', BaselineVisualModel> = {
  PERSONAL: {
    id: 'base-personal-admin-01',
    lens: 'PERSONAL',
    featureName: 'event_count_by_action:READ',
    available: true,
    median: 3.0,
    mad: 1.5,
    min: 1.0,
    max: 6.0,
    sampleCount: 24,
    observationCount: 24,
    quality: 'HIGH',
    notes: 'Robust median and MAD calculated over 24 prior 15-minute observation windows',
  },
  PEER: {
    id: 'base-peer-infra-01',
    lens: 'PEER',
    featureName: 'event_count_by_action:READ',
    available: true,
    median: 5.0,
    mad: 2.0,
    min: 2.0,
    max: 12.0,
    sampleCount: 16,
    observationCount: 48,
    quality: 'HIGH',
    notes: 'Median-of-peer-medians for 16 peer systems engineers in cohort-infra-eng',
  },
  RESOURCE: {
    id: 'base-resource-custdb-01',
    lens: 'RESOURCE',
    featureName: 'event_count_by_action:READ',
    available: false,
    median: null,
    mad: null,
    min: null,
    max: null,
    sampleCount: 1,
    observationCount: 1,
    quality: 'INSUFFICIENT',
    notes: 'Insufficient historical baseline samples for resource-customer-db (1 sample, minimum 5 required)',
  },
};

/**
 * 11 chronologically ordered 15-minute observations spanning 08:00 to 10:45.
 */
interface RawObservationSeed {
  readonly id: string;
  readonly timestamp: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly value: number;
  readonly resourceIds: string[];
  readonly deviceIds: string[];
  readonly eventIds: string[];
}

export const RAW_OBSERVATION_SEEDS: readonly RawObservationSeed[] = [
  {
    id: 'obs-win-01',
    timestamp: '2024-04-01T08:00:00Z',
    windowStart: '2024-04-01T07:45:00Z',
    windowEnd: '2024-04-01T08:00:00Z',
    value: 2,
    resourceIds: ['resource-auth-service'],
    deviceIds: ['device-workstation-01'],
    eventIds: ['evt-auth-001', 'evt-auth-002'],
  },
  {
    id: 'obs-win-02',
    timestamp: '2024-04-01T08:15:00Z',
    windowStart: '2024-04-01T08:00:00Z',
    windowEnd: '2024-04-01T08:15:00Z',
    value: 3,
    resourceIds: ['resource-customer-db'],
    deviceIds: ['device-workstation-01'],
    eventIds: ['evt-db-001', 'evt-db-002', 'evt-db-003'],
  },
  {
    id: 'obs-win-03',
    timestamp: '2024-04-01T08:30:00Z',
    windowStart: '2024-04-01T08:15:00Z',
    windowEnd: '2024-04-01T08:30:00Z',
    value: 12,
    resourceIds: ['resource-customer-db'],
    deviceIds: ['device-workstation-01'],
    eventIds: ['evt-db-004', 'evt-db-005', 'evt-db-006', 'evt-db-007'],
  },
  {
    id: 'obs-win-04',
    timestamp: '2024-04-01T08:45:00Z',
    windowStart: '2024-04-01T08:30:00Z',
    windowEnd: '2024-04-01T08:45:00Z',
    value: 24,
    resourceIds: ['resource-customer-db'],
    deviceIds: ['device-workstation-01'],
    eventIds: ['evt-db-008', 'evt-db-009', 'evt-db-010', 'evt-db-011'],
  },
  {
    id: 'obs-win-05',
    timestamp: '2024-04-01T09:00:00Z',
    windowStart: '2024-04-01T08:45:00Z',
    windowEnd: '2024-04-01T09:00:00Z',
    value: 22,
    resourceIds: ['resource-customer-db'],
    deviceIds: ['device-workstation-01'],
    eventIds: ['evt-db-012', 'evt-db-013'],
  },
  {
    id: 'obs-win-06',
    timestamp: '2024-04-01T09:15:00Z',
    windowStart: '2024-04-01T09:00:00Z',
    windowEnd: '2024-04-01T09:15:00Z',
    value: 10,
    resourceIds: ['resource-customer-db'],
    deviceIds: ['device-workstation-01'],
    eventIds: ['evt-db-014', 'evt-db-015'],
  },
  {
    id: 'obs-win-07',
    timestamp: '2024-04-01T09:30:00Z',
    windowStart: '2024-04-01T09:15:00Z',
    windowEnd: '2024-04-01T09:30:00Z',
    value: 4,
    resourceIds: ['resource-customer-db'],
    deviceIds: ['device-workstation-01'],
    eventIds: ['evt-db-016', 'evt-db-017'],
  },
  {
    id: 'obs-win-08',
    timestamp: '2024-04-01T09:45:00Z',
    windowStart: '2024-04-01T09:30:00Z',
    windowEnd: '2024-04-01T09:45:00Z',
    value: 3,
    resourceIds: ['resource-customer-db'],
    deviceIds: ['device-workstation-01'],
    eventIds: ['evt-db-018'],
  },
  {
    id: 'obs-win-09',
    timestamp: '2024-04-01T10:00:00Z',
    windowStart: '2024-04-01T09:45:00Z',
    windowEnd: '2024-04-01T10:00:00Z',
    value: 2,
    resourceIds: ['resource-auth-service'],
    deviceIds: ['device-workstation-01'],
    eventIds: ['evt-auth-003'],
  },
  {
    id: 'obs-win-10',
    timestamp: '2024-04-01T10:15:00Z',
    windowStart: '2024-04-01T10:00:00Z',
    windowEnd: '2024-04-01T10:15:00Z',
    value: 32,
    resourceIds: ['resource-customer-db'],
    deviceIds: ['device-workstation-01'],
    eventIds: ['evt-db-019', 'evt-db-020', 'evt-db-021'],
  },
  {
    id: 'obs-win-11',
    timestamp: '2024-04-01T10:30:00Z',
    windowStart: '2024-04-01T10:15:00Z',
    windowEnd: '2024-04-01T10:30:00Z',
    value: 46,
    resourceIds: ['resource-customer-db'],
    deviceIds: ['device-workstation-01'],
    eventIds: ['evt-db-022', 'evt-db-023', 'evt-db-024'],
  },
];

export const PROTOTYPE_SECURITY_EVENTS: readonly SecurityEvent[] = [
  {
    id: 'evt-auth-001',
    schemaVersion: SCHEMA_VERSION,
    actorEntityId: 'entity-admin-user',
    timestamp: '2024-04-01T07:50:00Z',
    domain: 'AUTHENTICATION',
    eventType: 'LOGIN',
    action: 'LOGIN',
    source: 'SYNTHETIC_REPLAY_FIXTURE',
    deviceEntityId: 'device-workstation-01',
    resourceId: 'resource-auth-service',
    outcome: 'SUCCESS',
  },
  {
    id: 'evt-db-001',
    schemaVersion: SCHEMA_VERSION,
    actorEntityId: 'entity-admin-user',
    timestamp: '2024-04-01T08:10:00Z',
    domain: 'FILE_RESOURCE_ACCESS',
    eventType: 'RESOURCE_ACCESS',
    action: 'READ',
    source: 'SYNTHETIC_REPLAY_FIXTURE',
    deviceEntityId: 'device-workstation-01',
    resourceId: 'resource-customer-db',
    outcome: 'SUCCESS',
  },
  {
    id: 'evt-db-008',
    schemaVersion: SCHEMA_VERSION,
    actorEntityId: 'entity-admin-user',
    timestamp: '2024-04-01T08:40:00Z',
    domain: 'FILE_RESOURCE_ACCESS',
    eventType: 'RESOURCE_ACCESS',
    action: 'READ',
    source: 'SYNTHETIC_REPLAY_FIXTURE',
    deviceEntityId: 'device-workstation-01',
    resourceId: 'resource-customer-db',
    observedVolume: 180,
    outcome: 'SUCCESS',
  },
  {
    id: 'evt-db-022',
    schemaVersion: SCHEMA_VERSION,
    actorEntityId: 'entity-admin-user',
    timestamp: '2024-04-01T10:25:00Z',
    domain: 'FILE_RESOURCE_ACCESS',
    eventType: 'RESOURCE_ACCESS',
    action: 'READ',
    source: 'SYNTHETIC_REPLAY_FIXTURE',
    deviceEntityId: 'device-workstation-01',
    resourceId: 'resource-customer-db',
    observedVolume: 350,
    outcome: 'SUCCESS',
  },
];
