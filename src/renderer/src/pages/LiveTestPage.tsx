import { useMemo } from 'react'
import { LiveChart } from '../components/LiveChart'
import { MetricCard } from '../components/MetricCard'
import { formatMs, formatPct, formatRate, scopeTone } from '../lib/format'
import { liveDiagnosis, useAppStore } from '../state/appStore'
import { summarizeSamples } from '../../../shared/metrics'

export function LiveTestPage(): JSX.Element {
  const monitor = useAppStore((state) => state.monitor)
  const samples = useAppStore((state) => state.samples)
  const adapters = useAppStore((state) => state.adapters)
  const network = useAppStore((state) => state.network)
  const intervalMs = useAppStore((state) => state.intervalMs)
  const timeoutMs = useAppStore((state) => state.timeoutMs)
  const spikeThresholdMs = useAppStore((state) => state.spikeThresholdMs)
  const snapshotLabel = useAppStore((state) => state.snapshotLabel)
  const start = useAppStore((state) => state.start)
  const stop = useAppStore((state) => state.stop)
  const saveSnapshot = useAppStore((state) => state.saveSnapshot)
  const setSetting = useAppStore((state) => state.setSetting)
  const state = useAppStore()
  const diagnosis = liveDiagnosis(state)
  const targets = useMemo(() => monitor?.targets ?? [], [monitor?.targets])

  const metricsByTarget = useMemo(
    () =>
      Object.fromEntries(
        targets.map((target) => [target.id, summarizeSamples(samples[target.id] ?? [], spikeThresholdMs)])
      ),
    [targets, samples, spikeThresholdMs]
  )

  const chartData = useMemo(() => {
    const stamps = new Set<number>()
    for (const list of Object.values(samples)) {
      for (const sample of list) stamps.add(sample.t)
    }
    return [...stamps]
      .sort((a, b) => a - b)
      .map((t) => {
        const row: Record<string, number | null> & { t: number } = { t }
        for (const target of targets) {
          const hit = (samples[target.id] ?? []).find((sample) => sample.t === t)
          row[target.id] = hit?.timedOut ? null : (hit?.rttMs ?? null)
        }
        return row
      })
  }, [samples, targets])

  const throughput = useMemo(
    () =>
      adapters.map((sample) => ({
        t: sample.t,
        down: Math.round((sample.bytesInPerSec * 8) / 1000),
        up: Math.round((sample.bytesOutPerSec * 8) / 1000)
      })),
    [adapters]
  )

  const gateway = metricsByTarget.gateway
  const regional =
    metricsByTarget['aws-bahrain-tcp'] ?? metricsByTarget.cloudflare ?? Object.values(metricsByTarget)[0]
  const latestAdapter = adapters[adapters.length - 1]
  const spikeTone =
    (regional?.spikeCount ?? 0) >= 3 ? 'bad' : (regional?.jitterMs ?? 0) > 15 ? 'warn' : 'good'

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-white/50">
            Gateway {network?.gateway ?? 'detecting…'} · {network?.adapters[0]?.name ?? 'adapter pending'}
          </div>
          <h1 className="text-2xl font-semibold">Live test</h1>
        </div>
        <div className="flex gap-2">
          {monitor?.running ? (
            <button onClick={() => void stop()} className="rounded-xl bg-pulse-bad px-4 py-2 text-sm font-semibold">
              Stop
            </button>
          ) : (
            <button onClick={() => void start()} className="rounded-xl bg-sand-500 px-4 py-2 text-sm font-semibold text-ink-950">
              Start probing
            </button>
          )}
          <button onClick={() => void saveSnapshot()} className="rounded-xl border border-white/10 px-4 py-2 text-sm">
            Save snapshot
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label="Gateway RTT"
          value={formatMs(gateway?.p95Ms ?? gateway?.lastMs)}
          hint="LAN should stay near 1ms on Ethernet"
          tone={!gateway || gateway.lastMs === null ? 'neutral' : (gateway.p95Ms ?? 0) > 15 ? 'bad' : 'good'}
        />
        <MetricCard
          label="Regional/public p95"
          value={formatMs(regional?.p95Ms)}
          hint="Not Riot in-game RTT"
          tone={!regional || regional.lastMs === null ? 'neutral' : spikeTone}
        />
        <MetricCard
          label="Jitter |ΔRTT|"
          value={formatMs(regional?.jitterMs)}
          hint={`${regional?.spikeCount ?? 0} spikes ≥ ${spikeThresholdMs}ms`}
          tone={(regional?.jitterMs ?? 0) > 20 ? 'bad' : 'neutral'}
        />
        <MetricCard
          label="Loss / timeouts"
          value={formatPct(regional?.lossPct)}
          hint={`Up ${formatRate(latestAdapter?.bytesOutPerSec)} · Down ${formatRate(latestAdapter?.bytesInPerSec)}`}
          tone={(regional?.lossPct ?? 0) > 3 ? 'bad' : 'good'}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
        <div className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">RTT by probe target</h2>
            <span className="text-[11px] text-white/40">Timeouts appear as gaps</span>
          </div>
          <LiveChart
            data={chartData}
            keys={targets.map((target) => ({ id: target.id, label: target.label }))}
          />
        </div>
        <div className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
          <div className={`text-xs uppercase tracking-[0.16em] ${scopeTone(diagnosis.scope)}`}>
            {diagnosis.scope.replaceAll('_', ' ')} · {(diagnosis.confidence * 100).toFixed(0)}% confidence
          </div>
          <p className="mt-2 text-sm leading-6 text-white/75">{diagnosis.summary}</p>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-white/55">
            {diagnosis.findings.slice(0, 4).map((finding) => (
              <li key={finding.id}>
                <span className="text-white/80">{finding.title}.</span> {finding.evidence}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
        <h2 className="mb-3 text-sm font-semibold">Adapter throughput (kbps)</h2>
        <LiveChart
          data={throughput}
          unit="kbps"
          keys={[
            { id: 'down', label: 'Down kbps' },
            { id: 'up', label: 'Up kbps' }
          ]}
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
          <h2 className="mb-3 text-sm font-semibold">Probe table</h2>
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-white/35">
              <tr>
                <th className="pb-2">Target</th>
                <th>Last</th>
                <th>p95</th>
                <th>p99</th>
                <th>Jitter</th>
                <th>Loss</th>
                <th>Spikes</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((target) => {
                const metrics = metricsByTarget[target.id]
                return (
                  <tr key={target.id} className="border-t border-white/5 font-mono text-xs">
                    <td className="py-2 font-sans text-white/80">
                      {target.label}
                      <div className="text-[10px] text-white/35">
                        {target.protocol.toUpperCase()} · {target.host}
                      </div>
                    </td>
                    <td>{formatMs(metrics?.lastMs)}</td>
                    <td>{formatMs(metrics?.p95Ms)}</td>
                    <td>{formatMs(metrics?.p99Ms)}</td>
                    <td>{formatMs(metrics?.jitterMs)}</td>
                    <td>{formatPct(metrics?.lossPct)}</td>
                    <td>{metrics?.spikeCount ?? 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
          <h2 className="mb-3 text-sm font-semibold">Probe bounds</h2>
          <label className="block text-xs text-white/45">
            Interval ms
            <input
              type="number"
              min={500}
              max={10000}
              value={intervalMs}
              onChange={(event) => setSetting('intervalMs', Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm"
            />
          </label>
          <label className="mt-3 block text-xs text-white/45">
            Timeout ms
            <input
              type="number"
              min={100}
              max={5000}
              value={timeoutMs}
              onChange={(event) => setSetting('timeoutMs', Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm"
            />
          </label>
          <label className="mt-3 block text-xs text-white/45">
            Spike threshold ms
            <input
              type="number"
              min={20}
              max={500}
              value={spikeThresholdMs}
              onChange={(event) => setSetting('spikeThresholdMs', Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm"
            />
          </label>
          <label className="mt-3 block text-xs text-white/45">
            Snapshot label
            <input
              value={snapshotLabel}
              onChange={(event) => setSetting('snapshotLabel', event.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>
    </div>
  )
}
