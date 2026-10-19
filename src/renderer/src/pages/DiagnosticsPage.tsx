import { FormEvent, useMemo, useState } from 'react'
import { inconclusiveCopy } from '../../../shared/report'
import { formatMs, formatPct, scopeTone } from '../lib/format'
import { useAppStore } from '../state/appStore'

export function DiagnosticsPage(): JSX.Element {
  const stability = useAppStore((state) => state.stability)
  const report = useAppStore((state) => state.stabilityReport)
  const history = useAppStore((state) => state.history)
  const startStability = useAppStore((state) => state.startStability)
  const cancelStability = useAppStore((state) => state.cancelStability)
  const loadReport = useAppStore((state) => state.loadReport)
  const markBaseline = useAppStore((state) => state.markBaseline)
  const attachOverlay = useAppStore((state) => state.attachOverlay)
  const [rtt, setRtt] = useState('36')
  const [loss, setLoss] = useState('')
  const [note, setNote] = useState('')
  const running = Boolean(stability?.running)
  const remainingMin = Math.ceil((stability?.remainingMs ?? 0) / 60000)
  const tests = useMemo(() => history.filter((item) => item.kind === 'stability'), [history])
  const inconclusive = report ? inconclusiveCopy(report) : []

  const onAttach = (event: FormEvent): void => {
    event.preventDefault()
    const sessionId = report?.sessionId ?? tests[0]?.id
    if (!sessionId) return
    const rttMs = Number.parseFloat(rtt)
    const lossPct = loss.trim() === '' ? undefined : Number.parseFloat(loss)
    if (!Number.isFinite(rttMs)) return
    void attachOverlay(sessionId, rttMs, Number.isFinite(lossPct) ? lossPct : undefined, note || undefined)
    setNote('')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">15-minute stability test</h1>
          <p className="mt-1 max-w-3xl text-sm text-white/55">
            Records gateway, WE DNS, public ICMP, AWS Bahrain TCP, and adapter throughput. It does not invent
            samples and does not touch Vanguard. Overlay RTT/loss still come from you.
          </p>
        </div>
        {running ? (
          <button onClick={() => void cancelStability()} className="rounded-xl bg-pulse-bad px-4 py-2 text-sm font-semibold">
            Cancel test
          </button>
        ) : (
          <button onClick={() => void startStability()} className="rounded-xl bg-sand-500 px-4 py-2 text-sm font-semibold text-ink-950">
            Start 15-minute test
          </button>
        )}
      </div>

      <section className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
        <div className="text-sm text-white/70">
          {running
            ? `Running · ${remainingMin} min remaining · ${stability?.rounds ?? 0} rounds`
            : 'Idle · a full window is 15 minutes at 2s probe spacing'}
        </div>
        {stability && Object.keys(stability.lastByTarget).length > 0 ? (
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {Object.entries(stability.lastByTarget).map(([id, value]) => (
              <div key={id} className="rounded-xl bg-ink-900 px-3 py-2 font-mono text-xs">
                {id}: {formatMs(value)}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {report ? (
        <section className="space-y-3 rounded-2xl border border-white/5 bg-ink-800/70 p-4">
          <div className={`text-xs uppercase tracking-[0.16em] ${scopeTone(report.diagnosis.scope)}`}>
            {report.diagnosis.scope.replaceAll('_', ' ')} · {(report.diagnosis.confidence * 100).toFixed(0)}% confidence
          </div>
          <p className="text-sm leading-6 text-white/75">{report.diagnosis.summary}</p>
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-white/35">
                <tr>
                  <th className="pb-2">Target</th>
                  <th>p50</th>
                  <th>p95</th>
                  <th>Jitter</th>
                  <th>Loss</th>
                  <th>Spikes</th>
                </tr>
              </thead>
              <tbody>
                {report.targetMetrics.map((target) => (
                  <tr key={target.id} className="border-t border-white/5 font-mono text-xs">
                    <td className="py-2 font-sans">{target.label}</td>
                    <td>{formatMs(target.metrics.p50Ms)}</td>
                    <td>{formatMs(target.metrics.p95Ms)}</td>
                    <td>{formatMs(target.metrics.jitterMs)}</td>
                    <td>{formatPct(target.metrics.lossPct)}</td>
                    <td>{target.metrics.spikeCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-xs text-white/45">
            Overlay p95 {formatMs(report.valorantMetrics?.p95Ms)} · overlay loss {formatPct(report.valorantLossAvg)} ·
            spike/upload coincidence {formatPct(report.coincidence.spikeWithHighUploadPct)}
          </div>
          {report.comparisonToBaseline ? (
            <div className="rounded-xl bg-ink-900 p-3 text-xs text-white/60">
              Compared to baseline {report.comparisonToBaseline.beforeLabel}. Public ICMP movement is not a VALORANT
              claim unless overlay p95 also moved.
              <ul className="mt-2 grid gap-1 md:grid-cols-2">
                {report.comparisonToBaseline.deltas.map((delta) => (
                  <li key={delta.key}>
                    {delta.label}: {delta.before ?? 'n/a'} → {delta.after ?? 'n/a'} (Δ {delta.delta ?? 'n/a'})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {inconclusive.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-xs text-white/45">
              {inconclusive.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={onAttach} className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
          <h2 className="text-sm font-semibold">Attach VALORANT overlay to this report</h2>
          <label className="mt-3 block text-xs text-white/45">
            In-game RTT (ms)
            <input value={rtt} onChange={(event) => setRtt(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm" />
          </label>
          <label className="mt-3 block text-xs text-white/45">
            In-game loss % (optional)
            <input value={loss} onChange={(event) => setLoss(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm" />
          </label>
          <label className="mt-3 block text-xs text-white/45">
            Note
            <input value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm" />
          </label>
          <button className="mt-3 w-full rounded-xl bg-white/10 px-3 py-2 text-sm">Save overlay sample</button>
        </form>
        <div className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
          <h2 className="text-sm font-semibold">Saved tests</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {tests.length === 0 ? <li className="text-white/40">No 15-minute tests stored yet.</li> : null}
            {tests.map((item) => (
              <li key={item.id} className="flex items-center justify-between rounded-xl bg-ink-900 px-3 py-2">
                <button className="text-left" onClick={() => void loadReport(item.id)}>
                  {item.label}
                  <div className="text-[11px] text-white/35">
                    p95 {formatMs(item.regionalP95)} · {item.scope.replaceAll('_', ' ')}
                  </div>
                </button>
                <button className="text-xs text-sand-400" onClick={() => void markBaseline(item.id)}>
                  Set baseline
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
