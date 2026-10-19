import { describe, expect, it } from 'vitest'
import { compareAbWindows } from '../src/shared/abCompare'
import { metrics } from './helpers'

describe('A/B comparison', () => {
  it('keeps a meaningful p95 drop', () => {
    const result = compareAbWindows(
      metrics({ sampleCount: 20, p95Ms: 40, p99Ms: 55, spikeCount: 4, jitterMs: 12, lossPct: 0 }),
      metrics({ sampleCount: 20, p95Ms: 28, p99Ms: 32, spikeCount: 1, jitterMs: 6, lossPct: 0 })
    )
    expect(result.verdict).toBe('IMPROVED')
    expect(result.keepChange).toBe(true)
    expect(result.rollbackRecommended).toBe(false)
  })

  it('rolls back when p95 and loss get worse', () => {
    const result = compareAbWindows(
      metrics({ sampleCount: 20, p95Ms: 30, p99Ms: 34, spikeCount: 1, lossPct: 0 }),
      metrics({ sampleCount: 20, p95Ms: 48, p99Ms: 70, spikeCount: 6, lossPct: 4 })
    )
    expect(result.verdict).toBe('WORSE')
    expect(result.rollbackRecommended).toBe(true)
  })

  it('restores original when the delta is not meaningful', () => {
    const result = compareAbWindows(
      metrics({ sampleCount: 20, p95Ms: 36, p99Ms: 40, spikeCount: 1, jitterMs: 4, lossPct: 0 }),
      metrics({ sampleCount: 20, p95Ms: 35, p99Ms: 39, spikeCount: 1, jitterMs: 3.8, lossPct: 0 })
    )
    expect(result.verdict).toBe('NO_MEANINGFUL_CHANGE')
    expect(result.keepChange).toBe(false)
    expect(result.rollbackRecommended).toBe(true)
  })

  it('is inconclusive with partial windows', () => {
    const result = compareAbWindows(metrics({ sampleCount: 2 }), metrics({ sampleCount: 20 }))
    expect(result.verdict).toBe('INCONCLUSIVE')
    expect(result.rollbackRecommended).toBe(true)
  })
})
