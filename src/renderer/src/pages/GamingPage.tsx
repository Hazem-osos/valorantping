import { FormEvent, useMemo, useState } from 'react'
import { classifyBottleneck } from '../../../shared/classifier'
import { summarizeSamples, summarizeValorant } from '../../../shared/metrics'
import { healthScores } from '../../../shared/scores'
import { MetricCard } from '../components/MetricCard'
import { formatMs, formatPct, formatRate } from '../lib/format'
import { useAppStore } from '../state/appStore'

export function GamingPage(): JSX.Element {
  const monitor = useAppStore((state) => state.monitor)
  const samples = useAppStore((state) => state.samples)
  const adapters = useAppStore((state) => state.adapters)
  const network = useAppStore((state) => state.network)
  const appInfo = useAppStore((state) => state.appInfo)
  const valorant = useAppStore((state) => state.valorant)
  const startGaming = useAppStore((state) => state.startGaming)
  const stop = useAppStore((state) => state.stop)
  const addValorant = useAppStore((state) => state.addValorant)
  const startValorant = useAppStore((state) => state.startValorant)
  const [rtt, setRtt] = useState('36')
  const [loss, setLoss] = useState('')
  const ethernet = (network?.adapters ?? []).some((adapter) => (adapter.linkSpeedBps ?? 0) >= 100_000_000)

  const gateway = useMemo(() => {
    const target = monitor?.targets.find((item) => item.kind === 'gateway')
    return target ? summarizeSamples(samples[target.id] ?? [], 100) : null
  }, [monitor?.targets, samples])
  const far = useMemo(() => {
    const target = monitor?.targets.find((item) => item.kind === 'regional') ?? monitor?.targets.find((item) => item.kind === 'public')
    return target ? summarizeSamples(samples[target.id] ?? [], 100) : null
  }, [monitor?.targets, samples])

  const classifier = classifyBottleneck({
    gateway,
    isp: null,
    publicNet: far,
    regional: far,
    coincidence: {
      sampleCount: gateway?.sampleCount ?? 0,
      spikeCount: (gateway?.spikeCount ?? 0) + (far?.spikeCount ?? 0),
      spikesWithHighUpload: 0,
      spikeWithHighUploadPct: null,
      pearsonRttUpload: null
    },
    valorant: summarizeValorant(valorant, 100),
    linkSpeedBps: network?.adapters[0]?.linkSpeedBps ?? null,
    nicMayPowerOff: false,
    sampleCount: (gateway?.sampleCount ?? 0) + (far?.sampleCount ?? 0)
  })
  const scores = healthScores({
    gateway,
    far,
    diagnosis: classifier.primary,
    testing: Boolean(monitor?.running),
    verifiedOptimizations: appInfo?.verifiedActionIds.length ?? 0
  })
  const latest = adapters[adapters.length - 1]

  const onOverlay = (event: FormEvent): void => {
    event.preventDefault()
    const value = Number.parseFloat(rtt)
    if (!Number.isFinite(value)) return
    if (!useAppStore.getState().valorantActive) void startValorant('Gaming Mode overlay')
    void addValorant(value, 'overlay', loss.trim() ? Number.parseFloat(loss) : undefined)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Gaming Mode</h1>
          <p className="mt-1 max-w-3xl text-sm text-white/55">
            Not a fake booster. It keeps A/B-verified settings, watches Ethernet, gateway vs internet, jitter, loss,
            throughput, and spike timestamps. Probe RTT is not Riot RTT.
          </p>
        </div>
        {monitor?.running ? (
          <button onClick={() => void stop()} className="rounded-xl bg-pulse-bad px-6 py-3 text-sm font-semibold">
            Stop Gaming Mode
          </button>
        ) : (
          <button onClick={() => void startGaming()} className="rounded-xl bg-sand-500 px-6 py-3 text-lg font-semibold text-ink-950">
            Start Gaming Mode
          </button>
        )}
      </div>
      <div className="text-xs text-white/45">
        Ethernet {ethernet ? 'detected' : 'not confirmed'} · verified optimizations {appInfo?.verifiedActionIds.join(', ') || 'none yet'}
      </div>
      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Riyadh Stability Score" value={scores.riyadhStabilityScore?.toString() ?? 'n/a'} hint={scores.riyadhStability} />
        <MetricCard label="Local Network Score" value={scores.localNetwork?.toString() ?? 'n/a'} hint={scores.networkHealth} />
        <MetricCard label="Jitter / loss" value={`${formatMs(far?.jitterMs)} / ${formatPct(far?.lossPct)}`} hint={`${scores.spikes} spikes`} />
        <MetricCard label="Current diagnosis" value={classifier.primary.replaceAll('_', ' ')} hint={classifier.reasons[0] ?? ''} />
      </section>
      <section className="rounded-2xl border border-white/5 bg-ink-800/70 p-4 text-sm text-white/65">
        Gateway {formatMs(gateway?.lastMs)} · internet {formatMs(far?.lastMs)} · up {formatRate(latest?.bytesOutPerSec)} ·
        down {formatRate(latest?.bytesInPerSec)}. Correlate spikes with local upload yourself; processes are never killed.
      </section>
      <form onSubmit={onOverlay} className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
        <h2 className="text-sm font-semibold">VALORANT overlay (typed, never injected)</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={rtt} onChange={(event) => setRtt(event.target.value)} className="rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm" placeholder="RTT ms" />
          <input value={loss} onChange={(event) => setLoss(event.target.value)} className="rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm" placeholder="Loss % optional" />
          <button className="rounded-lg bg-sand-500 px-3 py-2 text-sm font-semibold text-ink-950">Record overlay</button>
        </div>
      </form>
    </div>
  )
}
