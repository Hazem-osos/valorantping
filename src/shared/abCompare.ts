import type { AbComparison, AbVerdict, WindowMetrics } from './types'

const MIN_SAMPLES = 8
const P95_MEANINGFUL_MS = 8
const SPIKE_DROP_RATIO = 0.3

export function compareAbWindows(before: WindowMetrics, after: WindowMetrics): AbComparison {
  const reasons: string[] = []
  if (before.sampleCount < MIN_SAMPLES || after.sampleCount < MIN_SAMPLES) {
    return {
      verdict: 'INCONCLUSIVE',
      reasons: [
        `Need ${MIN_SAMPLES}+ samples on each side (before ${before.sampleCount}, after ${after.sampleCount}). No keep/rollback decision.`
      ],
      before,
      after,
      keepChange: false,
      rollbackRecommended: true
    }
  }

  const p95Delta = (after.p95Ms ?? 0) - (before.p95Ms ?? 0)
  const jitterDelta = (after.jitterMs ?? 0) - (before.jitterMs ?? 0)
  const lossDelta = after.lossPct - before.lossPct
  const spikeDelta = after.spikeCount - before.spikeCount
  const p99Delta = (after.p99Ms ?? 0) - (before.p99Ms ?? 0)

  if (lossDelta >= 2) reasons.push(`Loss rose ${lossDelta.toFixed(1)} points.`)
  if (p95Delta >= P95_MEANINGFUL_MS) reasons.push(`p95 rose ${p95Delta.toFixed(1)}ms.`)
  if (spikeDelta >= 3) reasons.push(`Spikes rose by ${spikeDelta}.`)

  let verdict: AbVerdict = 'NO_MEANINGFUL_CHANGE'
  if (lossDelta >= 2 || p95Delta >= P95_MEANINGFUL_MS || (spikeDelta >= 3 && p95Delta > 0)) {
    verdict = 'WORSE'
    reasons.push('The change made the measured path worse. Rollback is recommended.')
  } else if (
    (p95Delta <= -P95_MEANINGFUL_MS || p99Delta <= -P95_MEANINGFUL_MS) &&
    lossDelta <= 0.5
  ) {
    verdict = 'IMPROVED'
    reasons.push(`p95 moved ${p95Delta.toFixed(1)}ms with loss not worse. Keep only if you still confirm overlay RTT separately.`)
  } else if (
    before.spikeCount >= 3 &&
    spikeDelta <= -Math.max(2, Math.ceil(before.spikeCount * SPIKE_DROP_RATIO)) &&
    p95Delta <= 3 &&
    lossDelta <= 0.5
  ) {
    verdict = 'IMPROVED'
    reasons.push(`Spike count dropped ${-spikeDelta} with p95 not worse. That is a stability win, not a proven 36ms floor change.`)
  } else if (jitterDelta <= -8 && p95Delta <= 3 && lossDelta <= 0.5) {
    verdict = 'IMPROVED'
    reasons.push(`Jitter dropped ${(-jitterDelta).toFixed(1)}ms. Re-check VALORANT overlay before calling it a game-latency win.`)
  } else {
    reasons.push('Median/p95/jitter/loss/spikes did not move enough to call this an optimization.')
  }

  return {
    verdict,
    reasons,
    before,
    after,
    keepChange: verdict === 'IMPROVED',
    rollbackRecommended: verdict !== 'IMPROVED'
  }
}
