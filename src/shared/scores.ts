import type { ClassifierState, HealthGrade, HealthScores, WindowMetrics } from './types'

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function localScore(gateway: WindowMetrics | null): number | null {
  if (!gateway || gateway.sampleCount < 5) return null
  const p95 = gateway.p95Ms ?? 20
  const jitter = gateway.jitterMs ?? 10
  const loss = gateway.lossPct
  return clamp(100 - p95 * 4 - jitter * 3 - loss * 8 - gateway.spikeCount * 4)
}

export function stabilityScore(far: WindowMetrics | null): number | null {
  if (!far || far.sampleCount < 5) return null
  const p95 = far.p95Ms ?? 80
  const jitter = far.jitterMs ?? 20
  return clamp(100 - Math.max(0, p95 - 30) * 0.7 - jitter * 1.2 - far.lossPct * 6 - far.spikeCount * 3)
}

export function gradeFromScore(score: number | null, testing: boolean): HealthGrade {
  if (testing) return 'Testing'
  if (score === null) return 'Inconclusive'
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Needs Attention'
  return 'Poor'
}

export function healthScores(input: {
  gateway: WindowMetrics | null
  far: WindowMetrics | null
  diagnosis: ClassifierState
  testing: boolean
  verifiedOptimizations: number
}): HealthScores {
  const local = localScore(input.gateway)
  const riyadh = stabilityScore(input.far)
  return {
    networkHealth: gradeFromScore(local, input.testing),
    riyadhStability: gradeFromScore(riyadh, input.testing),
    localNetwork: local,
    riyadhStabilityScore: riyadh,
    diagnosis: input.diagnosis,
    spikes: (input.gateway?.spikeCount ?? 0) + (input.far?.spikeCount ?? 0),
    verifiedOptimizations: input.verifiedOptimizations
  }
}

export function localStabilityImprovementPct(before: number | null, after: number | null): number | null {
  if (before === null || after === null || before <= 0) return null
  return Math.round(((after - before) / before) * 1000) / 10
}
