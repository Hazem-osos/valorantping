import { formatMs, formatPct, formatWhen } from '../lib/format'
import { useAppStore } from '../state/appStore'

export function HistoryPage(): JSX.Element {
  const history = useAppStore((state) => state.history)
  const comparison = useAppStore((state) => state.comparison)
  const before = useAppStore((state) => state.selectedBefore)
  const after = useAppStore((state) => state.selectedAfter)
  const setSelected = useAppStore((state) => state.setSelected)
  const compare = useAppStore((state) => state.compare)
  const exportId = useAppStore((state) => state.exportId)
  const deleteId = useAppStore((state) => state.deleteId)
  const markBaseline = useAppStore((state) => state.markBaseline)

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Local history</h1>
          <p className="text-sm text-white/50">Stored under this machine’s userData. Nothing is uploaded.</p>
        </div>
        <button
          onClick={() => void compare()}
          disabled={!before || !after}
          className="rounded-xl bg-sand-500 px-4 py-2 text-sm font-semibold text-ink-950 disabled:opacity-40"
        >
          Compare before / after
        </button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-800 text-[11px] uppercase tracking-wider text-white/40">
            <tr>
              <th className="px-3 py-3">Before</th>
              <th>After</th>
              <th>Label</th>
              <th>Scope</th>
              <th>Gateway p95</th>
              <th>Regional p95</th>
              <th>Game p95</th>
              <th>Loss</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-white/40">
                  Save a snapshot from Live path after a real probe session.
                </td>
              </tr>
            ) : (
              history.map((item) => (
                <tr key={item.id} className="border-t border-white/5">
                  <td className="px-3 py-3">
                    <input
                      type="radio"
                      name="before"
                      checked={before === item.id}
                      onChange={() => setSelected('before', item.id)}
                    />
                  </td>
                  <td>
                    <input
                      type="radio"
                      name="after"
                      checked={after === item.id}
                      onChange={() => setSelected('after', item.id)}
                    />
                  </td>
                  <td>
                    <div>{item.label}</div>
                    <div className="text-[11px] text-white/35">
                      {item.kind} · {formatWhen(item.startedAt)}
                    </div>
                  </td>
                  <td className="capitalize">{item.scope.replaceAll('_', ' ')}</td>
                  <td className="font-mono text-xs">{formatMs(item.gatewayP95)}</td>
                  <td className="font-mono text-xs">{formatMs(item.regionalP95)}</td>
                  <td className="font-mono text-xs">{formatMs(item.valorantP95)}</td>
                  <td className="font-mono text-xs">{formatPct(item.lossPct)}</td>
                  <td className="space-x-2 text-xs">
                    <button onClick={() => void markBaseline(item.id)} className="text-white/50">
                      Baseline
                    </button>
                    <button onClick={() => void exportId(item.id)} className="text-sand-400">
                      CSV
                    </button>
                    <button onClick={() => void deleteId(item.id)} className="text-pulse-bad">
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {comparison ? (
        <section className="rounded-2xl border border-white/5 bg-ink-800/70 p-5">
          <h2 className="text-lg font-semibold">
            {comparison.beforeLabel} → {comparison.afterLabel}
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {comparison.deltas.map((delta) => (
              <div key={delta.key} className="rounded-xl bg-ink-900 p-3">
                <div className="text-[11px] uppercase tracking-wider text-white/35">{delta.label}</div>
                <div className="mt-1 font-mono text-sm">
                  {delta.before ?? '—'} → {delta.after ?? '—'}
                </div>
                <div className="text-xs text-white/45">Δ {delta.delta ?? 'n/a'}</div>
              </div>
            ))}
          </div>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-white/55">
            {comparison.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
