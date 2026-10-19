import { describe, expect, it } from 'vitest'
import { compareSessions } from '../src/shared/compare'
import { csvEscape, sessionToCsv } from '../src/shared/csv'
import type { StoredSession } from '../src/shared/types'

function session(id: string, label: string, regionalP95: number, gameP95: number | null): StoredSession {
  return {
    id,
    kind: 'combined',
    label,
    startedAt: 1,
    endedAt: 2,
    spikeThresholdMs: 100,
    platform: 'win32',
    gateway: '192.168.1.1',
    targets: [
      {
        target: {
          id: 'aws-bahrain-tcp',
          label: 'AWS',
          host: 'dynamodb.me-south-1.amazonaws.com',
          kind: 'regional',
          protocol: 'tcp',
          port: 443
        },
        metrics: {
          sampleCount: 20,
          timeoutCount: 0,
          lossPct: 0,
          minMs: 30,
          maxMs: regionalP95,
          avgMs: 34,
          p50Ms: 33,
          p95Ms: regionalP95,
          p99Ms: regionalP95,
          stdevMs: 2,
          jitterMs: 4,
          spikeCount: 1,
          lastMs: 34
        },
        series: [
          { t: 1_700_000_000_000, avgMs: 34, minMs: 30, maxMs: 40, lossPct: 0, inBps: 1000, outBps: 200 }
        ]
      }
    ],
    valorant: gameP95 === null ? [] : [{ t: 1_700_000_000_000, rttMs: gameP95, note: 'said "hello, world"' }],
    valorantMetrics:
      gameP95 === null
        ? null
        : {
            sampleCount: 1,
            timeoutCount: 0,
            lossPct: 0,
            minMs: gameP95,
            maxMs: gameP95,
            avgMs: gameP95,
            p50Ms: gameP95,
            p95Ms: gameP95,
            p99Ms: gameP95,
            stdevMs: null,
            jitterMs: null,
            spikeCount: 0,
            lastMs: gameP95
          },
    adapterPeakIn: 1,
    adapterPeakOut: 1,
    coincidence: {
      sampleCount: 10,
      spikeCount: 0,
      spikesWithHighUpload: 0,
      spikeWithHighUploadPct: null,
      pearsonRttUpload: null
    },
    diagnosis: {
      scope: 'healthy',
      confidence: 0.4,
      summary: 'ok',
      findings: [],
      cannotConclude: []
    }
  }
}

describe('csv and compare', () => {
  it('escapes commas and quotes', () => {
    expect(csvEscape('hello, world')).toBe('"hello, world"')
    expect(csvEscape('he said "hi"')).toBe('"he said ""hi"""')
  })

  it('exports probe and overlay rows', () => {
    const csv = sessionToCsv(session('11111111-1111-1111-1111-111111111111', 'before, night', 48, 36))
    expect(csv.split('\n').length).toBe(3)
    expect(csv).toContain('valorant-overlay')
    expect(csv).toContain('"before, night"')
    expect(csv).toContain('""hello, world""')
  })

  it('compares snapshots without claiming game wins from ICMP only', () => {
    const comparison = compareSessions(
      session('11111111-1111-1111-1111-111111111111', 'before', 80, null),
      session('22222222-2222-2222-2222-222222222222', 'after', 40, 36)
    )
    expect(comparison.deltas.find((item) => item.key === 'regionalP95')?.delta).toBe(-40)
    expect(comparison.notes.some((note) => /VALORANT/i.test(note))).toBe(true)
  })
})
