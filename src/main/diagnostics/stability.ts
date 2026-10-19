import { DEFAULT_PUBLIC_TARGETS, STABILITY_DURATION_MS, STABILITY_INTERVAL_MS } from '../../shared/constants'
import { buildStabilityReport } from '../../shared/report'
import type { AdapterSample, ProbeSample, StabilityProgress, StoredSession } from '../../shared/types'
import { AdapterMonitor } from '../network/adapters'
import { ProbeEngine } from '../network/engine'

export class StabilityRunner {
  private timer: ReturnType<typeof setInterval> | null = null
  private durationMs = STABILITY_DURATION_MS
  private completing = false

  constructor(
    private readonly engine: ProbeEngine,
    private readonly adapters: AdapterMonitor
  ) {}

  status(): { running: boolean; startedAt: number | null; durationMs: number; sessionId: string | null } {
    const monitor = this.engine.getStatus()
    return {
      running: monitor.running && this.timer !== null,
      startedAt: monitor.startedAt,
      durationMs: this.durationMs,
      sessionId: monitor.sessionId
    }
  }

  progress(): StabilityProgress {
    const monitor = this.engine.getStatus()
    const startedAt = monitor.startedAt ?? Date.now()
    const elapsedMs = monitor.running ? Date.now() - startedAt : 0
    const lastByTarget: Record<string, number | null> = {}
    for (const target of monitor.targets) {
      const samples = this.engine.getSamples().filter((sample) => sample.targetId === target.id)
      lastByTarget[target.id] = samples.at(-1)?.rttMs ?? null
    }
    return {
      running: Boolean(this.timer) && monitor.running,
      elapsedMs,
      remainingMs: Math.max(0, this.durationMs - elapsedMs),
      rounds: Math.max(...monitor.targets.map((target) => this.engine.getSamples().filter((s) => s.targetId === target.id).length), 0),
      sessionId: monitor.sessionId,
      lastByTarget
    }
  }

  async start(
    onSample: (sample: ProbeSample) => void,
    onAdapter: (sample: AdapterSample) => void,
    onProgress: (progress: StabilityProgress) => void,
    onDone: (session: StoredSession, cancelled: boolean) => void
  ): Promise<void> {
    this.cancelTimer()
    this.durationMs = STABILITY_DURATION_MS
    await this.engine.start(
      {
        intervalMs: STABILITY_INTERVAL_MS,
        timeoutMs: 1500,
        spikeThresholdMs: 100,
        includeGateway: true,
        targets: DEFAULT_PUBLIC_TARGETS
      },
      onSample
    )
    this.adapters.start((sample) => {
      this.engine.pushAdapter(sample)
      onAdapter(sample)
    })
    this.timer = setInterval(() => {
      const snapshot = this.progress()
      onProgress(snapshot)
      if (snapshot.elapsedMs >= this.durationMs && !this.completing) {
        this.completing = true
        void this.finish(onDone, false)
      }
    }, 1000)
    onProgress(this.progress())
  }

  async cancel(onDone: (session: StoredSession, cancelled: boolean) => void): Promise<void> {
    await this.finish(onDone, true)
  }

  private async finish(
    onDone: (session: StoredSession, cancelled: boolean) => void,
    cancelled: boolean
  ): Promise<void> {
    this.cancelTimer()
    this.adapters.stop()
    this.engine.stop()
    this.completing = false
    const session = this.engine.snapshot('15-minute stability test', 'stability')
    onDone(session, cancelled)
  }

  private cancelTimer(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}

export { buildStabilityReport }
