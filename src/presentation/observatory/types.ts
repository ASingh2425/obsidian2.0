export type BehavioralSignalId = 'AUTH' | 'RESOURCE' | 'PRIVILEGE' | 'DEVICE';

export interface ObservationPoint {
  readonly index: number;
  readonly timestamp: string;       // e.g. "2025-10-14T10:30:00Z"
  readonly timeLabel: string;       // e.g. "10:30"
  readonly observedValue: number;
  readonly medianValue: number;
  readonly madValue: number;        // Median Absolute Deviation
  readonly upperThreshold: number;  // Median + 2.5 * MAD
  readonly lowerThreshold: number;  // Math.max(0, Median - 2.5 * MAD)
  readonly deviationSigma: number;  // (observed - median) / (1.4826 * mad)
  readonly isShiftZone?: boolean;
  readonly contributesToShift?: boolean;
}

export interface SignalSeries {
  readonly id: BehavioralSignalId;
  readonly name: string;
  readonly domainName: string;
  readonly featureKey: string;
  readonly unit: string;
  readonly rangeMin: number;
  readonly rangeMax: number;
  readonly points: readonly ObservationPoint[];
  readonly nominalPattern: string;
  readonly currentStatus: 'NOMINAL' | 'ELEVATED_DRIFT' | 'STEP_TRANSITION';
}

export interface OrganizationalContextWindow {
  readonly id: string;
  readonly title: string;
  readonly category: 'PROJECT_ASSIGNMENT' | 'MAINTENANCE_WINDOW' | 'ROLE_CHANGE' | 'TEMPORARY_ACCESS';
  readonly startTime: string;
  readonly endTime: string;
  readonly startLabel: string;
  readonly endLabel: string;
  readonly approvalRef: string;
  readonly scope: string;
}

export interface ActorEntity {
  readonly id: string;
  readonly pseudonym: string;
  readonly role: string;
  readonly department: string;
  readonly peerCohortId: string;
}

export type BaselineComparisonLens = 'PERSONAL' | 'PEER' | 'RESOURCE';

export interface ObservatoryFilters {
  readonly activeSignals: Record<BehavioralSignalId, boolean>;
  readonly selectedSignalId: BehavioralSignalId | null;
  readonly activeLens: BaselineComparisonLens;
  readonly overlays: {
    readonly baseline: boolean;
    readonly context: boolean;
    readonly evidence: boolean;
    readonly grid: boolean;
    readonly labels: boolean;
  };
}
