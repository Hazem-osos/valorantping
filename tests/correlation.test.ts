import { describe, expect, it } from 'vitest'
import { correlateLatencyAndUpload, pearson } from '../src/shared/correlation'

describe('correlation', () => {
  it('returns 1 for identical series', () => {
    expect(pearson([1, 2, 3, 4], [1, 2, 3, 4])).toBeCloseTo(1)
  })

  it('returns null without enough points', () => {
    expect(pearson([1, 2], [1, 2])).toBeNull()
  })

  it('scores spikes that land on high upload seconds', () => {
    const stats = correlateLatencyAndUpload({
      spikeThresholdMs: 80,
      rtts: [
        { t: 1000, rttMs: 30 },
        { t: 2000, rttMs: 200 },
        { t: 3000, rttMs: 40 },
        { t: 4000, rttMs: 180 }
      ],
      uploads: [
        { t: 1000, bytesOutPerSec: 10_000 },
        { t: 2000, bytesOutPerSec: 900_000 },
        { t: 3000, bytesOutPerSec: 12_000 },
        { t: 4000, bytesOutPerSec: 900_000 }
      ]
    })
    expect(stats.spikeCount).toBe(2)
    expect(stats.spikeWithHighUploadPct).toBe(100)
    expect(stats.pearsonRttUpload).not.toBeNull()
  })
})
