import { useAppStore } from '../state/appStore'
import { formatMs, formatPct } from '../lib/format'

export function BufferbloatPage(): JSX.Element {
  const result = useAppStore((state) => state.bufferbloat)
  const timed = useAppStore((state) => state.timed)
  const startBufferbloat = useAppStore((state) => state.startBufferbloat)
  const cancelBufferbloat = useAppStore((state) => state.cancelBufferbloat)
  const running = timed?.kind === 'bufferbloat' && timed.running

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bufferbloat</h1>
          <p className="mt-1 max-w-3xl text-sm text-white/55">
            Idle latency, then a bounded download, then a bounded upload. Traffic is capped. Windows cannot implement
            CAKE/FQ-CoDel; that lives on the router.
          </p>
        </div>
        {running ? (
          <button onClick={() => void cancelBufferbloat()} className="rounded-xl bg-pulse-bad px-4 py-2 text-sm font-semibold">
            Cancel
          </button>
        ) : (
          <button onClick={() => void startBufferbloat()} className="rounded-xl bg-sand-500 px-4 py-2 text-sm font-semibold text-ink-950">
            Run bufferbloat test
          </button>
        )}
      </div>
      {running ? <div className="text-sm text-sand-400">Phase: {timed?.phase}</div> : null}
      {result ? (
        <section className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
          <div className="text-lg font-semibold">{result.grade}</div>
          <dl className="mt-3 grid gap-2 text-sm text-white/65 md:grid-cols-2">
            <div>Idle median {formatMs(result.idleP50)}</div>
            <div>Loaded down median {formatMs(result.loadedDownP50)}</div>
            <div>Loaded up median {formatMs(result.loadedUpP50)}</div>
            <div>Loaded p95 {formatMs(result.loadedP95)}</div>
            <div>Δ down {formatMs(result.deltaDownMs)}</div>
            <div>Δ up {formatMs(result.deltaUpMs)}</div>
            <div>Jitter {formatMs(result.jitterMs)}</div>
            <div>Loss {formatPct(result.lossPct)}</div>
          </dl>
          <p className="mt-3 text-sm leading-6 text-white/60">{result.note}</p>
        </section>
      ) : null}
    </div>
  )
}
