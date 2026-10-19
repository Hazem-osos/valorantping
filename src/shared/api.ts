import type {
  AbRunResult,
  AdapterSample,
  AppInfo,
  ApplyResult,
  BufferbloatResult,
  ClassifierResult,
  Comparison,
  CongestionScan,
  Diagnosis,
  DnsResolverResult,
  ExportResult,
  MonitorEvent,
  MonitorStatus,
  MtuProbeResult,
  NetworkInfo,
  NicInspect,
  OptimizeOffer,
  ProbeSample,
  ProbeStartInput,
  RollbackResult,
  RouterInspect,
  SessionSummary,
  SettingsBackup,
  SmartPlanResult,
  StabilityProgress,
  StabilityReport,
  StabilityStatus,
  StoredSession,
  TimedProgress,
  TraceHop,
  TracerouteInput,
  TracerouteResult,
  ValorantOptReport
} from './types'

export interface DesktopApi {
  getNetworkInfo: () => Promise<NetworkInfo>
  startMonitor: (input: ProbeStartInput) => Promise<MonitorStatus>
  stopMonitor: () => Promise<MonitorStatus>
  getMonitorStatus: () => Promise<MonitorStatus>
  runTraceroute: (input: TracerouteInput) => Promise<TracerouteResult>
  cancelTraceroute: () => Promise<{ cancelled: boolean }>
  startValorantSession: (label: string) => Promise<{ ok: boolean }>
  addValorantSample: (rttMs: number, note?: string, lossPct?: number) => Promise<{ ok: boolean }>
  stopValorantSession: () => Promise<unknown>
  saveSnapshot: (label: string) => Promise<StoredSession>
  listHistory: () => Promise<SessionSummary[]>
  getHistory: (id: string) => Promise<StoredSession | null>
  deleteHistory: (id: string) => Promise<{ ok: boolean }>
  compareSessions: (beforeId: string, afterId: string) => Promise<Comparison>
  exportCsv: (id: string) => Promise<ExportResult>
  getAppInfo: () => Promise<AppInfo>
  getOptimizeOffers: () => Promise<{
    diagnosis: Diagnosis
    fromLive: boolean
    offers: OptimizeOffer[]
    scan: CongestionScan
  }>
  scanCongestion: () => Promise<CongestionScan>
  applyOptimize: (actionId: string) => Promise<ApplyResult>
  listBackups: () => Promise<SettingsBackup[]>
  rollbackBackup: (backupId: string) => Promise<RollbackResult>
  startStability: () => Promise<StabilityStatus>
  cancelStability: () => Promise<StabilityStatus>
  getStabilityStatus: () => Promise<StabilityStatus>
  getStabilityReport: (id: string) => Promise<StabilityReport>
  setBaseline: (sessionId: string) => Promise<{ baselineSessionId: string | null }>
  attachValorant: (sessionId: string, rttMs: number, lossPct?: number, note?: string) => Promise<StoredSession>
  startBaseline: () => Promise<StabilityStatus>
  classifyNow: () => Promise<ClassifierResult>
  inspectNic: () => Promise<NicInspect>
  benchmarkDns: () => Promise<DnsResolverResult[]>
  probeMtu: () => Promise<MtuProbeResult>
  inspectRouter: () => Promise<RouterInspect>
  startBufferbloat: () => Promise<BufferbloatResult>
  cancelBufferbloat: () => Promise<{ cancelled: boolean }>
  runAb: (actionId: string, mtuConfirm?: boolean) => Promise<AbRunResult>
  startGaming: () => Promise<MonitorStatus>
  smartPlan: () => Promise<SmartPlanResult>
  valorantReport: (beforeId: string, afterId: string) => Promise<ValorantOptReport>
  onProbeSample: (cb: (sample: ProbeSample) => void) => () => void
  onAdapterSample: (cb: (sample: AdapterSample) => void) => () => void
  onTraceHop: (cb: (hop: TraceHop) => void) => () => void
  onMonitorEvent: (cb: (event: MonitorEvent) => void) => () => void
  onStabilityProgress: (cb: (progress: StabilityProgress) => void) => () => void
  onTimedProgress: (cb: (progress: TimedProgress) => void) => () => void
}
