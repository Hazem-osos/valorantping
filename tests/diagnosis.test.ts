import { describe, expect, it } from 'vitest'
import { diagnose } from '../src/shared/diagnosis'
import type { WindowMetrics } from '../src/shared/types'

function metrics(partial: Partial<WindowMetrics>): WindowMetrics {
  return {
    sampleCount: 30,
    timeoutCount: 0,
    lossPct: 0,
    minMs: 1,
    maxMs: 2,
    avgMs: 1.5,
    p50Ms: 1.4,
    p95Ms: 2,
    p99Ms: 2,
    stdevMs: 0.2,
    jitterMs: 0.4,
    spikeCount: 0,
    lastMs: 1.5,
    ...partial
  }
}

describe('diagnosis', () => {
  it('asks for more samples when the window is tiny', () => {
    const result = diagnose({
      windows: {
        gateway: { kind: 'gateway', label: 'gw', metrics: metrics({ sampleCount: 3 }) }
      },
      coincidence: {
        sampleCount: 3,
        spikeCount: 0,
        spikesWithHighUpload: 0,
        spikeWithHighUploadPct: null,
        pearsonRttUpload: null
      },
      spikeThresholdMs: 100
    })
    expect(result.scope).toBe('insufficient_data')
    expect(result.findings.some((finding) => finding.id === 'icmp_not_game')).toBe(true)
  })

  it('flags local gateway instability', () => {
    const result = diagnose({
      windows: {
        gateway: {
          kind: 'gateway',
          label: 'gw',
          metrics: metrics({ p95Ms: 40, jitterMs: 18, spikeCount: 6, lossPct: 8 })
        },
        public: { kind: 'public', label: 'cf', metrics: metrics({ p95Ms: 80, spikeCount: 4 }) }
      },
      coincidence: {
        sampleCount: 20,
        spikeCount: 1,
        spikesWithHighUpload: 0,
        spikeWithHighUploadPct: 0,
        pearsonRttUpload: 0.1
      },
      spikeThresholdMs: 100
    })
    expect(result.scope).toBe('local')
    expect(result.findings.some((finding) => finding.id === 'local_gateway_instability')).toBe(true)
  })

  it('flags upstream when LAN is quiet and the far path spikes', () => {
    const result = diagnose({
      windows: {
        gateway: { kind: 'gateway', label: 'gw', metrics: metrics({ p95Ms: 1.2, jitterMs: 0.3 }) },
        regional: {
          kind: 'regional',
          label: 'aws',
          metrics: metrics({ p95Ms: 180, minMs: 34, spikeCount: 8, lossPct: 4 })
        }
      },
      coincidence: {
        sampleCount: 40,
        spikeCount: 8,
        spikesWithHighUpload: 1,
        spikeWithHighUploadPct: 12,
        pearsonRttUpload: 0.05
      },
      spikeThresholdMs: 100
    })
    expect(result.scope).toBe('upstream')
    expect(result.findings.some((finding) => finding.id === 'path_floor')).toBe(true)
  })

  it('links bufferbloat when spikes coincide with upload', () => {
    const result = diagnose({
      windows: {
        gateway: { kind: 'gateway', label: 'gw', metrics: metrics({ p95Ms: 22, jitterMs: 12, spikeCount: 4 }) },
        public: { kind: 'public', label: 'cf', metrics: metrics({ p95Ms: 120, spikeCount: 5 }) }
      },
      coincidence: {
        sampleCount: 30,
        spikeCount: 6,
        spikesWithHighUpload: 5,
        spikeWithHighUploadPct: 83,
        pearsonRttUpload: 0.72
      },
      spikeThresholdMs: 100
    })
    expect(result.findings.some((finding) => finding.id === 'local_congestion_bufferbloat')).toBe(true)
    expect(['local', 'mixed']).toContain(result.scope)
  })
})
