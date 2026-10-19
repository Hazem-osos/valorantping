import { describe, expect, it } from 'vitest'
import { buildValorantReport } from '../src/shared/valorantReport'
import { metrics, session } from './helpers'

describe('VALORANT report honesty', () => {
  it('can report local stability without claiming the 36ms floor moved', () => {
    const before = session({
      targets: [
        {
          target: { id: 'gateway', label: 'gw', host: '192.168.1.1', kind: 'gateway', protocol: 'icmp' },
          metrics: metrics({ p95Ms: 8, jitterMs: 6, spikeCount: 3, lossPct: 1, sampleCount: 40 }),
          series: []
        },
        {
          target: {
            id: 'aws',
            label: 'aws',
            host: 'dynamodb.me-south-1.amazonaws.com',
            kind: 'regional',
            protocol: 'tcp',
            port: 443
          },
          metrics: metrics({ minMs: 34, p50Ms: 36, p95Ms: 40 }),
          series: []
        }
      ]
    })
    const after = session({
      id: '22222222-2222-2222-2222-222222222222',
      targets: [
        {
          target: { id: 'gateway', label: 'gw', host: '192.168.1.1', kind: 'gateway', protocol: 'icmp' },
          metrics: metrics({ p95Ms: 1.4, jitterMs: 0.4, spikeCount: 0, lossPct: 0, sampleCount: 40 }),
          series: []
        },
        {
          target: {
            id: 'aws',
            label: 'aws',
            host: 'dynamodb.me-south-1.amazonaws.com',
            kind: 'regional',
            protocol: 'tcp',
            port: 443
          },
          metrics: metrics({ minMs: 34, p50Ms: 36, p95Ms: 39 }),
          series: []
        }
      ]
    })
    const report = buildValorantReport(before, after)
    expect(report.localStabilityPct).not.toBeNull()
    expect(report.summary).toMatch(/path floor/)
    expect(report.summary).not.toMatch(/0 ping/)
  })

  it('does not fabricate overlay improvement when overlay is missing', () => {
    const before = session({ valorant: [], valorantMetrics: null })
    const after = session({ id: '22222222-2222-2222-2222-222222222222', valorant: [], valorantMetrics: null })
    const report = buildValorantReport(before, after)
    expect(report.caveats.some((line) => /Overlay RTT is missing/i.test(line))).toBe(true)
  })
})
