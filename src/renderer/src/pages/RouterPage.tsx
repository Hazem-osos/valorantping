import { useEffect } from 'react'
import { useAppStore } from '../state/appStore'

export function RouterPage(): JSX.Element {
  const router = useAppStore((state) => state.router)
  const inspectRouter = useAppStore((state) => state.inspectRouter)

  useEffect(() => {
    void inspectRouter()
  }, [inspectRouter])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Router assistant</h1>
        <p className="mt-1 max-w-3xl text-sm text-white/55">
          SQM mainly reduces latency under congestion. It generally does not reduce the physical/path baseline RTT. A
          local app cannot force WE onto a different international route.
        </p>
      </div>
      <section className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
        <div className="text-sm text-white/50">Default gateway</div>
        <div className="mt-1 font-mono text-lg">{router?.gateway ?? 'unknown'}</div>
        <div className="mt-2 text-sm text-white/60">
          {router?.known ? router.fingerprint : 'Manufacturer/model not confirmed. Do not invent menus.'}
        </div>
      </section>
      <section className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
        <h2 className="text-sm font-semibold">SQM / CAKE / FQ-CoDel / QoS</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-white/65">
          {(router?.sqmAdvice ?? []).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <ul className="mt-3 space-y-1 text-xs text-white/40">
          {(router?.notes ?? []).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
