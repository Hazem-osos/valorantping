import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { INVOKE_CHANNELS, RECEIVE_CHANNELS } from '../shared/constants'
import type { DesktopApi } from '../shared/api'

const invokeSet = new Set<string>(INVOKE_CHANNELS)
const receiveSet = new Set<string>(RECEIVE_CHANNELS)

function invoke<T>(channel: string, payload?: unknown): Promise<T> {
  if (!invokeSet.has(channel)) throw new Error(`Blocked IPC invoke: ${channel}`)
  return ipcRenderer.invoke(channel, payload) as Promise<T>
}

function listen<T>(channel: string, cb: (payload: T) => void): () => void {
  if (!receiveSet.has(channel)) throw new Error(`Blocked IPC listener: ${channel}`)
  const wrapped = (_event: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

const api: DesktopApi = {
  getNetworkInfo: () => invoke('network:info'),
  startMonitor: (input) => invoke('monitor:start', input),
  stopMonitor: () => invoke('monitor:stop'),
  getMonitorStatus: () => invoke('monitor:status'),
  runTraceroute: (input) => invoke('traceroute:run', input),
  cancelTraceroute: () => invoke('traceroute:cancel'),
  startValorantSession: (label) => invoke('valorant:start', { label }),
  addValorantSample: (rttMs, note, lossPct) => invoke('valorant:sample', { rttMs, note, lossPct }),
  stopValorantSession: () => invoke('valorant:stop'),
  saveSnapshot: (label) => invoke('history:save', label),
  listHistory: () => invoke('history:list'),
  getHistory: (id) => invoke('history:get', id),
  deleteHistory: (id) => invoke('history:delete', id),
  compareSessions: (beforeId, afterId) => invoke('history:compare', { beforeId, afterId }),
  exportCsv: (id) => invoke('history:export', id),
  getAppInfo: () => invoke('app:info'),
  getOptimizeOffers: () => invoke('optimize:offers'),
  scanCongestion: () => invoke('optimize:scan'),
  applyOptimize: (actionId) => invoke('optimize:apply', { actionId, confirm: true }),
  listBackups: () => invoke('optimize:backups'),
  rollbackBackup: (backupId) => invoke('optimize:rollback', { backupId }),
  startStability: () => invoke('stability:start'),
  cancelStability: () => invoke('stability:cancel'),
  getStabilityStatus: () => invoke('stability:status'),
  getStabilityReport: (id) => invoke('stability:report', id),
  setBaseline: (sessionId) => invoke('stability:baseline', { sessionId }),
  attachValorant: (sessionId, rttMs, lossPct, note) =>
    invoke('valorant:attach', { sessionId, rttMs, lossPct, note }),
  startBaseline: () => invoke('baseline:start'),
  classifyNow: () => invoke('classify:now'),
  inspectNic: () => invoke('nic:inspect'),
  benchmarkDns: () => invoke('dns:benchmark'),
  probeMtu: () => invoke('mtu:probe'),
  inspectRouter: () => invoke('router:inspect'),
  startBufferbloat: () => invoke('bufferbloat:start'),
  cancelBufferbloat: () => invoke('bufferbloat:cancel'),
  runAb: (actionId, mtuConfirm) => invoke('ab:run', { actionId, confirm: true, mtuConfirm }),
  startGaming: () => invoke('gaming:start'),
  smartPlan: () => invoke('smart:plan'),
  valorantReport: (beforeId, afterId) => invoke('valorant:report', { beforeId, afterId }),
  onProbeSample: (cb) => listen('probe:sample', cb),
  onAdapterSample: (cb) => listen('adapter:sample', cb),
  onTraceHop: (cb) => listen('trace:hop', cb),
  onMonitorEvent: (cb) => listen('monitor:event', cb),
  onStabilityProgress: (cb) => listen('stability:progress', cb),
  onTimedProgress: (cb) => listen('timed:progress', cb)
}

contextBridge.exposeInMainWorld('api', api)
