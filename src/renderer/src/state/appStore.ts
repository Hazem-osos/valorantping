import { create } from 'zustand'
import { DEFAULT_INTERVAL_MS, DEFAULT_PUBLIC_TARGETS, DEFAULT_SPIKE_THRESHOLD_MS, DEFAULT_TIMEOUT_MS, MAX_LIVE_SAMPLES } from '../../../shared/constants'
import { correlateLatencyAndUpload } from '../../../shared/correlation'
import { diagnose } from '../../../shared/diagnosis'
import { summarizeSamples, summarizeValorant } from '../../../shared/metrics'
import { recommendationsFor } from '../../../shared/recommendations'
import type {
  AbRunResult,
  AdapterSample,
  AppInfo,
  ApplyResult,
  BufferbloatResult,
  Comparison,
  CongestionScan,
  Diagnosis,
  MonitorStatus,
  NetworkInfo,
  NicInspect,
  OptimizeOffer,
  ProbeSample,
  ProbeTarget,
  Recommendation,
  RouterInspect,
  SessionSummary,
  SettingsBackup,
  SmartPlanResult,
  StabilityProgress,
  StabilityReport,
  TimedProgress,
  TraceHop,
  TracerouteResult,
  ValorantOptReport,
  ValorantSample
} from '../../../shared/types'

export type View =
  | 'dashboard'
  | 'live'
  | 'gaming'
  | 'smart'
  | 'optimize'
  | 'bufferbloat'
  | 'path'
  | 'router'
  | 'history'
  | 'reports'
  | 'settings'
  | 'session'
  | 'advice'
  | 'diagnostics'

interface AppState {
  view: View
  disclaimerSeen: boolean
  network: NetworkInfo | null
  monitor: MonitorStatus | null
  samples: Record<string, ProbeSample[]>
  adapters: AdapterSample[]
  valorant: ValorantSample[]
  valorantActive: boolean
  hops: TraceHop[]
  traceroute: TracerouteResult | null
  tracing: boolean
  history: SessionSummary[]
  comparison: Comparison | null
  selectedBefore?: string
  selectedAfter?: string
  error: string | null
  intervalMs: number
  timeoutMs: number
  spikeThresholdMs: number
  snapshotLabel: string
  appInfo: AppInfo | null
  offers: OptimizeOffer[]
  scan: CongestionScan | null
  backups: SettingsBackup[]
  lastApply: ApplyResult | null
  stability: StabilityProgress | null
  stabilityReport: StabilityReport | null
  timed: TimedProgress | null
  bufferbloat: BufferbloatResult | null
  nic: NicInspect | null
  router: RouterInspect | null
  smartPlan: SmartPlanResult | null
  lastAb: AbRunResult | null
  valorantOpt: ValorantOptReport | null
  setView: (view: View) => void
  dismissDisclaimer: () => void
  hydrate: () => Promise<void>
  start: () => Promise<void>
  stop: () => Promise<void>
  pushSample: (sample: ProbeSample) => void
  pushAdapter: (sample: AdapterSample) => void
  runTrace: (host: string) => Promise<void>
  cancelTrace: () => Promise<void>
  pushHop: (hop: TraceHop) => void
  startValorant: (label: string) => Promise<void>
  addValorant: (rttMs: number, note?: string, lossPct?: number) => Promise<void>
  saveSnapshot: () => Promise<void>
  refreshHistory: () => Promise<void>
  compare: () => Promise<void>
  exportId: (id: string) => Promise<void>
  deleteId: (id: string) => Promise<void>
  setSelected: (slot: 'before' | 'after', id: string) => void
  setSetting: (key: 'intervalMs' | 'timeoutMs' | 'spikeThresholdMs' | 'snapshotLabel', value: number | string) => void
  refreshOptimize: () => Promise<void>
  applyOptimize: (actionId: string) => Promise<void>
  rollback: (backupId: string) => Promise<void>
  startStability: () => Promise<void>
  cancelStability: () => Promise<void>
  setStabilityProgress: (progress: StabilityProgress) => void
  loadReport: (id: string) => Promise<void>
  markBaseline: (id: string) => Promise<void>
  attachOverlay: (sessionId: string, rttMs: number, lossPct?: number, note?: string) => Promise<void>
  setTimedProgress: (progress: TimedProgress) => void
  startBaseline: () => Promise<void>
  startGaming: () => Promise<void>
  startBufferbloat: () => Promise<void>
  cancelBufferbloat: () => Promise<void>
  inspectNic: () => Promise<void>
  inspectRouter: () => Promise<void>
  loadSmartPlan: () => Promise<void>
  runAb: (actionId: string, mtuConfirm?: boolean) => Promise<void>
  loadValorantReport: (beforeId: string, afterId: string) => Promise<void>
}

function trim<T>(items: T[], max: number): T[] {
  return items.length > max ? items.slice(items.length - max) : items
}

export const useAppStore = create<AppState>((set, get) => ({
  view: 'dashboard',
  disclaimerSeen: localStorage.getItem('rpo-disclaimer') === '1',
  network: null,
  monitor: null,
  samples: {},
  adapters: [],
  valorant: [],
  valorantActive: false,
  hops: [],
  traceroute: null,
  tracing: false,
  history: [],
  comparison: null,
  error: null,
  intervalMs: DEFAULT_INTERVAL_MS,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  spikeThresholdMs: DEFAULT_SPIKE_THRESHOLD_MS,
  snapshotLabel: 'WE Egypt Ethernet snapshot',
  appInfo: null,
  offers: [],
  scan: null,
  backups: [],
  lastApply: null,
  stability: null,
  stabilityReport: null,
  timed: null,
  bufferbloat: null,
  nic: null,
  router: null,
  smartPlan: null,
  lastAb: null,
  valorantOpt: null,
  setView: (view) => set({ view }),
  dismissDisclaimer: () => {
    localStorage.setItem('rpo-disclaimer', '1')
    set({ disclaimerSeen: true })
  },
  hydrate: async () => {
    try {
      const [network, monitor, history, appInfo] = await Promise.all([
        window.api.getNetworkInfo(),
        window.api.getMonitorStatus(),
        window.api.listHistory(),
        window.api.getAppInfo()
      ])
      set({ network, monitor, history, appInfo, error: null })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load app state' })
    }
  },
  start: async () => {
    const state = get()
    try {
      const targets: ProbeTarget[] = DEFAULT_PUBLIC_TARGETS
      const monitor = await window.api.startMonitor({
        intervalMs: state.intervalMs,
        timeoutMs: state.timeoutMs,
        spikeThresholdMs: state.spikeThresholdMs,
        includeGateway: true,
        targets
      })
      set({ monitor, samples: {}, adapters: [], error: null })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to start monitor' })
    }
  },
  stop: async () => {
    try {
      const monitor = await window.api.stopMonitor()
      set({ monitor })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to stop monitor' })
    }
  },
  pushSample: (sample) => {
    set((state) => ({
      samples: {
        ...state.samples,
        [sample.targetId]: trim([...(state.samples[sample.targetId] ?? []), sample], MAX_LIVE_SAMPLES)
      }
    }))
  },
  pushAdapter: (sample) => {
    set((state) => ({ adapters: trim([...state.adapters, sample], MAX_LIVE_SAMPLES) }))
  },
  runTrace: async (host) => {
    set({ tracing: true, hops: [], traceroute: null, error: null })
    try {
      const traceroute = await window.api.runTraceroute({ host, maxHops: 20, timeoutMs: 1000 })
      set({ traceroute, hops: traceroute.hops, tracing: false })
    } catch (error) {
      set({ tracing: false, error: error instanceof Error ? error.message : 'Traceroute failed' })
    }
  },
  cancelTrace: async () => {
    await window.api.cancelTraceroute()
    set({ tracing: false })
  },
  pushHop: (hop) => {
    set((state) => ({ hops: [...state.hops.filter((item) => item.hop !== hop.hop), hop].sort((a, b) => a.hop - b.hop) }))
  },
  startValorant: async (label) => {
    await window.api.startValorantSession(label)
    set({ valorant: [], valorantActive: true })
  },
  addValorant: async (rttMs, note, lossPct) => {
    await window.api.addValorantSample(rttMs, note, lossPct)
    set((state) => ({ valorant: [...state.valorant, { t: Date.now(), rttMs, note, lossPct }] }))
  },
  saveSnapshot: async () => {
    try {
      await window.api.saveSnapshot(get().snapshotLabel)
      await get().refreshHistory()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save snapshot' })
    }
  },
  refreshHistory: async () => {
    const history = await window.api.listHistory()
    set({ history })
  },
  compare: async () => {
    const { selectedBefore, selectedAfter } = get()
    if (!selectedBefore || !selectedAfter) return
    const comparison = await window.api.compareSessions(selectedBefore, selectedAfter)
    set({ comparison })
  },
  exportId: async (id) => {
    await window.api.exportCsv(id)
  },
  deleteId: async (id) => {
    await window.api.deleteHistory(id)
    await get().refreshHistory()
  },
  setSelected: (slot, id) => {
    if (slot === 'before') set({ selectedBefore: id })
    else set({ selectedAfter: id })
  },
  setSetting: (key, value) => set({ [key]: value } as Partial<AppState>),
  refreshOptimize: async () => {
    const pack = await window.api.getOptimizeOffers()
    const backups = await window.api.listBackups()
    set({ offers: pack.offers, scan: pack.scan, backups })
  },
  applyOptimize: async (actionId) => {
    const lastApply = await window.api.applyOptimize(actionId)
    await get().refreshOptimize()
    const appInfo = await window.api.getAppInfo()
    set({ lastApply, appInfo })
  },
  rollback: async (backupId) => {
    const result = await window.api.rollbackBackup(backupId)
    await get().refreshOptimize()
    set({ lastApply: { applied: result.restored, message: result.message } })
  },
  startStability: async () => {
    const status = await window.api.startStability()
    const current = get().monitor
    set({
      monitor: {
        running: true,
        sessionId: status.sessionId,
        startedAt: status.startedAt,
        intervalMs: current?.intervalMs ?? 2000,
        timeoutMs: current?.timeoutMs ?? 1500,
        spikeThresholdMs: current?.spikeThresholdMs ?? 100,
        targets: current?.targets ?? []
      },
      samples: {},
      adapters: [],
      stabilityReport: null
    })
  },
  cancelStability: async () => {
    await window.api.cancelStability()
    await get().refreshHistory()
  },
  setStabilityProgress: (progress) => set({ stability: progress }),
  loadReport: async (id) => {
    const stabilityReport = await window.api.getStabilityReport(id)
    set({ stabilityReport })
  },
  markBaseline: async (id) => {
    await window.api.setBaseline(id)
    await get().refreshHistory()
  },
  attachOverlay: async (sessionId, rttMs, lossPct, note) => {
    await window.api.attachValorant(sessionId, rttMs, lossPct, note)
    await get().refreshHistory()
    if (get().stabilityReport?.sessionId === sessionId) await get().loadReport(sessionId)
  },
  setTimedProgress: (progress) => set({ timed: progress }),
  startBaseline: async () => {
    set({ samples: {}, adapters: [], error: null })
    const status = await window.api.startBaseline()
    await get().refreshHistory()
    const appInfo = await window.api.getAppInfo()
    set({
      appInfo,
      monitor: {
        running: false,
        sessionId: status.sessionId,
        startedAt: status.startedAt,
        intervalMs: 2000,
        timeoutMs: 1500,
        spikeThresholdMs: 100,
        targets: []
      }
    })
  },
  startGaming: async () => {
    const monitor = await window.api.startGaming()
    set({ monitor, samples: {}, adapters: [], error: null })
  },
  startBufferbloat: async () => {
    set({ bufferbloat: null, error: null })
    const bufferbloat = await window.api.startBufferbloat()
    set({ bufferbloat })
  },
  cancelBufferbloat: async () => {
    await window.api.cancelBufferbloat()
  },
  inspectNic: async () => {
    const nic = await window.api.inspectNic()
    set({ nic })
  },
  inspectRouter: async () => {
    const router = await window.api.inspectRouter()
    set({ router })
  },
  loadSmartPlan: async () => {
    const smartPlan = await window.api.smartPlan()
    set({ smartPlan })
  },
  runAb: async (actionId, mtuConfirm) => {
    const lastAb = await window.api.runAb(actionId, mtuConfirm)
    const appInfo = await window.api.getAppInfo()
    await get().refreshHistory()
    await get().refreshOptimize()
    set({ lastAb, appInfo })
  },
  loadValorantReport: async (beforeId, afterId) => {
    const valorantOpt = await window.api.valorantReport(beforeId, afterId)
    set({ valorantOpt })
  }
}))

export function liveDiagnosis(state: AppState): Diagnosis {
  const windows: Parameters<typeof diagnose>[0]['windows'] = {}
  for (const target of state.monitor?.targets ?? []) {
    windows[target.id] = {
      kind: target.kind,
      label: target.label,
      metrics: summarizeSamples(state.samples[target.id] ?? [], state.spikeThresholdMs)
    }
  }
  const coincidence = correlateLatencyAndUpload({
    rtts: Object.values(state.samples)
      .flat()
      .map((sample) => ({ t: sample.t, rttMs: sample.rttMs })),
    uploads: state.adapters.map((sample) => ({ t: sample.t, bytesOutPerSec: sample.bytesOutPerSec })),
    spikeThresholdMs: state.spikeThresholdMs
  })
  return diagnose({
    windows,
    coincidence,
    traceroute: state.traceroute
      ? { hops: state.traceroute.hops, firstSustainedJumpHop: state.traceroute.firstSustainedJumpHop }
      : undefined,
    valorant: summarizeValorant(state.valorant, state.spikeThresholdMs),
    spikeThresholdMs: state.spikeThresholdMs
  })
}

export function liveAdvice(state: AppState): Recommendation[] {
  return recommendationsFor(liveDiagnosis(state))
}
