export type TargetKind = 'gateway' | 'isp' | 'public' | 'regional'
export type ProbeProtocol = 'icmp' | 'tcp'
export type HostPlatform = 'win32' | 'darwin' | 'linux' | 'aix' | 'freebsd' | 'openbsd' | 'sunos' | 'cygwin' | 'netbsd' | 'android' | 'haiku'
export type DiagnosisScope =
  | 'healthy'
  | 'local'
  | 'isp'
  | 'upstream'
  | 'mixed'
  | 'insufficient_data'
export type FindingSeverity = 'info' | 'watch' | 'problem'

export interface ProbeTarget {
  id: string
  label: string
  host: string
  kind: TargetKind
  protocol: ProbeProtocol
  port?: number
}

export interface ProbeStartInput {
  intervalMs: number
  timeoutMs: number
  spikeThresholdMs: number
  includeGateway: boolean
  targets: ProbeTarget[]
}

export interface ProbeSample {
  sessionId: string
  targetId: string
  t: number
  rttMs: number | null
  timedOut: boolean
  protocol: ProbeProtocol
  resolvedHost?: string
  error?: string
}

export interface AdapterSample {
  t: number
  adapterId: string
  name: string
  bytesInPerSec: number
  bytesOutPerSec: number
  linkSpeedBps: number | null
}

export interface WindowMetrics {
  sampleCount: number
  timeoutCount: number
  lossPct: number
  minMs: number | null
  maxMs: number | null
  avgMs: number | null
  p50Ms: number | null
  p95Ms: number | null
  p99Ms: number | null
  stdevMs: number | null
  jitterMs: number | null
  spikeCount: number
  lastMs: number | null
}

export interface NetworkAdapterInfo {
  id: string
  name: string
  detail?: string
  ipv4?: string
  mac?: string
  linkSpeedBps: number | null
  bytesReceived: number
  bytesSent: number
}

export interface NetworkInfo {
  platform: HostPlatform
  gateway: string | null
  gatewayInterface: string | null
  adapters: NetworkAdapterInfo[]
  notes: string[]
}

export interface MonitorStatus {
  running: boolean
  sessionId: string | null
  startedAt: number | null
  intervalMs: number
  timeoutMs: number
  spikeThresholdMs: number
  targets: ProbeTarget[]
}

export interface TraceHop {
  hop: number
  host: string | null
  rttsMs: Array<number | null>
  timedOut: boolean
  raw: string
}

export interface TracerouteInput {
  host: string
  maxHops: number
  timeoutMs: number
}

export interface TracerouteResult {
  host: string
  startedAt: number
  endedAt: number
  hops: TraceHop[]
  firstSustainedJumpHop: number | null
  cancelled: boolean
  error?: string
}

export interface ValorantSample {
  t: number
  rttMs: number
  lossPct?: number
  note?: string
}

export interface Finding {
  id: string
  scope: DiagnosisScope | 'context'
  severity: FindingSeverity
  title: string
  evidence: string
}

export interface Diagnosis {
  scope: DiagnosisScope
  confidence: number
  summary: string
  findings: Finding[]
  cannotConclude: string[]
}

export interface Recommendation {
  id: string
  title: string
  body: string
  appliesWhen: string[]
  windowsFocused: boolean
  automatic: false
}

export interface DownsampledPoint {
  t: number
  avgMs: number | null
  minMs: number | null
  maxMs: number | null
  lossPct: number
  inBps: number | null
  outBps: number | null
}

export interface TargetSnapshot {
  target: ProbeTarget
  resolvedHost?: string
  metrics: WindowMetrics
  series: DownsampledPoint[]
}

export interface StoredSession {
  id: string
  kind: 'probe' | 'valorant' | 'combined' | 'stability' | 'baseline' | 'ab' | 'bufferbloat' | 'gaming'
  label: string
  startedAt: number
  endedAt: number
  spikeThresholdMs: number
  platform: HostPlatform
  gateway: string | null
  targets: TargetSnapshot[]
  valorant: ValorantSample[]
  valorantMetrics: WindowMetrics | null
  adapterPeakIn: number
  adapterPeakOut: number
  coincidence: CoincidenceStats
  diagnosis: Diagnosis
  traceroute?: TracerouteResult
}

export interface SessionSummary {
  id: string
  kind: StoredSession['kind']
  label: string
  startedAt: number
  endedAt: number
  scope: DiagnosisScope
  regionalP95: number | null
  gatewayP95: number | null
  lossPct: number | null
  valorantP95: number | null
  spikeCount: number
}

export interface CoincidenceStats {
  sampleCount: number
  spikeCount: number
  spikesWithHighUpload: number
  spikeWithHighUploadPct: number | null
  pearsonRttUpload: number | null
}

export interface MetricDelta {
  key: string
  label: string
  before: number | null
  after: number | null
  delta: number | null
}

export interface Comparison {
  beforeId: string
  afterId: string
  beforeLabel: string
  afterLabel: string
  deltas: MetricDelta[]
  notes: string[]
}

export interface ExportResult {
  cancelled: boolean
  path?: string
}

export interface MonitorEvent {
  running: boolean
  sessionId: string | null
  error?: string
}

export type ChangeSurface = 'none' | 'power-plan' | 'nic-power' | 'nic-advanced' | 'mtu'
export type ApplyMode = 'never' | 'user-approved'

export interface OptimizeAction {
  id: string
  title: string
  purpose: string
  risks: string
  limitations: string
  evidenceIds: string[]
  changeSurface: ChangeSurface
  requiresWindows: boolean
  requiresAdmin: boolean
  applyMode: ApplyMode
}

export interface GateResult {
  actionId: string
  allowed: boolean
  readyForConfirm: boolean
  reasons: string[]
  evidenceMatched: string[]
}

export interface OptimizeOffer {
  action: OptimizeAction
  gate: GateResult
}

export interface PowerSchemeSnapshot {
  guid: string
  name: string
}

export interface NicPowerSnapshot {
  name: string
  allowComputerToTurnOffDevice: string
}

export interface SettingsBackup {
  id: string
  actionId: string
  createdAt: number
  rolledBackAt: number | null
  diagnosisScope: DiagnosisScope
  evidenceIds: string[]
  payload: {
    powerScheme?: PowerSchemeSnapshot
    nicPower?: NicPowerSnapshot[]
    nicAdvanced?: NicAdvancedSnapshot[]
    mtu?: MtuSnapshot[]
  }
}

export interface NicAdvancedSnapshot {
  adapter: string
  displayName: string
  value: string
}

export interface MtuSnapshot {
  iface: string
  mtu: number
}

export interface ApplyResult {
  applied: boolean
  backupId?: string
  message: string
}

export interface RollbackResult {
  restored: boolean
  message: string
}

export interface BackgroundProcessHit {
  name: string
  pid: number
  reason: string
  seenAt: number
  evidence: string
}

export interface CongestionScan {
  elevated: boolean
  platform: HostPlatform
  processes: BackgroundProcessHit[]
  services: Array<{ name: string; status: string; reason: string }>
  notes: string[]
}

export interface StabilityProgress {
  running: boolean
  elapsedMs: number
  remainingMs: number
  rounds: number
  sessionId: string | null
  lastByTarget: Record<string, number | null>
}

export interface StabilityStatus {
  running: boolean
  startedAt: number | null
  durationMs: number
  sessionId: string | null
}

export interface StabilityReport {
  sessionId: string
  generatedAt: number
  durationMs: number
  completed: boolean
  cancelled: boolean
  targetMetrics: Array<{ id: string; label: string; kind: TargetKind; metrics: WindowMetrics }>
  coincidence: CoincidenceStats
  diagnosis: Diagnosis
  valorantMetrics: WindowMetrics | null
  valorantLossAvg: number | null
  comparisonToBaseline: Comparison | null
  baselineId: string | null
}

export interface AppInfo {
  name: string
  version: string
  phase: number
  packaged: boolean
  platform: HostPlatform
  userData: string
  elevated: boolean
  baselineSessionId: string | null
  verifiedActionIds: string[]
}

export interface AttachValorantInput {
  sessionId: string
  rttMs: number
  lossPct?: number
  note?: string
}

export type ClassifierState =
  | 'LOCAL_LAN'
  | 'LOCAL_CONGESTION'
  | 'BUFFERBLOAT_SUSPECTED'
  | 'NIC_POWER_MANAGEMENT'
  | 'DNS_ONLY'
  | 'ISP_EDGE'
  | 'UPSTREAM_ROUTE'
  | 'GAME_SPECIFIC'
  | 'STABLE'
  | 'INCONCLUSIVE'

export type HealthGrade = 'Excellent' | 'Good' | 'Needs Attention' | 'Poor' | 'Testing' | 'Inconclusive'
export type BufferbloatGrade = 'Excellent' | 'Good' | 'Moderate' | 'Poor' | 'Severe'
export type AbVerdict = 'IMPROVED' | 'NO_MEANINGFUL_CHANGE' | 'WORSE' | 'INCONCLUSIVE'

export interface ClassifierResult {
  primary: ClassifierState
  secondary: ClassifierState[]
  confidence: number
  reasons: string[]
  buckets: {
    baseline: 'possible' | 'unlikely' | 'unknown'
    jitterSpikes: 'local' | 'upstream' | 'unknown'
    congestion: 'likely' | 'unlikely' | 'unknown'
    unfixableLocally: boolean
  }
}

export interface AbComparison {
  verdict: AbVerdict
  reasons: string[]
  before: WindowMetrics
  after: WindowMetrics
  keepChange: boolean
  rollbackRecommended: boolean
}

export interface BufferbloatResult {
  idleP50: number | null
  loadedDownP50: number | null
  loadedUpP50: number | null
  loadedP95: number | null
  deltaDownMs: number | null
  deltaUpMs: number | null
  jitterMs: number | null
  lossPct: number
  grade: BufferbloatGrade
  cancelled: boolean
  note: string
}

export interface DnsResolverResult {
  name: string
  server: string
  ok: number
  fail: number
  avgMs: number | null
  p95Ms: number | null
}

export interface MtuProbeResult {
  host: string
  payloadTried: number[]
  largestWorkingPayload: number | null
  recommendedMtu: number | null
  fragmentationEvidence: boolean
  notes: string[]
}

export interface NicFeature {
  adapter: string
  displayName: string
  keyword: string
  value: string
  kind: 'eee' | 'interrupt-moderation' | 'speed' | 'other'
  supportedValues: string[]
}

export interface NicInspect {
  adapters: NetworkAdapterInfo[]
  features: NicFeature[]
  linkWarnings: string[]
  power: NicPowerSnapshot[]
  elevated: boolean
}

export interface RouterInspect {
  gateway: string | null
  fingerprint: string | null
  known: boolean
  notes: string[]
  sqmAdvice: string[]
}

export interface HealthScores {
  networkHealth: HealthGrade
  riyadhStability: HealthGrade
  localNetwork: number | null
  riyadhStabilityScore: number | null
  diagnosis: ClassifierState
  spikes: number
  verifiedOptimizations: number
}

export interface ValorantOptReport {
  before: StoredSession
  after: StoredSession
  classifierBefore: ClassifierResult
  classifierAfter: ClassifierResult
  overlayBefore: number | null
  overlayAfter: number | null
  gatewayP95Delta: number | null
  internetP95Delta: number | null
  jitterDelta: number | null
  spikeDelta: number | null
  localStabilityPct: number | null
  pathFloorUnchanged: boolean
  summary: string
  caveats: string[]
}

export interface TimedProgress {
  kind: 'baseline' | 'ab' | 'bufferbloat' | 'gaming'
  running: boolean
  phase: string
  elapsedMs: number
  remainingMs: number
  sessionId: string | null
}

export interface AbRunResult {
  actionId: string
  comparison: AbComparison
  applied: boolean
  rolledBack: boolean
  backupId?: string
  message: string
  beforeSessionId: string
  afterSessionId: string
}

export interface SmartPlanResult {
  classifier: ClassifierResult
  actions: OptimizeAction[]
  hasBaseline: boolean
  notes: string[]
}
