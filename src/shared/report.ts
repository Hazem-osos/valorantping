import { compareSessions } from './compare'
import type { StabilityReport, StoredSession } from './types'

export function averageValorantLoss(session: StoredSession): number | null {
  const values = session.valorant
    .map((sample) => sample.lossPct)
    .filter((value): value is number => value !== undefined)
  if (values.length === 0) return null
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}

export function buildStabilityReport(
  session: StoredSession,
  baseline: StoredSession | null,
  options: { cancelled: boolean }
): StabilityReport {
  const durationMs = Math.max(0, session.endedAt - session.startedAt)
  const completed = !options.cancelled && durationMs >= 60_000
  return {
    sessionId: session.id,
    generatedAt: Date.now(),
    durationMs,
    completed,
    cancelled: options.cancelled,
    targetMetrics: session.targets.map((target) => ({
      id: target.target.id,
      label: target.target.label,
      kind: target.target.kind,
      metrics: target.metrics
    })),
    coincidence: session.coincidence,
    diagnosis: session.diagnosis,
    valorantMetrics: session.valorantMetrics,
    valorantLossAvg: averageValorantLoss(session),
    comparisonToBaseline: baseline ? compareSessions(baseline, session) : null,
    baselineId: baseline?.id ?? null
  }
}

export function inconclusiveCopy(report: StabilityReport): string[] {
  const lines = [...report.diagnosis.cannotConclude]
  if (!report.completed) {
    lines.push('The 15-minute window did not finish, so spike rates are not comparable to a full baseline.')
  }
  if (!report.valorantMetrics || report.valorantMetrics.sampleCount < 3) {
    lines.push('In-game VALORANT RTT/loss were not logged enough times to judge the overlay.')
  }
  if (report.coincidence.sampleCount < 10) {
    lines.push('Throughput correlation is weak because too few aligned upload/RTT buckets were captured.')
  }
  if (report.diagnosis.scope === 'insufficient_data') {
    lines.push('Keep the Ethernet link up and rerun the full 15-minute test.')
  }
  return lines
}
