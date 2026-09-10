export type StatusType = "nominal" | "elevated" | "breached" | "isolated" | "contained";

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: "DevOps" | "Engineering" | "Finance" | "Executive" | "Security" | "Legal" | "HR" | "Product";
  clearance: "L1 Standard" | "L2 Elevated" | "L3 Critical" | "L4 Root Authority";
  avatar: string;
  imageUrl?: string;
  status: StatusType;
  riskScore: number;
  activeTokens: number;
  ipAddress: string;
  lastActive: string;
  location: string;
  deviceType: string;
  sshKeysCount: number;
  cloudRoles: string[];
}

export interface ThreatGeo {
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  ip: string;
  asn: string;
  threatActor: string;
  confidence: number;
}

export interface ScenarioStage {
  id: number;
  title: string;
  phaseName: string;
  description: string;
  orgRiskScore: number;
  targetEmployeeId: string;
  targetStatus: StatusType;
  attackerGeo: ThreatGeo;
  hqGeo: ThreatGeo;
  logs: {
    timestamp: string;
    level: "INFO" | "WARN" | "CRIT" | "SUCCESS" | "DECEPTION";
    message: string;
    source: string;
  }[];
  mitigationAction: string;
  honeypotDeployed: string;
}

export interface TwinOption {
  id: string;
  name: string;
  role: string;
  department: string;
  model: string;
  activeCanarySessions: number;
  driftScore: number; // 0-100
  canaryKeyCount: number;
  status: "SYNCHRONIZED" | "TRAP_ACTIVE" | "DECOY_ENGAGED" | "STANDBY";
  syntheticActivity: string;
  lastFingerprint: string;
}

export interface DecoyLog {
  id: string;
  timestamp: string;
  decoyType: "Synthetic S3 Bucket" | "False AWS IAM Key" | "Shadow DB Cluster" | "Decoy K8s Node" | "Mock Stripe API Key" | "Bait SSH Bastion";
  attackerIp: string;
  attackerLocation: string;
  targetedAsset: string;
  capturedPayload: string;
  deceptionLatencyMs: number;
  status: "ISOLATED" | "TRAPPED" | "DEFLECTED" | "EXTRACTING_IOCS";
  threatLevel: "CRITICAL" | "HIGH" | "MEDIUM";
}

export interface LedgerBlock {
  id: string;
  blockNumber: number;
  timestamp: string;
  eventType: "AUTONOMOUS_ISOLATION" | "HONEY_TOKEN_DETONATION" | "NEURAL_DRIFT_ALERT" | "CREDENTIAL_REVOCATION" | "DECEPTION_TRAP_ENGAGED";
  sourceEntity: string;
  targetEntity: string;
  sha256Hash: string;
  previousHash: string;
  merkleRoot: string;
  validatorNode: string;
  verified: boolean;
  tamperProofProof: string;
}

export interface CompetitorComparison {
  category: string;
  obsidian: string;
  legacySiem: string;
  traditionalSoar: string;
  agentlessXdr: string;
}

export interface Capability {
  id: string;
  title: string;
  category: string;
  description: string;
  metric: string;
  metricLabel: string;
  status: string;
  iconName: string;
}

export interface WorkflowStage {
  step: string;
  title: string;
  summary: string;
  details: string;
  latency: string;
  engine: string;
}

export type ThreatSeverity = "CRITICAL" | "HIGH" | "ELEVATED" | "MEDIUM";

export type ThreatTypeCategory = 
  | "Malware"
  | "Phishing"
  | "DDoS"
  | "Brute Force"
  | "Ransomware"
  | "Zero-Day"
  | "Credential Stuffing"
  | "Port Probe"
  | "API Fuzzing";

export interface ThreatVector {
  id: string;
  actor: string;
  type: ThreatTypeCategory;
  severity: ThreatSeverity;
  originCity: string;
  originCountry: string;
  countryCode: string;
  coordinates: [number, number]; // [lng, lat]
  targetCity: string;
  targetCountry: string;
  targetCoordinates: [number, number]; // [lng, lat]
  ip: string;
  asn: string;
  targetNode: string;
  blockedCount: number;
  timestamp: string;
  confidence: number;
  status: "BLOCKED" | "DECEPTION_TRAPPED" | "ISOLATED" | "CONTAINED";
  payloadSnippet: string;
  isPrimaryIncident?: boolean;
}
