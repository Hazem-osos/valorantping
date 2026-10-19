import { useEffect, useState } from 'react'
import { useAppStore } from '../state/appStore'

export function OptimizePage(): JSX.Element {
  const offers = useAppStore((state) => state.offers)
  const scan = useAppStore((state) => state.scan)
  const backups = useAppStore((state) => state.backups)
  const lastApply = useAppStore((state) => state.lastApply)
  const appInfo = useAppStore((state) => state.appInfo)
  const refreshOptimize = useAppStore((state) => state.refreshOptimize)
  const applyOptimize = useAppStore((state) => state.applyOptimize)
  const rollback = useAppStore((state) => state.rollback)
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    void refreshOptimize()
  }, [refreshOptimize])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Optimization Center</h1>
        <p className="mt-1 max-w-3xl text-sm text-white/55">
          Every Windows change is user-approved, backed up, and reversible. DNS, routing, firewall, registry,
          and TCP stack are never written. MTU is offered only after DF evidence, extra confirm, and A/B.
          Nothing here is a guaranteed ping drop.
        </p>
        <div className="mt-2 text-xs text-white/40">
          {appInfo?.packaged ? 'Installed app' : 'Development build'} · {appInfo?.platform} ·{' '}
          {appInfo?.elevated ? 'elevated' : 'standard user'}
        </div>
      </div>

      {lastApply ? (
        <div className="rounded-xl border border-white/10 bg-ink-800 px-4 py-3 text-sm text-white/70">{lastApply.message}</div>
      ) : null}

      <section className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
        <h2 className="text-sm font-semibold">Background congestion (read-only)</h2>
        <p className="mt-1 text-xs text-white/45">Close these yourself if a 15-minute test showed upload-linked spikes.</p>
        <ul className="mt-3 space-y-1 text-sm text-white/70">
          {(scan?.processes ?? []).length === 0 ? <li>No watched uploaders were visible.</li> : null}
          {(scan?.processes ?? []).map((proc) => (
            <li key={`${proc.name}-${proc.pid}`}>
              {proc.name} (pid {proc.pid}) — {proc.reason}
            </li>
          ))}
        </ul>
        <ul className="mt-2 space-y-1 text-xs text-white/45">
          {(scan?.services ?? []).map((svc) => (
            <li key={svc.name}>
              {svc.name}: {svc.status} — {svc.reason}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        {offers.map((offer) => (
          <article key={offer.action.id} className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{offer.action.title}</h2>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/40">
                {offer.action.applyMode === 'never' ? 'guidance' : 'user-approved'}
              </span>
            </div>
            <dl className="mt-3 space-y-2 text-xs leading-5 text-white/60">
              <div>
                <dt className="uppercase tracking-wider text-white/35">Purpose</dt>
                <dd>{offer.action.purpose}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wider text-white/35">Risks</dt>
                <dd>{offer.action.risks}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wider text-white/35">Limits</dt>
                <dd>{offer.action.limitations}</dd>
              </div>
            </dl>
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-white/45">
              {offer.gate.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            {offer.gate.readyForConfirm ? (
              <button
                className="mt-3 w-full rounded-xl bg-sand-500 px-3 py-2 text-sm font-semibold text-ink-950"
                onClick={() => {
                  setPending(offer.action.id)
                }}
              >
                Review and apply with backup
              </button>
            ) : null}
            {pending === offer.action.id ? (
              <div className="mt-3 rounded-xl border border-sand-500/30 bg-sand-500/10 p-3 text-xs text-white/70">
                This will back up the current setting, then apply only this action. It will not claim a ping
                win. Continue?
                <div className="mt-2 flex gap-2">
                  <button
                    className="rounded-lg bg-sand-500 px-3 py-1.5 font-semibold text-ink-950"
                    onClick={() => {
                      void applyOptimize(offer.action.id)
                      setPending(null)
                    }}
                  >
                    Confirm
                  </button>
                  <button className="rounded-lg border border-white/10 px-3 py-1.5" onClick={() => setPending(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
        <h2 className="text-sm font-semibold">Backups and rollback</h2>
        {backups.length === 0 ? (
          <p className="mt-2 text-sm text-white/40">No Windows setting has been changed by this app.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {backups.map((backup) => (
              <li key={backup.id} className="flex items-center justify-between rounded-xl bg-ink-900 px-3 py-2">
                <span>
                  {backup.actionId} · {new Date(backup.createdAt).toLocaleString()}
                  {backup.rolledBackAt ? ' · restored' : ''}
                </span>
                {!backup.rolledBackAt ? (
                  <button className="text-sand-400" onClick={() => void rollback(backup.id)}>
                    Restore
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
