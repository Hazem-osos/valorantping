import { DEFAULT_PUBLIC_TARGETS } from '../../shared/constants'
import type { AdapterSample, ProbeSample, StoredSession, TimedProgress } from '../../shared/types'
import { AdapterMonitor } from '../network/adapters'
import { ProbeEngine } from '../network/engine'

export class TimedProbe {
  private timer: ReturnType<typeof setInterval> | null = null
  private completing = false
  private durationMs = 0
  private kind: TimedProgress['kind'] = 'baseline'

  constructor(
    private readonly engine: ProbeEngine,
    private readonly adapters: AdapterMonitor
  ) {}

  progress(): TimedProgress {
    const monitor = this.engine.getStatus()
    const startedAt = monitor.startedAt ?? Date.now()
    const elapsedMs = monitor.running ? Date.now() - startedAt : 0
    return {
      kind: this.kind,
      running: Boolean(this.timer) && monitor.running,
      phase: monitor.running ? 'probing' : 'idle',
      elapsedMs,
      remainingMs: Math.max(0, this.durationMs - elapsedMs),
      sessionId: monitor.sessionId
    }
  }

  async run(input: {
    durationMs: number
    intervalMs: number
    label: string
    kind: StoredSession['kind']
    progressKind: TimedProgress['kind']
    onSample: (sample: ProbeSample) => void
    onAdapter: (sample: AdapterSample) => void
    onProgress: (progress: TimedProgress) => void
  }): Promise<StoredSession> {
    this.cancelTimer()
    this.durationMs = input.durationMs
    this.kind = input.progressKind
    await this.engine.start(
      {
        intervalMs: input.intervalMs,
        timeoutMs: 1500,
        spikeThresholdMs: 100,
        includeGateway: true,
        targets: DEFAULT_PUBLIC_TARGETS
      },
      input.onSample
    )
    this.adapters.start((sample) => {
      this.engine.pushAdapter(sample)
      input.onAdapter(sample)
    })
    return await new Promise<StoredSession>((resolve) => {
      this.timer = setInterval(() => {
        const snapshot = this.progress()
        input.onProgress(snapshot)
        if (snapshot.elapsedMs >= this.durationMs && !this.completing) {
          this.completing = true
          void this.finish(input.label, input.kind).then(resolve)
        }
      }, 500)
      input.onProgress(this.progress())
    })
  }

  async cancel(label: string, kind: StoredSession['kind']): Promise<StoredSession> {
    return this.finish(label, kind)
  }

  private async finish(label: string, kind: StoredSession['kind']): Promise<StoredSession> {
    this.cancelTimer()
    this.adapters.stop()
    this.engine.stop()
    this.completing = false
    return this.engine.snapshot(label, kind)
  }

  private cancelTimer(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}
