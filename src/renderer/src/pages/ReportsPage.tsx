import { useMemo, useState } from 'react'
import { DiagnosticsPage } from './DiagnosticsPage'
import { useAppStore } from '../state/appStore'

export function ReportsPage(): JSX.Element {
  const history = useAppStore((state) => state.history)
  const report = useAppStore((state) => state.valorantOpt)
  const loadValorantReport = useAppStore((state) => state.loadValorantReport)
  const [before, setBefore] = useState(history.find((item) => item.kind === 'baseline')?.id ?? history[0]?.id ?? '')
  const [after, setAfter] = useState(history[0]?.id ?? '')
  const options = useMemo(() => history, [history])

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">VALORANT Riyadh Optimization Report</h1>
          <p className="mt-1 max-w-3xl text-sm text-white/55">
            Percentages are computed from stored windows. Overlay RTT is only what you typed. ICMP/TCP is not the game.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={before} onChange={(event) => setBefore(event.target.value)} className="rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm">
            {options.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <select value={after} onChange={(event) => setAfter(event.target.value)} className="rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-sm">
            {options.map((item) => (
              <option key={`a-${item.id}`} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <button
            className="rounded-xl bg-sand-500 px-4 py-2 text-sm font-semibold text-ink-950"
            onClick={() => {
              if (before && after) void loadValorantReport(before, after)
            }}
          >
            Build report
          </button>
        </div>
        {report ? (
          <article className="rounded-2xl border border-white/5 bg-ink-800/70 p-4 text-sm leading-6 text-white/70">
            <p>{report.summary}</p>
            <dl className="mt-3 grid gap-2 md:grid-cols-2">
              <div>Overlay before {report.overlayBefore ?? 'n/a'} ms</div>
              <div>Overlay after {report.overlayAfter ?? 'n/a'} ms</div>
              <div>Gateway p95 Δ {report.gatewayP95Delta ?? 'n/a'}</div>
              <div>Internet p95 Δ {report.internetP95Delta ?? 'n/a'}</div>
              <div>Jitter Δ {report.jitterDelta ?? 'n/a'}</div>
              <div>Spike Δ {report.spikeDelta ?? 'n/a'}</div>
              <div>Local stability {report.localStabilityPct ?? 'n/a'}%</div>
              <div>Path floor unchanged {report.pathFloorUnchanged ? 'yes' : 'not claimed'}</div>
            </dl>
            <ul className="mt-3 list-disc pl-5 text-xs text-white/45">
              {report.caveats.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </article>
        ) : null}
      </section>
      <DiagnosticsPage />
    </div>
  )
}
