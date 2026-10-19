import { useState } from 'react'
import type { AbRunResult, OptimizeAction, SmartPlanResult } from '../../../shared/types'
import { useAppStore } from '../state/appStore'

export function SmartPage(): JSX.Element {
  const startBaseline = useAppStore((state) => state.startBaseline)
  const loadSmartPlan = useAppStore((state) => state.loadSmartPlan)
  const runAb = useAppStore((state) => state.runAb)
  const plan = useAppStore((state) => state.smartPlan)
  const timed = useAppStore((state) => state.timed)
  const appInfo = useAppStore((state) => state.appInfo)
  const lastAb = useAppStore((state) => state.lastAb)
  const [pending, setPending] = useState<string | null>(null)
  const [mtuOk, setMtuOk] = useState(false)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Smart Optimize</h1>
        <p className="mt-1 max-w-3xl text-sm text-white/55">
          Analyze → classify → propose → you confirm → benchmark → one change → benchmark → keep or rollback →
          report. No silent system changes.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => void startBaseline()} className="rounded-xl border border-white/10 px-4 py-2 text-sm">
          1. Baseline
        </button>
        <button onClick={() => void loadSmartPlan()} className="rounded-xl bg-sand-500 px-4 py-2 text-sm font-semibold text-ink-950">
          2. Analyze
        </button>
      </div>
      {timed?.running ? (
        <div className="text-sm text-sand-400">
          {timed.kind} · {timed.phase} · {Math.ceil(timed.remainingMs / 1000)}s left
        </div>
      ) : null}
      <PlanBlock plan={plan} hasBaseline={Boolean(appInfo?.baselineSessionId)} />
      <div className="grid gap-3 lg:grid-cols-2">
        {(plan?.actions ?? []).map((action) => (
          <ActionCard
            key={action.id}
            action={action}
            pending={pending === action.id}
            mtuOk={mtuOk}
            onMtu={setMtuOk}
            onReview={() => setPending(action.id)}
            onCancel={() => setPending(null)}
            onRun={() => {
              void runAb(action.id, action.id === 'mtu-fix' ? mtuOk : undefined)
              setPending(null)
            }}
          />
        ))}
      </div>
      {lastAb ? <AbBlock result={lastAb} /> : null}
    </div>
  )
}

function PlanBlock({ plan, hasBaseline }: { plan: SmartPlanResult | null; hasBaseline: boolean }): JSX.Element {
  if (!plan) {
    return (
      <div className="rounded-2xl border border-white/5 bg-ink-800/70 p-4 text-sm text-white/55">
        {hasBaseline ? 'Run Analyze to classify the baseline.' : 'Capture a 3–5 minute Baseline Session first.'}
      </div>
    )
  }
  return (
    <section className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-sand-400">
        {plan.classifier.primary.replaceAll('_', ' ')} · {(plan.classifier.confidence * 100).toFixed(0)}%
      </div>
      <ul className="mt-3 space-y-1 text-sm text-white/65">
        {plan.classifier.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <ul className="mt-3 space-y-1 text-xs text-white/40">
        {plan.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </section>
  )
}

function ActionCard(props: {
  action: OptimizeAction
  pending: boolean
  mtuOk: boolean
  onMtu: (value: boolean) => void
  onReview: () => void
  onCancel: () => void
  onRun: () => void
}): JSX.Element {
  return (
    <article className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
      <h2 className="text-sm font-semibold">{props.action.title}</h2>
      <p className="mt-2 text-xs leading-5 text-white/55">{props.action.purpose}</p>
      <p className="mt-2 text-xs text-white/40">{props.action.limitations}</p>
      {props.action.applyMode === 'never' ? (
        <div className="mt-3 text-xs text-white/45">Guidance only — nothing is written.</div>
      ) : (
        <button onClick={props.onReview} className="mt-3 rounded-xl bg-sand-500 px-3 py-2 text-sm font-semibold text-ink-950">
          Review this one change
        </button>
      )}
      {props.pending ? (
        <div className="mt-3 rounded-xl border border-sand-500/30 bg-sand-500/10 p-3 text-xs text-white/70">
          One change, then A/B. If it is worse or not meaningful, the original setting is restored.
          {props.action.id === 'mtu-fix' ? (
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={props.mtuOk} onChange={(event) => props.onMtu(event.target.checked)} />
              I confirm the MTU change from DF evidence.
            </label>
          ) : null}
          <div className="mt-2 flex gap-2">
            <button className="rounded-lg bg-sand-500 px-3 py-1.5 font-semibold text-ink-950" onClick={props.onRun}>
              Confirm and A/B
            </button>
            <button className="rounded-lg border border-white/10 px-3 py-1.5" onClick={props.onCancel}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}

function AbBlock({ result }: { result: AbRunResult }): JSX.Element {
  return (
    <section className="rounded-2xl border border-white/5 bg-ink-800/70 p-4 text-sm text-white/70">
      <div className="font-semibold">{result.comparison.verdict.replaceAll('_', ' ')}</div>
      <p className="mt-2">{result.message}</p>
      {result.rolledBack ? <p className="mt-2 text-pulse-warn">Rolled back automatically.</p> : null}
    </section>
  )
}
