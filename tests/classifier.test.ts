import { describe, expect, it } from 'vitest'
import { classifyBottleneck } from '../src/shared/classifier'
import { coincidence, metrics } from './helpers'

describe('bottleneck classifier', () => {
  it('is inconclusive with too few samples', () => {
    const result = classifyBottleneck({
      gateway: metrics({ sampleCount: 3 }),
      isp: null,
      publicNet: null,
      regional: null,
      coincidence: coincidence({ sampleCount: 3 }),
      valorant: null,
      linkSpeedBps: 1_000_000_000,
      nicMayPowerOff: false,
      sampleCount: 3
    })
    expect(result.primary).toBe('INCONCLUSIVE')
    expect(result.reasons[0]).toMatch(/samples/)
  })

  it('suspects local LAN when gateway spikes with the far path', () => {
    const result = classifyBottleneck({
      gateway: metrics({ p95Ms: 40, jitterMs: 18, spikeCount: 6, lossPct: 8, sampleCount: 40 }),
      isp: metrics({ p95Ms: 80, spikeCount: 4 }),
      publicNet: metrics({ p95Ms: 90, spikeCount: 4 }),
      regional: metrics({ p95Ms: 90, spikeCount: 4 }),
      coincidence: coincidence(),
      valorant: null,
      linkSpeedBps: 1_000_000_000,
      nicMayPowerOff: false,
      sampleCount: 40
    })
    expect(result.primary).toBe('LOCAL_LAN')
    expect(result.buckets.jitterSpikes).toBe('local')
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it('suspects upstream when the gateway is quiet and every far target spikes', () => {
    const result = classifyBottleneck({
      gateway: metrics({ p95Ms: 1.1, jitterMs: 0.2, sampleCount: 40 }),
      isp: metrics({ p95Ms: 160, spikeCount: 8, jitterMs: 20 }),
      publicNet: metrics({ p95Ms: 170, spikeCount: 8, jitterMs: 22 }),
      regional: metrics({ p95Ms: 180, minMs: 34, spikeCount: 8, jitterMs: 25 }),
      coincidence: coincidence({ spikeCount: 8, spikesWithHighUpload: 1, spikeWithHighUploadPct: 12 }),
      valorant: null,
      linkSpeedBps: 1_000_000_000,
      nicMayPowerOff: false,
      sampleCount: 40
    })
    expect(['UPSTREAM_ROUTE', 'ISP_EDGE']).toContain(result.primary)
    expect(result.buckets.unfixableLocally).toBe(true)
    expect(result.reasons.some((reason) => /beyond the LAN|shorter international/i.test(reason))).toBe(true)
  })

  it('suspects bufferbloat when spikes line up with upload', () => {
    const result = classifyBottleneck({
      gateway: metrics({ p95Ms: 22, jitterMs: 12, spikeCount: 4, sampleCount: 40 }),
      isp: metrics({ p95Ms: 120, spikeCount: 5 }),
      publicNet: metrics({ p95Ms: 120, spikeCount: 5 }),
      regional: metrics({ p95Ms: 130, spikeCount: 5 }),
      coincidence: coincidence({ spikeCount: 6, spikesWithHighUpload: 5, spikeWithHighUploadPct: 83 }),
      valorant: null,
      linkSpeedBps: 1_000_000_000,
      nicMayPowerOff: false,
      sampleCount: 40
    })
    expect(result.primary).toBe('BUFFERBLOAT_SUSPECTED')
    expect(result.buckets.congestion).toBe('likely')
  })

  it('flags game-specific when probes are quiet but overlay spikes', () => {
    const result = classifyBottleneck({
      gateway: metrics({ p95Ms: 1.2, jitterMs: 0.3, sampleCount: 40 }),
      isp: metrics({ p95Ms: 18, jitterMs: 2 }),
      publicNet: metrics({ p95Ms: 20, jitterMs: 2 }),
      regional: metrics({ p95Ms: 36, minMs: 34, jitterMs: 2 }),
      coincidence: coincidence(),
      valorant: metrics({ sampleCount: 8, p95Ms: 220, spikeCount: 5, minMs: 36 }),
      linkSpeedBps: 1_000_000_000,
      nicMayPowerOff: false,
      sampleCount: 40
    })
    expect(result.primary).toBe('GAME_SPECIFIC')
  })
})
