export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'n/a'
  if (value < 10) return `${value.toFixed(1)} ms`
  return `${Math.round(value)} ms`
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'n/a'
  return `${value.toFixed(1)}%`
}

export function formatRate(bytesPerSec: number | null | undefined): string {
  if (bytesPerSec === null || bytesPerSec === undefined) return '—'
  const bits = bytesPerSec * 8
  if (bits >= 1_000_000) return `${(bits / 1_000_000).toFixed(1)} Mbps`
  if (bits >= 1_000) return `${(bits / 1_000).toFixed(0)} kbps`
  return `${Math.round(bits)} bps`
}

export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function formatWhen(ts: number): string {
  return new Date(ts).toLocaleString()
}

export function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function scopeTone(scope: string): string {
  if (scope === 'healthy') return 'text-pulse-good'
  if (scope === 'local') return 'text-pulse-warn'
  if (scope === 'insufficient_data') return 'text-pulse-info'
  return 'text-pulse-bad'
}
