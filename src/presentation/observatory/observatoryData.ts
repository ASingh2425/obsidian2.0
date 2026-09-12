import type {
  SignalSeries,
  OrganizationalContextWindow,
  ActorEntity,
  ObservationPoint,
  BehavioralSignalId,
  BaselineComparisonLens,
} from './types';

export const PROTOTYPE_ACTORS: readonly ActorEntity[] = [
  {
    id: 'ACTOR-SEC-0941',
    pseudonym: 'ACTOR-SEC-0941',
    role: 'Systems Engineer',
    department: 'Infrastructure Reliability',
    peerCohortId: 'COHORT-SYSENG-INFRA',
  },
  {
    id: 'ACTOR-OPS-0312',
    pseudonym: 'ACTOR-OPS-0312',
    role: 'Platform Operations',
    department: 'Cloud Platform Services',
    peerCohortId: 'COHORT-OPS-CLOUD',
  },
  {
    id: 'ACTOR-DEV-0814',
    pseudonym: 'ACTOR-DEV-0814',
    role: 'Data Architect',
    department: 'Analytics Engineering',
    peerCohortId: 'COHORT-DATA-ARCH',
  },
];

export const PRIMARY_ACTOR = PROTOTYPE_ACTORS[0];

export const CONTEXT_WINDOW: OrganizationalContextWindow = {
  id: 'CTX-MAINT-4921',
  title: 'Project Titan Maintenance Window',
  category: 'MAINTENANCE_WINDOW',
  startTime: '2025-10-14T10:00:00Z',
  endTime: '2025-10-14T11:15:00Z',
  startLabel: '10:00 UTC',
  endLabel: '11:15 UTC',
  approvalRef: 'CHG-TKT-8842-APPR',
  scope: 'Engineering database replication check & diagnostic failover',
};

// 25 Discrete Temporal Windows from 09:00 UTC to 12:00 UTC
export const TIMESTAMPS: readonly { time: string; label: string }[] = [
  { time: '2025-10-14T09:00:00Z', label: '09:00' },
  { time: '2025-10-14T09:08:00Z', label: '09:08' },
  { time: '2025-10-14T09:15:00Z', label: '09:15' },
  { time: '2025-10-14T09:22:00Z', label: '09:22' },
  { time: '2025-10-14T09:30:00Z', label: '09:30' },
  { time: '2025-10-14T09:38:00Z', label: '09:38' },
  { time: '2025-10-14T09:45:00Z', label: '09:45' },
  { time: '2025-10-14T09:52:00Z', label: '09:52' },
  { time: '2025-10-14T10:00:00Z', label: '10:00' },
  { time: '2025-10-14T10:08:00Z', label: '10:08' },
  { time: '2025-10-14T10:15:00Z', label: '10:15' },
  { time: '2025-10-14T10:22:00Z', label: '10:22' },
  { time: '2025-10-14T10:30:00Z', label: '10:30' }, // Default scanner index = 12
  { time: '2025-10-14T10:38:00Z', label: '10:38' },
  { time: '2025-10-14T10:45:00Z', label: '10:45' },
  { time: '2025-10-14T10:52:00Z', label: '10:52' },
  { time: '2025-10-14T11:00:00Z', label: '11:00' },
  { time: '2025-10-14T11:08:00Z', label: '11:08' },
  { time: '2025-10-14T11:15:00Z', label: '11:15' },
  { time: '2025-10-14T11:22:00Z', label: '11:22' },
  { time: '2025-10-14T11:30:00Z', label: '11:30' },
  { time: '2025-10-14T11:38:00Z', label: '11:38' },
  { time: '2025-10-14T11:45:00Z', label: '11:45' },
  { time: '2025-10-14T11:52:00Z', label: '11:52' },
  { time: '2025-10-14T12:00:00Z', label: '12:00' },
];

export const DEFAULT_SCANNER_INDEX = 12; // 10:30 UTC

// Baseline offsets for comparison lenses
const LENS_MODIFIERS: Record<BaselineComparisonLens, { authMedian: number; resMedian: number; privMedian: number }> = {
  PERSONAL: { authMedian: 3.0, resMedian: 3.0, privMedian: 0.2 },
  PEER: { authMedian: 4.5, resMedian: 8.5, privMedian: 1.2 },
  RESOURCE: { authMedian: 6.0, resMedian: 14.0, privMedian: 2.5 },
};

export function getSignalsForLens(lens: BaselineComparisonLens = 'PERSONAL'): readonly SignalSeries[] {
  const mod = LENS_MODIFIERS[lens];

  // 1. AUTHENTICATION: Mostly stable with mild change
  const authObservedRaw = [
    2, 3, 2, 4, 3, 2, 3, 4, 3, 4, 5, 6, 6, 5, 4, 3, 3, 2, 3, 2, 3, 2, 2, 3, 2,
  ];

  // 2. RESOURCE ACCESS: Strong gradual drift
  const resourceObservedRaw = [
    3, 2, 4, 3, 5, 4, 6, 9, 13, 19, 28, 38, 46, 52, 55, 51, 47, 44, 38, 32, 28, 24, 20, 16, 12,
  ];

  // 3. PRIVILEGE ACTIVITY: Sudden transition
  const privObservedRaw = [
    0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 6, 9, 12, 14, 13, 11, 10, 8, 5, 3, 1, 1, 0, 0, 0,
  ];

  // 4. DEVICE / DESTINATION: Sparse nominal baseline
  const deviceObservedRaw = [
    1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 4, 4, 4, 3, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1,
  ];

  const buildPoints = (
    observed: readonly number[],
    baseMedian: number,
    baseMad: number,
    isShiftPoint: (idx: number) => boolean,
    contributes: (idx: number) => boolean,
  ): ObservationPoint[] => {
    return observed.map((val, idx) => {
      const { time, label } = TIMESTAMPS[idx];
      const upper = baseMedian + 2.5 * baseMad;
      const lower = Math.max(0, baseMedian - 2.5 * baseMad);
      const sigma = (val - baseMedian) / (1.4826 * (baseMad || 1));

      return {
        index: idx,
        timestamp: time,
        timeLabel: label,
        observedValue: val,
        medianValue: baseMedian,
        madValue: baseMad,
        upperThreshold: upper,
        lowerThreshold: lower,
        deviationSigma: Number(sigma.toFixed(1)),
        isShiftZone: isShiftPoint(idx),
        contributesToShift: contributes(idx),
      };
    });
  };

  const isShiftIdx = (idx: number) => idx >= 8 && idx <= 14; // 10:00 to 10:38

  return [
    {
      id: 'AUTH',
      name: 'Authentication Frequency',
      domainName: 'Authentication Telemetry',
      featureKey: 'auth_event_rate:INTERACTIVE_SSO',
      unit: 'events / 7.5m',
      rangeMin: 0,
      rangeMax: 10,
      nominalPattern: 'Diurnal nominal SSO check-ins (2–4 / window)',
      currentStatus: 'NOMINAL',
      points: buildPoints(
        authObservedRaw,
        mod.authMedian,
        1.0,
        isShiftIdx,
        (i) => i >= 10 && i <= 13,
      ),
    },
    {
      id: 'RESOURCE',
      name: 'Resource Access Volume',
      domainName: 'File & Resource Access',
      featureKey: 'event_count_by_action:READ',
      unit: 'reads / 7.5m',
      rangeMin: 0,
      rangeMax: 60,
      nominalPattern: 'Low-rate routine reads (2–5 / window)',
      currentStatus: 'ELEVATED_DRIFT',
      points: buildPoints(
        resourceObservedRaw,
        mod.resMedian,
        1.5,
        isShiftIdx,
        (i) => i >= 8 && i <= 18,
      ),
    },
    {
      id: 'PRIVILEGE',
      name: 'Privilege Executions',
      domainName: 'Privilege Activity',
      featureKey: 'privilege_escalation_count:ROOT_SUDO',
      unit: 'elevations / 7.5m',
      rangeMin: 0,
      rangeMax: 16,
      nominalPattern: 'Zero-base non-administrative state (0 / window)',
      currentStatus: 'STEP_TRANSITION',
      points: buildPoints(
        privObservedRaw,
        mod.privMedian,
        0.5,
        isShiftIdx,
        (i) => i >= 10 && i <= 16,
      ),
    },
    {
      id: 'DEVICE',
      name: 'Device & Egress Count',
      domainName: 'Host Telemetry',
      featureKey: 'active_sessions:MANAGED_ENDPOINT',
      unit: 'endpoints / 7.5m',
      rangeMin: 0,
      rangeMax: 6,
      nominalPattern: 'Single managed workstation session',
      currentStatus: 'NOMINAL',
      points: buildPoints(
        deviceObservedRaw,
        1.0,
        0.5,
        isShiftIdx,
        (i) => i >= 11 && i <= 13,
      ),
    },
  ];
}

// Behavioral Shift Window Definition
export const SHIFT_REGION = {
  startIndex: 8,  // 10:00 UTC
  endIndex: 14,   // 10:38 UTC
  startTimeLabel: '10:00 UTC',
  endTimeLabel: '10:38 UTC',
  label: 'BEHAVIORAL SHIFT HORIZON',
  sublabel: 'Concurrent multi-dimensional separation from historical expectation',
};

// Context Window Indexes
export const CONTEXT_SPAN = {
  startIndex: 8,  // 10:00 UTC
  endIndex: 18,  // 11:15 UTC
};
