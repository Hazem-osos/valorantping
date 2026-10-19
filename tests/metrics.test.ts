import { describe, expect, it } from 'vitest'
import {
  countSpikes,
  downsample,
  firstSustainedJumpHop,
  meanSuccessiveJitter,
  percentile,
  summarizeRtts,
  summarizeSamples
} from '../src/shared/metrics'

describe('metrics', () => {
  it('computes interpolated percentiles', () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5)
    expect(percentile([10], 95)).toBe(10)
    expect(percentile([], 50)).toBeNull()
  })

  it('computes mean successive jitter', () => {
    expect(meanSuccessiveJitter([10, 12, 11])).toBeCloseTo(1.5)
    expect(meanSuccessiveJitter([5])).toBeNull()
  })

  it('counts spikes against the larger of threshold and 2x median', () => {
    expect(countSpikes([30, 32, 31, 33, 200], 100)).toBe(1)
    expect(countSpikes([1, 1, 1, 3], 100)).toBe(0)
  })

  it('includes timeouts in loss and ignores them in RTT stats', () => {
    const metrics = summarizeRtts([12, null, 14, 13], 1, 100)
    expect(metrics.sampleCount).toBe(4)
    expect(metrics.timeoutCount).toBe(1)
    expect(metrics.lossPct).toBe(25)
    expect(metrics.minMs).toBe(12)
    expect(metrics.p95Ms).not.toBeNull()
    expect(metrics.p99Ms).not.toBeNull()
    expect(metrics.stdevMs).not.toBeNull()
  })

  it('treats timed-out probe samples as loss', () => {
    const metrics = summarizeSamples(
      [
        { rttMs: 36, timedOut: false },
        { rttMs: null, timedOut: true }
      ],
      100
    )
    expect(metrics.lossPct).toBe(50)
    expect(metrics.lastMs).toBe(36)
  })

  it('downsamples into buckets', () => {
    const series = downsample(
      [
        { t: 1000, rttMs: 10 },
        { t: 1200, rttMs: 20 },
        { t: 4000, rttMs: null, timedOut: true }
      ],
      1000
    )
    expect(series[0]?.avgMs).toBe(15)
    expect(series[1]?.lossPct).toBe(100)
  })

  it('finds the first sustained traceroute jump', () => {
    const hop = firstSustainedJumpHop([
      { hop: 1, rttsMs: [1] },
      { hop: 2, rttsMs: [8] },
      { hop: 3, rttsMs: [40] }
    ])
    expect(hop).toBe(3)
  })
})
