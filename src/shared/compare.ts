import type { Comparison, StoredSession } from './types'

function delta(before: number | null, after: number | null): number | null {
  if (before === null || after === null) return null
  return Math.round((after - before) * 10) / 10
}

function pickRegional(session: StoredSession) {
  return (
    session.targets.find((target) => target.target.kind === 'regional') ??
    session.targets.find((target) => target.target.kind === 'public') ??
    session.targets[0]
  )
}

function pickGateway(session: StoredSession) {
  return session.targets.find((target) => target.target.kind === 'gateway')
}

export function compareSessions(before: StoredSession, after: StoredSession): Comparison {
  const beforeFar = pickRegional(before)
  const afterFar = pickRegional(after)
  const beforeGw = pickGateway(before)
  const afterGw = pickGateway(after)
  const notes: string[] = [
    'A lower public ICMP/TCP number is not a proven VALORANT improvement unless in-game overlay samples also moved.',
    'Phase 1 never applies system changes, so any improvement came from something you changed outside this app, or from path variance.'
  ]
  if (!before.valorantMetrics || !after.valorantMetrics) {
    notes.push('In-game VALORANT p95 is missing on one or both snapshots, so game impact cannot be claimed.')
  }
  return {
    beforeId: before.id,
    afterId: after.id,
    beforeLabel: before.label,
    afterLabel: after.label,
    deltas: [
      {
        key: 'gatewayP95',
        label: 'Gateway p95 (ms)',
        before: beforeGw?.metrics.p95Ms ?? null,
        after: afterGw?.metrics.p95Ms ?? null,
        delta: delta(beforeGw?.metrics.p95Ms ?? null, afterGw?.metrics.p95Ms ?? null)
      },
      {
        key: 'regionalP95',
        label: 'Regional/public p95 (ms)',
        before: beforeFar?.metrics.p95Ms ?? null,
        after: afterFar?.metrics.p95Ms ?? null,
        delta: delta(beforeFar?.metrics.p95Ms ?? null, afterFar?.metrics.p95Ms ?? null)
      },
      {
        key: 'jitter',
        label: 'Regional jitter (ms)',
        before: beforeFar?.metrics.jitterMs ?? null,
        after: afterFar?.metrics.jitterMs ?? null,
        delta: delta(beforeFar?.metrics.jitterMs ?? null, afterFar?.metrics.jitterMs ?? null)
      },
      {
        key: 'loss',
        label: 'Regional loss (%)',
        before: beforeFar?.metrics.lossPct ?? null,
        after: afterFar?.metrics.lossPct ?? null,
        delta: delta(beforeFar?.metrics.lossPct ?? null, afterFar?.metrics.lossPct ?? null)
      },
      {
        key: 'spikes',
        label: 'Regional spikes',
        before: beforeFar?.metrics.spikeCount ?? null,
        after: afterFar?.metrics.spikeCount ?? null,
        delta: delta(beforeFar?.metrics.spikeCount ?? null, afterFar?.metrics.spikeCount ?? null)
      },
      {
        key: 'valorantP95',
        label: 'VALORANT overlay p95 (ms)',
        before: before.valorantMetrics?.p95Ms ?? null,
        after: after.valorantMetrics?.p95Ms ?? null,
        delta: delta(before.valorantMetrics?.p95Ms ?? null, after.valorantMetrics?.p95Ms ?? null)
      }
    ],
    notes
  }
}
