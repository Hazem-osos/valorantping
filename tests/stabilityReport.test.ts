import { describe, expect, it } from 'vitest'
import { buildStabilityReport, inconclusiveCopy } from '../src/shared/report'
import type { StoredSession } from '../src/shared/types'

function session(id: string, durationMs: number, overlay: boolean): StoredSession {
  return {
    id,
    kind: 'stability',
    label: '15-minute stability test',
    startedAt: 1_000,
    endedAt: 1_000 + durationMs,
    spikeThresholdMs: 100,
    platform: 'win32',
    gateway: '192.168.1.1',
    targets: [
      {
        target: {
          id: 'gateway',
          label: 'Default gateway',
          host: '192.168.1.1',
          kind: 'gateway',
          protocol: 'icmp'
        },
        metrics: {
          sampleCount: 40,
          timeoutCount: 0,
          lossPct: 0,
          minMs: 1,
          maxMs: 2,
          avgMs: 1.2,
          p50Ms: 1.1,
          p95Ms: 1.8,
          p99Ms: 1.9,
          stdevMs: 0.2,
          jitterMs: 0.2,
          spikeCount: 0,
          lastMs: 1.1
        },
        series: []
      }
    ],
    valorant: overlay ? [{ t: 1_200, rttMs: 36, lossPct: 0.4 }] : [],
    valorantMetrics: overlay
      ? {
          sampleCount: 1,
          timeoutCount: 0,
          lossPct: 0,
          minMs: 36,
          maxMs: 36,
          avgMs: 36,
          p50Ms: 36,
          p95Ms: 36,
          p99Ms: 36,
          stdevMs: null,
          jitterMs: null,
          spikeCount: 0,
          lastMs: 36
        }
      : null,
    adapterPeakIn: 1,
    adapterPeakOut: 1,
    coincidence: {
      sampleCount: 4,
      spikeCount: 0,
      spikesWithHighUpload: 0,
      spikeWithHighUploadPct: null,
      pearsonRttUpload: null
    },
    diagnosis: {
      scope: 'healthy',
      confidence: 0.5,
      summary: 'quiet',
      findings: [],
      cannotConclude: ['True VALORANT Riyadh RTT until you record the in-game overlay here']
    }
  }
}

describe('stability report', () => {
  it('marks cancelled short runs incomplete and lists inconclusive reasons', () => {
    const report = buildStabilityReport(session('11111111-1111-1111-1111-111111111111', 20_000, false), null, {
      cancelled: true
    })
    expect(report.completed).toBe(false)
    expect(report.cancelled).toBe(true)
    const notes = inconclusiveCopy(report)
    expect(notes.some((line) => /15-minute window did not finish/i.test(line))).toBe(true)
    expect(notes.some((line) => /VALORANT/i.test(line))).toBe(true)
  })

  it('compares a finished test to a baseline without treating ICMP as game RTT', () => {
    const before = session('11111111-1111-1111-1111-111111111111', 15 * 60_000, true)
    const after = session('22222222-2222-2222-2222-222222222222', 15 * 60_000, true)
    const report = buildStabilityReport(after, before, { cancelled: false })
    expect(report.completed).toBe(true)
    expect(report.comparisonToBaseline?.notes.some((note) => /VALORANT/i.test(note))).toBe(true)
    expect(report.valorantLossAvg).toBe(0.4)
  })
})
