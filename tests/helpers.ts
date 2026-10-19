import type { CoincidenceStats, Diagnosis, StoredSession, WindowMetrics } from '../src/shared/types'

export function metrics(partial: Partial<WindowMetrics> = {}): WindowMetrics {
  return {
    sampleCount: 40,
    timeoutCount: 0,
    lossPct: 0,
    minMs: 1,
    maxMs: 2,
    avgMs: 1.4,
    p50Ms: 1.3,
    p95Ms: 2,
    p99Ms: 2,
    stdevMs: 0.2,
    jitterMs: 0.4,
    spikeCount: 0,
    lastMs: 1.4,
    ...partial
  }
}

export function coincidence(partial: Partial<CoincidenceStats> = {}): CoincidenceStats {
  return {
    sampleCount: 40,
    spikeCount: 0,
    spikesWithHighUpload: 0,
    spikeWithHighUploadPct: 0,
    pearsonRttUpload: 0,
    ...partial
  }
}

export function session(partial: Partial<StoredSession> = {}): StoredSession {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    kind: 'baseline',
    label: 'Baseline Session',
    startedAt: 1,
    endedAt: 2,
    spikeThresholdMs: 100,
    platform: 'win32',
    gateway: '192.168.1.1',
    targets: [
      {
        target: { id: 'gateway', label: 'gw', host: '192.168.1.1', kind: 'gateway', protocol: 'icmp' },
        metrics: metrics({ p95Ms: 1.2, jitterMs: 0.3 }),
        series: []
      },
      {
        target: {
          id: 'aws-bahrain-tcp',
          label: 'aws',
          host: 'dynamodb.me-south-1.amazonaws.com',
          kind: 'regional',
          protocol: 'tcp',
          port: 443
        },
        metrics: metrics({ minMs: 34, p50Ms: 36, p95Ms: 40, p99Ms: 44, jitterMs: 3, spikeCount: 0 }),
        series: []
      }
    ],
    valorant: [{ t: 1, rttMs: 36, lossPct: 0 }],
    valorantMetrics: metrics({ minMs: 36, p50Ms: 36, p95Ms: 36, p99Ms: 36, avgMs: 36, lastMs: 36 }),
    adapterPeakIn: 1,
    adapterPeakOut: 1,
    coincidence: coincidence(),
    diagnosis: {
      scope: 'healthy',
      confidence: 0.5,
      summary: 'ok',
      findings: [],
      cannotConclude: []
    },
    ...partial
  }
}

export function diagnosis(scope: Diagnosis['scope'], findingIds: string[]): Diagnosis {
  return {
    scope,
    confidence: 0.7,
    summary: 'test',
    findings: findingIds.map((id) => ({
      id,
      scope: id.includes('local') ? 'local' : 'upstream',
      severity: 'problem',
      title: id,
      evidence: 'measured'
    })),
    cannotConclude: []
  }
}
