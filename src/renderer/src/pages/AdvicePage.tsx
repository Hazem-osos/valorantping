import { liveAdvice, liveDiagnosis, useAppStore } from '../state/appStore'

export function AdvicePage(): JSX.Element {
  const state = useAppStore()
  const diagnosis = liveDiagnosis(state)
  const advice = liveAdvice(state)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Safe optimization advice</h1>
        <p className="mt-1 max-w-3xl text-sm text-white/55">
          Guidance stays display-only here. User-approved Windows changes live in Optimization Center, always
          with a backup. This app still will not install a VPN or touch Vanguard. A stable 36ms Riyadh
          baseline is often the path floor.
        </p>
      </div>
      <section className="rounded-2xl border border-white/5 bg-ink-800/70 p-5">
        <div className="text-xs uppercase tracking-[0.16em] text-sand-400">{diagnosis.scope.replaceAll('_', ' ')}</div>
        <p className="mt-2 text-sm leading-6 text-white/75">{diagnosis.summary}</p>
        {diagnosis.cannotConclude.length > 0 ? (
          <div className="mt-3 text-xs text-white/40">
            Still open: {diagnosis.cannotConclude.join(' · ')}
          </div>
        ) : null}
      </section>
      <div className="grid gap-3 md:grid-cols-2">
        {advice.map((item) => (
          <article key={item.id} className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{item.title}</h2>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/40">
                manual
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-white/60">{item.body}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
