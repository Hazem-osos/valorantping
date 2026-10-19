export const APP_NAME = 'Riyadh Ping Optimizer'
export const APP_PHASE = 5
export const APP_VERSION = '3.0.0'
export const APP_ID = 'com.riyadhping.optimizer'
export const INSTALLER_FILE_NAME = 'Riyadh-Ping-Optimizer-Setup.exe'

export const MAX_TARGETS = 8
export const MAX_HISTORY_SESSIONS = 50
export const MAX_LIVE_SAMPLES = 180
export const MAX_STORED_POINTS = 360
export const MAX_TRACE_HOPS = 30
export const MIN_TRACE_HOPS = 5
export const MIN_INTERVAL_MS = 500
export const MAX_INTERVAL_MS = 10_000
export const MIN_TIMEOUT_MS = 100
export const MAX_TIMEOUT_MS = 5_000
export const DEFAULT_INTERVAL_MS = 1_000
export const DEFAULT_TIMEOUT_MS = 1_500
export const DEFAULT_SPIKE_THRESHOLD_MS = 100
export const DEFAULT_TRACE_HOPS = 20
export const GATEWAY_HEALTHY_P95_MS = 8
export const LOCAL_GATEWAY_WARN_P95_MS = 15
export const INSUFFICIENT_SAMPLES = 10
export const STABILITY_DURATION_MS = 15 * 60 * 1000
export const STABILITY_INTERVAL_MS = 2_000
export const BASELINE_DURATION_MS = 4 * 60 * 1000
export const AB_PROBE_DURATION_MS = 45_000
export const AB_SETTLE_MS = 3_000
export const BUFFERBLOAT_IDLE_MS = 12_000
export const BUFFERBLOAT_LOAD_MS = 8_000
export const BUFFERBLOAT_MAX_BYTES = 5_000_000
export const HIGH_PERFORMANCE_SCHEME = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
export const BLOCKED_CHANGE_SURFACES = ['dns', 'mtu', 'routing', 'firewall', 'registry', 'tcp-stack'] as const
export const DNS_BENCHMARK_NAMES = [
  { name: 'System DNS', server: 'system' },
  { name: 'WE Egypt DNS', server: '163.121.128.134' },
  { name: 'Cloudflare 1.1.1.1', server: '1.1.1.1' },
  { name: 'Google 8.8.8.8', server: '8.8.8.8' },
  { name: 'Quad9 9.9.9.9', server: '9.9.9.9' }
] as const
export const DNS_BENCHMARK_HOSTS = ['riotgames.com', 'cloudflare.com', 'example.com'] as const

export const IPC = {
  networkInfo: 'network:info',
  monitorStart: 'monitor:start',
  monitorStop: 'monitor:stop',
  monitorStatus: 'monitor:status',
  tracerouteRun: 'traceroute:run',
  tracerouteCancel: 'traceroute:cancel',
  valorantStart: 'valorant:start',
  valorantSample: 'valorant:sample',
  valorantStop: 'valorant:stop',
  historyList: 'history:list',
  historyGet: 'history:get',
  historyExport: 'history:export',
  historyCompare: 'history:compare',
  historySave: 'history:save',
  historyDelete: 'history:delete',
  probeSample: 'probe:sample',
  adapterSample: 'adapter:sample',
  traceHop: 'trace:hop',
  monitorEvent: 'monitor:event',
  optimizeOffers: 'optimize:offers',
  optimizeApply: 'optimize:apply',
  optimizeBackups: 'optimize:backups',
  optimizeRollback: 'optimize:rollback',
  optimizeScan: 'optimize:scan',
  stabilityStart: 'stability:start',
  stabilityCancel: 'stability:cancel',
  stabilityStatus: 'stability:status',
  stabilityReport: 'stability:report',
  stabilityBaseline: 'stability:baseline',
  valorantAttach: 'valorant:attach',
  appInfo: 'app:info',
  stabilityProgress: 'stability:progress',
  baselineStart: 'baseline:start',
  classifyNow: 'classify:now',
  nicInspect: 'nic:inspect',
  dnsBenchmark: 'dns:benchmark',
  mtuProbe: 'mtu:probe',
  routerInspect: 'router:inspect',
  bufferbloatStart: 'bufferbloat:start',
  bufferbloatCancel: 'bufferbloat:cancel',
  abRun: 'ab:run',
  gamingStart: 'gaming:start',
  smartPlan: 'smart:plan',
  valorantReport: 'valorant:report',
  timedProgress: 'timed:progress'
} as const

export const INVOKE_CHANNELS = [
  IPC.networkInfo,
  IPC.monitorStart,
  IPC.monitorStop,
  IPC.monitorStatus,
  IPC.tracerouteRun,
  IPC.tracerouteCancel,
  IPC.valorantStart,
  IPC.valorantSample,
  IPC.valorantStop,
  IPC.historyList,
  IPC.historyGet,
  IPC.historyExport,
  IPC.historyCompare,
  IPC.historySave,
  IPC.historyDelete,
  IPC.optimizeOffers,
  IPC.optimizeApply,
  IPC.optimizeBackups,
  IPC.optimizeRollback,
  IPC.optimizeScan,
  IPC.stabilityStart,
  IPC.stabilityCancel,
  IPC.stabilityStatus,
  IPC.stabilityReport,
  IPC.stabilityBaseline,
  IPC.valorantAttach,
  IPC.appInfo,
  IPC.baselineStart,
  IPC.classifyNow,
  IPC.nicInspect,
  IPC.dnsBenchmark,
  IPC.mtuProbe,
  IPC.routerInspect,
  IPC.bufferbloatStart,
  IPC.bufferbloatCancel,
  IPC.abRun,
  IPC.gamingStart,
  IPC.smartPlan,
  IPC.valorantReport
] as const

export const RECEIVE_CHANNELS = [
  IPC.probeSample,
  IPC.adapterSample,
  IPC.traceHop,
  IPC.monitorEvent,
  IPC.stabilityProgress,
  IPC.timedProgress
] as const

export const DEFAULT_PUBLIC_TARGETS = [
  {
    id: 'we-dns',
    label: 'WE Egypt DNS',
    host: '163.121.128.134',
    kind: 'isp' as const,
    protocol: 'icmp' as const
  },
  {
    id: 'cloudflare',
    label: 'Cloudflare 1.1.1.1',
    host: '1.1.1.1',
    kind: 'public' as const,
    protocol: 'icmp' as const
  },
  {
    id: 'google-dns',
    label: 'Google 8.8.8.8',
    host: '8.8.8.8',
    kind: 'public' as const,
    protocol: 'icmp' as const
  },
  {
    id: 'aws-bahrain-tcp',
    label: 'AWS Bahrain TCP 443',
    host: 'dynamodb.me-south-1.amazonaws.com',
    kind: 'regional' as const,
    protocol: 'tcp' as const,
    port: 443
  }
]
