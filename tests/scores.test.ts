import { describe, expect, it } from 'vitest'
import { gradeFromScore, healthScores, localScore, localStabilityImprovementPct } from '../src/shared/scores'
import { metrics } from './helpers'

describe('health scores', () => {
  it('returns inconclusive scores for partial windows', () => {
    expect(localScore(metrics({ sampleCount: 2 }))).toBeNull()
    expect(gradeFromScore(null, false)).toBe('Inconclusive')
    expect(gradeFromScore(90, true)).toBe('Testing')
  })

  it('computes a real local improvement percentage', () => {
    expect(localStabilityImprovementPct(50, 67)).toBe(34)
    expect(localStabilityImprovementPct(null, 80)).toBeNull()
  })

  it('surfaces diagnosis and verified optimization count', () => {
    const result = healthScores({
      gateway: metrics({ p95Ms: 1.2, jitterMs: 0.3, sampleCount: 20 }),
      far: metrics({ p95Ms: 40, jitterMs: 4, sampleCount: 20 }),
      diagnosis: 'STABLE',
      testing: false,
      verifiedOptimizations: 2
    })
    expect(result.verifiedOptimizations).toBe(2)
    expect(result.diagnosis).toBe('STABLE')
    expect(['Excellent', 'Good']).toContain(result.networkHealth)
  })
})
