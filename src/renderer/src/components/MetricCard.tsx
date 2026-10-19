import { classNames } from '../lib/format'

export function MetricCard(props: {
  label: string
  value: string
  hint: string
  tone?: 'good' | 'warn' | 'bad' | 'neutral'
}): JSX.Element {
  const tone =
    props.tone === 'good'
      ? 'text-pulse-good'
      : props.tone === 'warn'
        ? 'text-pulse-warn'
        : props.tone === 'bad'
          ? 'text-pulse-bad'
          : 'text-white'
  return (
    <div className="rounded-2xl border border-white/5 bg-ink-800/80 p-4 shadow-panel">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">{props.label}</div>
      <div className={classNames('mt-2 font-mono text-2xl tabular', tone)}>{props.value}</div>
      <div className="mt-1 text-xs text-white/40">{props.hint}</div>
    </div>
  )
}
