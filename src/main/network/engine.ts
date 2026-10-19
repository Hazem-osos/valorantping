import { randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { DEFAULT_PUBLIC_TARGETS } from '../../shared/constants'
import { correlateLatencyAndUpload } from '../../shared/correlation'
import { diagnose } from '../../shared/diagnosis'
import { downsample, summarizeSamples, summarizeValorant } from '../../shared/metrics'
import type {
  AdapterSample,
  MonitorStatus,
  ProbeSample,
  ProbeStartInput,
  ProbeTarget,
  StoredSession,
  ValorantSample
} from '../../shared/types'
import { icmpPing } from './ping'
import { delay } from './runCommand'
import { tcpConnectRtt } from './tcpPing'
import { readNetworkInfo } from './gateway'

const MAX_IN_MEMORY = 2000

export class ProbeEngine {
  private abort: AbortController | null = null
  private status: MonitorStatus = {
    running: false,
    sessionId: null,
    startedAt: null,
    intervalMs: 1000,
    timeoutMs: 1500,
    spikeThresholdMs: 100,
    targets: []
  }
  private samples = new Map<string, ProbeSample[]>()
  private adapters: AdapterSample[] = []
  private valorant: ValorantSample[] = []
  private valorantLabel: string | null = null
  private valorantStartedAt: number | null = null
  private resolved = new Map<string, string>()
  private gateway: string | null = null

  getStatus(): MonitorStatus {
    return { ...this.status, targets: [...this.status.targets] }
  }

  getSamples(): ProbeSample[] {
    return [...this.samples.values()].flat()
  }

  getAdapterSamples(): AdapterSample[] {
    return [...this.adapters]
  }

  getValorant(): ValorantSample[] {
    return [...this.valorant]
  }

  async start(
    input: ProbeStartInput,
    onSample: (sample: ProbeSample) => void
  ): Promise<MonitorStatus> {
    this.stop()
    const info = await readNetworkInfo()
    this.gateway = info.gateway
    const targets: ProbeTarget[] = []
    if (input.includeGateway && info.gateway) {
      targets.push({
        id: 'gateway',
        label: 'Default gateway',
        host: info.gateway,
        kind: 'gateway',
        protocol: 'icmp'
      })
    }
    const extra = input.targets.length > 0 ? input.targets : DEFAULT_PUBLIC_TARGETS
    for (const target of extra) {
      if (targets.length >= 8) break
      if (targets.some((item) => item.id === target.id)) continue
      targets.push(target)
    }

    for (const target of targets) {
      try {
        const resolved = await lookup(target.host)
        this.resolved.set(target.id, resolved.address)
      } catch {
        this.resolved.set(target.id, target.host)
      }
    }

    this.abort = new AbortController()
    this.samples.clear()
    this.adapters = []
    const sessionId = randomUUID()
    this.status = {
      running: true,
      sessionId,
      startedAt: Date.now(),
      intervalMs: input.intervalMs,
      timeoutMs: input.timeoutMs,
      spikeThresholdMs: input.spikeThresholdMs,
      targets
    }
    void this.loop(onSample)
    return this.getStatus()
  }

  stop(): MonitorStatus {
    this.abort?.abort()
    this.abort = null
    this.status = { ...this.status, running: false }
    return this.getStatus()
  }

  pushAdapter(sample: AdapterSample): void {
    this.adapters.push(sample)
    if (this.adapters.length > MAX_IN_MEMORY) this.adapters.splice(0, this.adapters.length - MAX_IN_MEMORY)
  }

  startValorant(label: string): void {
    this.valorant = []
    this.valorantLabel = label
    this.valorantStartedAt = Date.now()
  }

  addValorant(sample: ValorantSample): void {
    this.valorant.push(sample)
  }

  private async loop(onSample: (sample: ProbeSample) => void): Promise<void> {
    const signal = this.abort?.signal
    if (!signal) return
    while (!signal.aborted && this.status.running) {
      const roundStart = Date.now()
      await Promise.all(
        this.status.targets.map(async (target) => {
          const result = await this.probeTarget(target, signal)
          const sample: ProbeSample = {
            sessionId: this.status.sessionId ?? '',
            targetId: target.id,
            t: Date.now(),
            rttMs: result.rttMs === null ? null : Math.round(result.rttMs * 10) / 10,
            timedOut: result.timedOut,
            protocol: target.protocol,
            resolvedHost: this.resolved.get(target.id),
            error: result.error
          }
          const list = this.samples.get(target.id) ?? []
          list.push(sample)
          if (list.length > MAX_IN_MEMORY) list.splice(0, list.length - MAX_IN_MEMORY)
          this.samples.set(target.id, list)
          onSample(sample)
        })
      )
      const elapsed = Date.now() - roundStart
      try {
        await delay(Math.max(50, this.status.intervalMs - elapsed), signal)
      } catch {
        break
      }
    }
  }

  private async probeTarget(
    target: ProbeTarget,
    signal: AbortSignal
  ): Promise<{ rttMs: number | null; timedOut: boolean; error?: string }> {
    const host = this.resolved.get(target.id) ?? target.host
    if (target.protocol === 'tcp') {
      return tcpConnectRtt(host, target.port ?? 443, this.status.timeoutMs, signal)
    }
    return icmpPing(host, this.status.timeoutMs, signal)
  }

  snapshot(label: string, kind?: StoredSession['kind']): StoredSession {
    const endedAt = Date.now()
    const startedAt = Math.min(this.status.startedAt ?? endedAt, this.valorantStartedAt ?? endedAt)
    const duration = Math.max(1000, endedAt - startedAt)
    const bucketMs = duration > 12 * 60_000 ? 15_000 : duration > 4 * 60_000 ? 5_000 : 1000
    const allRtts = this.getSamples().map((sample) => ({ t: sample.t, rttMs: sample.rttMs }))
    const coincidence = correlateLatencyAndUpload({
      rtts: allRtts,
      uploads: this.adapters.map((sample) => ({ t: sample.t, bytesOutPerSec: sample.bytesOutPerSec })),
      spikeThresholdMs: this.status.spikeThresholdMs
    })
    const windows: Record<string, { kind: ProbeTarget['kind']; metrics: ReturnType<typeof summarizeSamples>; label: string }> =
      {}
    const targets = this.status.targets.map((target) => {
      const samples = this.samples.get(target.id) ?? []
      const metrics = summarizeSamples(samples, this.status.spikeThresholdMs)
      windows[target.id] = { kind: target.kind, metrics, label: target.label }
      const series = downsample(samples, bucketMs).map((point) => {
        const nearby = this.adapters.filter((adapter) => Math.abs(adapter.t - point.t) <= bucketMs)
        const inBps = nearby.length
          ? nearby.reduce((sum, item) => sum + item.bytesInPerSec, 0) / nearby.length
          : null
        const outBps = nearby.length
          ? nearby.reduce((sum, item) => sum + item.bytesOutPerSec, 0) / nearby.length
          : null
        return { ...point, inBps, outBps }
      })
      return {
        target,
        resolvedHost: this.resolved.get(target.id),
        metrics,
        series
      }
    })
    const valorantMetrics = summarizeValorant(this.valorant, this.status.spikeThresholdMs)
    const diagnosis = diagnose({
      windows,
      coincidence,
      valorant: valorantMetrics,
      spikeThresholdMs: this.status.spikeThresholdMs
    })
    return {
      id: this.status.sessionId ?? randomUUID(),
      kind: kind ?? (this.valorant.length ? 'combined' : 'probe'),
      label: this.valorantLabel ? `${label} · ${this.valorantLabel}` : label,
      startedAt,
      endedAt,
      spikeThresholdMs: this.status.spikeThresholdMs,
      platform: process.platform,
      gateway: this.gateway,
      targets,
      valorant: [...this.valorant],
      valorantMetrics,
      adapterPeakIn: this.adapters.reduce((max, item) => Math.max(max, item.bytesInPerSec), 0),
      adapterPeakOut: this.adapters.reduce((max, item) => Math.max(max, item.bytesOutPerSec), 0),
      coincidence,
      diagnosis
    }
  }
}
