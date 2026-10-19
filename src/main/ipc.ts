import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import { APP_NAME, APP_PHASE, APP_VERSION, BASELINE_DURATION_MS, DEFAULT_PUBLIC_TARGETS, IPC } from '../shared/constants'
import { classifyFromSession } from '../shared/classifier'
import { linkSpeedWarning } from '../shared/nicDetect'
import { offersFor } from '../shared/optimization'
import { recommendationsFor } from '../shared/recommendations'
import { buildStabilityReport } from '../shared/report'
import { planSmartOptimize } from '../shared/smartPlan'
import { buildValorantReport } from '../shared/valorantReport'
import type {
  AdapterSample,
  MonitorEvent,
  MtuProbeResult,
  ProbeSample,
  TraceHop
} from '../shared/types'
import {
  abRunSchema,
  applyOptimizeSchema,
  attachValorantSchema,
  baselineSchema,
  compareSchema,
  idSchema,
  parseOrThrow,
  probeStartSchema,
  rollbackSchema,
  snapshotLabelSchema,
  tracerouteInputSchema,
  valorantReportSchema,
  valorantSampleSchema,
  valorantStartSchema
} from '../shared/validation'
import { runAbOptimization } from './diagnostics/abEngine'
import { BufferbloatRunner } from './diagnostics/bufferbloat'
import { StabilityRunner } from './diagnostics/stability'
import { TimedProbe } from './diagnostics/timed'
import { AdapterMonitor } from './network/adapters'
import { benchmarkDns } from './network/dnsBench'
import { ProbeEngine } from './network/engine'
import { readNetworkInfo } from './network/gateway'
import { probePathMtu } from './network/mtuProbe'
import { inspectRouter } from './network/routerInspect'
import { runTraceroute } from './network/traceroute'
import { applyApprovedChange, rollbackBackup } from './optimize/apply'
import { BackupStore } from './optimize/backupStore'
import { readNicAdvanced } from './optimize/nicAdvanced'
import { isElevated, readNicPower, readPowerScheme, scanCongestion } from './optimize/windows'
import { HistoryStore } from './storage/history'
import { SettingsStore } from './storage/settings'

const engine = new ProbeEngine()
const adapters = new AdapterMonitor()
const stability = new StabilityRunner(engine, adapters)
const timed = new TimedProbe(engine, adapters)
const bufferbloat = new BufferbloatRunner()
let historyStore: HistoryStore | null = null
let backupStore: BackupStore | null = null
let settingsStore: SettingsStore | null = null
let traceAbort: AbortController | null = null
let lastMtu: MtuProbeResult | null = null
let baselineRunning = false

function store(): HistoryStore {
  if (!historyStore) {
    historyStore = new HistoryStore(`${app.getPath('userData')}/history.json`)
  }
  return historyStore
}

function backups(): BackupStore {
  if (!backupStore) backupStore = new BackupStore(`${app.getPath('userData')}/backups.json`)
  return backupStore
}

function settings(): SettingsStore {
  if (!settingsStore) settingsStore = new SettingsStore(`${app.getPath('userData')}/settings.json`)
  return settingsStore
}

function sender(): BrowserWindow | null {
  return BrowserWindow.getAllWindows()[0] ?? null
}

function broadcast(channel: string, payload: unknown): void {
  sender()?.webContents.send(channel, payload)
}

export function registerIpc(): void {
  ipcMain.handle(IPC.networkInfo, async () => readNetworkInfo())

  ipcMain.handle(IPC.monitorStart, async (_event, payload: unknown) => {
    const input = parseOrThrow(probeStartSchema, payload)
    const status = await engine.start(input, (sample: ProbeSample) => {
      broadcast(IPC.probeSample, sample)
    })
    adapters.start((sample: AdapterSample) => {
      engine.pushAdapter(sample)
      broadcast(IPC.adapterSample, sample)
    })
    const event: MonitorEvent = { running: true, sessionId: status.sessionId }
    broadcast(IPC.monitorEvent, event)
    return status
  })

  ipcMain.handle(IPC.monitorStop, async () => {
    adapters.stop()
    const status = engine.stop()
    broadcast(IPC.monitorEvent, { running: false, sessionId: status.sessionId })
    return status
  })

  ipcMain.handle(IPC.monitorStatus, async () => engine.getStatus())

  ipcMain.handle(IPC.tracerouteRun, async (_event, payload: unknown) => {
    const input = parseOrThrow(tracerouteInputSchema, payload)
    traceAbort?.abort()
    traceAbort = new AbortController()
    return runTraceroute(
      input.host,
      input.maxHops,
      input.timeoutMs,
      traceAbort.signal,
      (hop: TraceHop) => broadcast(IPC.traceHop, hop)
    )
  })

  ipcMain.handle(IPC.tracerouteCancel, async () => {
    traceAbort?.abort()
    traceAbort = null
    return { cancelled: true }
  })

  ipcMain.handle(IPC.valorantStart, async (_event, payload: unknown) => {
    const input = parseOrThrow(valorantStartSchema, payload)
    engine.startValorant(input.label)
    return { ok: true, label: input.label }
  })

  ipcMain.handle(IPC.valorantSample, async (_event, payload: unknown) => {
    const input = parseOrThrow(valorantSampleSchema, payload)
    engine.addValorant({ t: Date.now(), rttMs: input.rttMs, lossPct: input.lossPct, note: input.note })
    return { ok: true }
  })

  ipcMain.handle(IPC.valorantStop, async () => ({
    samples: engine.getValorant(),
    metrics: engine.snapshot('valorant-partial').valorantMetrics
  }))

  ipcMain.handle(IPC.historySave, async (_event, payload: unknown) => {
    const label = parseOrThrow(snapshotLabelSchema, payload)
    const session = engine.snapshot(label)
    session.diagnosis.findings.push({
      id: 'recommendations-bound',
      scope: 'context',
      severity: 'info',
      title: 'Advice stays manual',
      evidence: `${recommendationsFor(session.diagnosis).length} Phase 1 recommendations are display-only.`
    })
    return store().save(session)
  })

  ipcMain.handle(IPC.historyList, async () => store().list())
  ipcMain.handle(IPC.historyGet, async (_event, payload: unknown) => {
    const id = parseOrThrow(idSchema, payload)
    return store().get(id)
  })
  ipcMain.handle(IPC.historyDelete, async (_event, payload: unknown) => {
    const id = parseOrThrow(idSchema, payload)
    await store().delete(id)
    return { ok: true }
  })
  ipcMain.handle(IPC.historyCompare, async (_event, payload: unknown) => {
    const input = parseOrThrow(compareSchema, payload)
    return store().compare(input.beforeId, input.afterId)
  })
  ipcMain.handle(IPC.historyExport, async (_event, payload: unknown) => {
    const id = parseOrThrow(idSchema, payload)
    const csv = await store().exportCsv(id)
    const win = sender()
    const options = {
      title: 'Export snapshot CSV',
      defaultPath: `riyadh-ping-${id.slice(0, 8)}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    }
    const choice = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    if (choice.canceled || !choice.filePath) return { cancelled: true }
    await writeFile(choice.filePath, csv, 'utf8')
    return { cancelled: false, path: choice.filePath }
  })

  ipcMain.handle(IPC.appInfo, async () => {
    const cfg = await settings().get()
    return {
      name: APP_NAME,
      version: APP_VERSION,
      phase: APP_PHASE,
      packaged: app.isPackaged,
      platform: process.platform,
      userData: app.getPath('userData'),
      elevated: await isElevated(),
      baselineSessionId: cfg.baselineSessionId,
      verifiedActionIds: cfg.verifiedActionIds
    }
  })

  ipcMain.handle(IPC.optimizeOffers, async () => {
    const live = engine.snapshot('optimize-preview')
    const listed = await store().list()
    const previous = listed[0] ? await store().get(listed[0].id) : null
    const diagnosis =
      live.diagnosis.scope === 'insufficient_data' && previous ? previous.diagnosis : live.diagnosis
    const elevated = await isElevated()
    const cfg = await settings().get()
    const features = process.platform === 'win32' ? await readNicAdvanced() : []
    return {
      diagnosis,
      fromLive: live.diagnosis.scope !== 'insufficient_data',
      offers: offersFor({
        platform: process.platform,
        elevated,
        diagnosis,
        hasBaseline: Boolean(cfg.baselineSessionId),
        mtuMismatch: lastMtu?.fragmentationEvidence === true,
        nicFeaturePresent: features.some((feature) => feature.kind === 'eee' || feature.kind === 'interrupt-moderation')
      }),
      scan: await scanCongestion()
    }
  })

  ipcMain.handle(IPC.optimizeScan, async () => scanCongestion())

  ipcMain.handle(IPC.optimizeApply, async (_event, payload: unknown) => {
    const input = parseOrThrow(applyOptimizeSchema, payload)
    const live = engine.snapshot('optimize-apply')
    const listed = await store().list()
    const previous = listed[0] ? await store().get(listed[0].id) : null
    const diagnosis =
      live.diagnosis.scope === 'insufficient_data' && previous ? previous.diagnosis : live.diagnosis
    const cfg = await settings().get()
    const features = process.platform === 'win32' ? await readNicAdvanced() : []
    return applyApprovedChange({
      actionId: input.actionId,
      confirm: true,
      diagnosis,
      platform: process.platform,
      backups: backups(),
      hasBaseline: Boolean(cfg.baselineSessionId),
      mtuMismatch: lastMtu?.fragmentationEvidence === true,
      nicFeaturePresent: features.some((feature) =>
        input.actionId === 'nic-eee' ? feature.kind === 'eee' : feature.kind === 'interrupt-moderation'
      ),
      recommendedMtu: lastMtu?.recommendedMtu ?? null,
      mtuConfirm: input.mtuConfirm
    })
  })

  ipcMain.handle(IPC.optimizeBackups, async () => backups().list())
  ipcMain.handle(IPC.optimizeRollback, async (_event, payload: unknown) => {
    const input = parseOrThrow(rollbackSchema, payload)
    const backup = await backups().get(input.backupId)
    if (!backup) return { restored: false, message: 'Backup not found' }
    return rollbackBackup(backup, backups())
  })

  ipcMain.handle(IPC.stabilityStart, async () => {
    await stability.start(
      (sample: ProbeSample) => broadcast(IPC.probeSample, sample),
      (sample: AdapterSample) => broadcast(IPC.adapterSample, sample),
      (progress) => broadcast(IPC.stabilityProgress, progress),
      (session, cancelled) => {
        void (async () => {
          await store().save(session)
          const cfg = await settings().get()
          const baseline = cfg.baselineSessionId ? await store().get(cfg.baselineSessionId) : null
          const report = buildStabilityReport(session, baseline, { cancelled })
          broadcast(IPC.stabilityProgress, { ...stability.progress(), running: false })
          broadcast(IPC.monitorEvent, { running: false, sessionId: session.id })
          sender()?.webContents.send(IPC.stabilityProgress, {
            ...stability.progress(),
            running: false,
            report
          })
        })()
      }
    )
    broadcast(IPC.monitorEvent, { running: true, sessionId: engine.getStatus().sessionId })
    return stability.status()
  })

  ipcMain.handle(IPC.stabilityCancel, async () => {
    await stability.cancel(async (session, cancelled) => {
      await store().save(session)
      const cfg = await settings().get()
      const baseline = cfg.baselineSessionId ? await store().get(cfg.baselineSessionId) : null
      buildStabilityReport(session, baseline, { cancelled })
      broadcast(IPC.monitorEvent, { running: false, sessionId: session.id })
    })
    return stability.status()
  })

  ipcMain.handle(IPC.stabilityStatus, async () => stability.status())
  ipcMain.handle(IPC.stabilityReport, async (_event, payload: unknown) => {
    const id = parseOrThrow(idSchema, payload)
    const session = await store().get(id)
    if (!session) throw new Error('Report not found')
    const cfg = await settings().get()
    const baseline = cfg.baselineSessionId ? await store().get(cfg.baselineSessionId) : null
    return buildStabilityReport(session, baseline, { cancelled: false })
  })
  ipcMain.handle(IPC.stabilityBaseline, async (_event, payload: unknown) => {
    const input = parseOrThrow(baselineSchema, payload)
    return settings().setBaseline(input.sessionId)
  })
  ipcMain.handle(IPC.valorantAttach, async (_event, payload: unknown) => {
    const input = parseOrThrow(attachValorantSchema, payload)
    return store().attachValorant(input.sessionId, {
      t: Date.now(),
      rttMs: input.rttMs,
      lossPct: input.lossPct,
      note: input.note
    })
  })

  ipcMain.handle(IPC.baselineStart, async () => {
    baselineRunning = true
    const session = await timed.run({
      durationMs: BASELINE_DURATION_MS,
      intervalMs: 2000,
      label: 'Baseline Session',
      kind: 'baseline',
      progressKind: 'baseline',
      onSample: (sample) => broadcast(IPC.probeSample, sample),
      onAdapter: (sample) => broadcast(IPC.adapterSample, sample),
      onProgress: (progress) => broadcast(IPC.timedProgress, progress)
    })
    baselineRunning = false
    await store().save(session)
    await settings().setBaseline(session.id)
    broadcast(IPC.monitorEvent, { running: false, sessionId: session.id })
    broadcast(IPC.timedProgress, {
      kind: 'baseline',
      running: false,
      phase: 'complete',
      elapsedMs: BASELINE_DURATION_MS,
      remainingMs: 0,
      sessionId: session.id
    })
    return {
      running: false,
      startedAt: session.startedAt,
      durationMs: BASELINE_DURATION_MS,
      sessionId: session.id
    }
  })

  ipcMain.handle(IPC.classifyNow, async () => {
    const live = engine.snapshot('classify-live')
    const info = await readNetworkInfo()
    const power = process.platform === 'win32' ? await readNicPower() : []
    return classifyFromSession(live, {
      linkSpeedBps: info.adapters[0]?.linkSpeedBps ?? null,
      nicMayPowerOff: power.some((item) => /enable/i.test(item.allowComputerToTurnOffDevice))
    })
  })

  ipcMain.handle(IPC.nicInspect, async () => {
    const info = await readNetworkInfo()
    const features = await readNicAdvanced()
    const power = await readNicPower()
    const scheme = await readPowerScheme()
    const linkWarnings = info.adapters
      .map((adapter) => linkSpeedWarning(adapter.linkSpeedBps))
      .filter((item): item is string => Boolean(item))
    if (scheme) {
      linkWarnings.push(`Active power plan: ${scheme.name} (${scheme.guid}).`)
    }
    return {
      adapters: info.adapters,
      features,
      linkWarnings,
      power,
      elevated: await isElevated()
    }
  })

  ipcMain.handle(IPC.dnsBenchmark, async () => benchmarkDns())
  ipcMain.handle(IPC.mtuProbe, async () => {
    lastMtu = await probePathMtu()
    return lastMtu
  })
  ipcMain.handle(IPC.routerInspect, async () => inspectRouter())
  ipcMain.handle(IPC.bufferbloatStart, async () => {
    const result = await bufferbloat.run((phase) => {
      broadcast(IPC.timedProgress, {
        kind: 'bufferbloat',
        running: true,
        phase,
        elapsedMs: 0,
        remainingMs: 0,
        sessionId: null
      })
    })
    broadcast(IPC.timedProgress, {
      kind: 'bufferbloat',
      running: false,
      phase: 'complete',
      elapsedMs: 0,
      remainingMs: 0,
      sessionId: null
    })
    return result
  })
  ipcMain.handle(IPC.bufferbloatCancel, async () => {
    bufferbloat.cancel()
    return { cancelled: true }
  })

  ipcMain.handle(IPC.abRun, async (_event, payload: unknown) => {
    const input = parseOrThrow(abRunSchema, payload)
    const live = engine.snapshot('ab-preview')
    const listed = await store().list()
    const previous = listed[0] ? await store().get(listed[0].id) : null
    const diagnosis =
      live.diagnosis.scope === 'insufficient_data' && previous ? previous.diagnosis : live.diagnosis
    const cfg = await settings().get()
    const features = process.platform === 'win32' ? await readNicAdvanced() : []
    const result = await runAbOptimization({
      actionId: input.actionId,
      diagnosis,
      platform: process.platform,
      backups: backups(),
      engine,
      adapters,
      hasBaseline: Boolean(cfg.baselineSessionId),
      mtuMismatch: lastMtu?.fragmentationEvidence === true,
      nicFeaturePresent: features.some((feature) =>
        input.actionId === 'nic-eee' ? feature.kind === 'eee' : feature.kind === 'interrupt-moderation'
      ),
      recommendedMtu: lastMtu?.recommendedMtu ?? null,
      mtuConfirm: input.mtuConfirm,
      onSample: (sample) => broadcast(IPC.probeSample, sample),
      onAdapter: (sample) => broadcast(IPC.adapterSample, sample),
      onProgress: (phase, elapsedMs, remainingMs) =>
        broadcast(IPC.timedProgress, {
          kind: 'ab',
          running: true,
          phase,
          elapsedMs,
          remainingMs,
          sessionId: engine.getStatus().sessionId
        }),
      onSave: (session) => store().save(session)
    })
    if (result.comparison.keepChange) await settings().addVerified(input.actionId)
    broadcast(IPC.timedProgress, {
      kind: 'ab',
      running: false,
      phase: result.comparison.verdict,
      elapsedMs: 0,
      remainingMs: 0,
      sessionId: result.afterSessionId
    })
    return result
  })

  ipcMain.handle(IPC.gamingStart, async () => {
    const status = await engine.start(
      {
        intervalMs: 1000,
        timeoutMs: 1500,
        spikeThresholdMs: 100,
        includeGateway: true,
        targets: DEFAULT_PUBLIC_TARGETS
      },
      (sample: ProbeSample) => broadcast(IPC.probeSample, sample)
    )
    adapters.start((sample: AdapterSample) => {
      engine.pushAdapter(sample)
      broadcast(IPC.adapterSample, sample)
    })
    broadcast(IPC.monitorEvent, { running: true, sessionId: status.sessionId })
    return status
  })

  ipcMain.handle(IPC.smartPlan, async () => {
    const cfg = await settings().get()
    const live = engine.snapshot('smart-plan')
    const stored = cfg.baselineSessionId ? await store().get(cfg.baselineSessionId) : null
    const session = stored ?? live
    const info = await readNetworkInfo()
    const features = process.platform === 'win32' ? await readNicAdvanced() : []
    const power = process.platform === 'win32' ? await readNicPower() : []
    const classified = classifyFromSession(session, {
      linkSpeedBps: info.adapters[0]?.linkSpeedBps ?? null,
      nicMayPowerOff: power.some((item) => /enable/i.test(item.allowComputerToTurnOffDevice))
    })
    const actions = planSmartOptimize(classified, Boolean(cfg.baselineSessionId), {
      mtuMismatch: lastMtu?.fragmentationEvidence === true,
      nicEee: features.some((feature) => feature.kind === 'eee'),
      nicIm: features.some((feature) => feature.kind === 'interrupt-moderation')
    })
    const notes = [
      'Smart Optimize applies one measured change at a time. Nothing is silent.',
      'ICMP/TCP is not VALORANT RTT.',
      classified.buckets.unfixableLocally
        ? 'Evidence points past the LAN. A local app cannot force WE onto a different international route.'
        : 'Proposed Windows changes still need your confirm and an A/B keep/rollback.'
    ]
    if (!cfg.baselineSessionId) notes.unshift('Capture a Baseline Session before any Windows change.')
    return { classifier: classified, actions, hasBaseline: Boolean(cfg.baselineSessionId), notes }
  })

  ipcMain.handle(IPC.valorantReport, async (_event, payload: unknown) => {
    const input = parseOrThrow(valorantReportSchema, payload)
    const before = await store().get(input.beforeId)
    const after = await store().get(input.afterId)
    if (!before || !after) throw new Error('Both sessions are required for the VALORANT report')
    return buildValorantReport(before, after)
  })
}

export function stopBackgroundWork(): void {
  adapters.stop()
  engine.stop()
  bufferbloat.cancel()
  traceAbort?.abort()
  if (baselineRunning) void timed.cancel('Baseline Session (stopped)', 'baseline')
}
