import { useMemo } from 'react'
import { classifyBottleneck } from '../../../shared/classifier'
import { summarizeSamples, summarizeValorant } from '../../../shared/metrics'
import { healthScores } from '../../../shared/scores'
import { MetricCard } from '../components/MetricCard'
import { formatMs, formatPct } from '../lib/format'
import { liveDiagnosis, useAppStore } from '../state/appStore'

function gradeTone(grade: string): 'good' | 'warn' | 'bad' | 'neutral' {
  if (grade === 'Excellent' || grade === 'Good') return 'good'
  if (grade === 'Needs Attention' || grade === 'Testing') return 'warn'
  if (grade === 'Poor') return 'bad'
  return 'neutral'
}

export function DashboardPage(): JSX.Element {
  const monitor = useAppStore((state) => state.monitor)
  const samples = useAppStore((state) => state.samples)
  const valorant = useAppStore((state) => state.valorant)
  const network = useAppStore((state) => state.network)
  const appInfo = useAppStore((state) => state.appInfo)
  const timed = useAppStore((state) => state.timed)
  const start = useAppStore((state) => state.start)
  const startBaseline = useAppStore((state) => state.startBaseline)
  const setView = useAppStore((state) => state.setView)
  const spikeThresholdMs = useAppStore((state) => state.spikeThresholdMs)
  const diagnosis = liveDiagnosis(useAppStore.getState())

  const metrics = useMemo(() => {
    const gateway = (monitor?.targets ?? [])
      .filter((target) => target.kind === 'gateway')
      .map((target) => summarizeSamples(samples[target.id] ?? [], spikeThresholdMs))[0]
    const isp = (monitor?.targets ?? [])
      .filter((target) => target.kind === 'isp')
      .map((target) => summarizeSamples(samples[target.id] ?? [], spikeThresholdMs))[0]
    const pub = (monitor?.targets ?? [])
      .filter((target) => target.kind === 'public')
      .map((target) => summarizeSamples(samples[target.id] ?? [], spikeThresholdMs))[0]
    const regional = (monitor?.targets ?? [])
      .filter((target) => target.kind === 'regional')
      .map((target) => summarizeSamples(samples[target.id] ?? [], spikeThresholdMs))[0]
    return { gateway, isp, pub, regional }
  }, [monitor?.targets, samples, spikeThresholdMs])

  const classifier = useMemo(() => {
    const sampleCount = Object.values(samples).reduce((sum, list) => sum + list.length, 0)
    return classifyBottleneck({
      gateway: metrics.gateway ?? null,
      isp: metrics.isp ?? null,
      publicNet: metrics.pub ?? null,
      regional: metrics.regional ?? null,
      coincidence: {
        sampleCount,
        spikeCount: (metrics.gateway?.spikeCount ?? 0) + (metrics.regional?.spikeCount ?? 0),
        spikesWithHighUpload: 0,
        spikeWithHighUploadPct: null,
        pearsonRttUpload: null
      },
      valorant: summarizeValorant(valorant, spikeThresholdMs),
      linkSpeedBps: network?.adapters[0]?.linkSpeedBps ?? null,
      nicMayPowerOff: false,
      sampleCount
    })
  }, [metrics, network?.adapters, samples, spikeThresholdMs, valorant])

  const scores = healthScores({
    gateway: metrics.gateway ?? null,
    far: metrics.regional ?? metrics.pub ?? null,
    diagnosis: classifier.primary,
    testing: Boolean(monitor?.running || timed?.running),
    verifiedOptimizations: appInfo?.verifiedActionIds.length ?? 0
  })

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-white/50">
            Phase {appInfo?.phase ?? 5} · WE Egypt Ethernet · probes are not VALORANT RTT
          </div>
          <h1 className="text-2xl font-semibold">Network health</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void startBaseline()} className="rounded-xl bg-sand-500 px-4 py-2 text-sm font-semibold text-ink-950">
            Run baseline
          </button>
          <button onClick={() => void start()} className="rounded-xl border border-white/10 px-4 py-2 text-sm">
            Live test
          </button>
          <button onClick={() => setView('gaming')} className="rounded-xl border border-white/10 px-4 py-2 text-sm">
            Gaming Mode
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-5">
        <MetricCard label="Network Health" value={scores.networkHealth} hint={`Local score ${scores.localNetwork ?? 'n/a'}`} tone={gradeTone(scores.networkHealth)} />
        <MetricCard label="Riyadh Stability" value={scores.riyadhStability} hint="Probe stability, not overlay RTT" tone={gradeTone(scores.riyadhStability)} />
        <MetricCard label="Current Diagnosis" value={scores.diagnosis.replaceAll('_', ' ')} hint={`${(classifier.confidence * 100).toFixed(0)}% confidence`} tone="neutral" />
        <MetricCard label="Optimizations Verified" value={String(scores.verifiedOptimizations)} hint="Kept after A/B, not guesses" tone="neutral" />
        <MetricCard label="Spikes Detected" value={String(scores.spikes)} hint={`Gateway p95 ${formatMs(metrics.gateway?.p95Ms)}`} tone={scores.spikes >= 3 ? 'bad' : 'good'} />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
          <h2 className="text-sm font-semibold">Why this class</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-white/65">
            {classifier.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-white/40">
            Baseline latency, jitter/spikes, local congestion, and ISP/Riot routing are separate problems. This app
            does not promise that ~36 ms can drop.
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
          <h2 className="text-sm font-semibold">Live snapshot</h2>
          <p className="mt-2 text-sm text-white/60">{diagnosis.summary}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/55">
            <div>Gateway p50 {formatMs(metrics.gateway?.p50Ms)}</div>
            <div>Gateway p99 {formatMs(metrics.gateway?.p99Ms)}</div>
            <div>Internet p95 {formatMs((metrics.regional ?? metrics.pub)?.p95Ms)}</div>
            <div>Loss {formatPct((metrics.regional ?? metrics.pub)?.lossPct)}</div>
            <div>Stdev {formatMs((metrics.regional ?? metrics.pub)?.stdevMs)}</div>
            <div>Baseline {appInfo?.baselineSessionId ? 'captured' : 'not yet'}</div>
          </dl>
        </div>
      </section>
    </div>
  )
}
