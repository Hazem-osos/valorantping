import {
  GATEWAY_HEALTHY_P95_MS,
  INSUFFICIENT_SAMPLES,
  LOCAL_GATEWAY_WARN_P95_MS
} from './constants'
import type {
  CoincidenceStats,
  Diagnosis,
  Finding,
  TargetKind,
  TraceHop,
  WindowMetrics
} from './types'

export interface DiagnosisInput {
  windows: Record<string, { kind: TargetKind; metrics: WindowMetrics; label: string }>
  coincidence: CoincidenceStats
  traceroute?: { hops: TraceHop[]; firstSustainedJumpHop: number | null }
  valorant?: WindowMetrics | null
  spikeThresholdMs: number
}

function pickKind(windows: DiagnosisInput['windows'], kind: TargetKind): WindowMetrics | null {
  const matches = Object.values(windows).filter((item) => item.kind === kind)
  if (matches.length === 0) return null
  return matches.reduce((best, item) =>
    item.metrics.sampleCount > best.metrics.sampleCount ? item : best
  ).metrics
}

function samplesOf(windows: DiagnosisInput['windows']): number {
  return Object.values(windows).reduce((sum, item) => sum + item.metrics.sampleCount, 0)
}

export function diagnose(input: DiagnosisInput): Diagnosis {
  const findings: Finding[] = [
    {
      id: 'icmp_not_game',
      scope: 'context',
      severity: 'info',
      title: 'Public RTT is not VALORANT RTT',
      evidence:
        'ICMP and TCP connect times measure internet path quality only. Riot/VALORANT Riyadh RTT is valid only from the in-game overlay, recorded in a session here.'
    }
  ]
  const cannotConclude: string[] = []
  const totalSamples = samplesOf(input.windows)
  const gateway = pickKind(input.windows, 'gateway')
  const isp = pickKind(input.windows, 'isp')
  const publicNet = pickKind(input.windows, 'public')
  const regional = pickKind(input.windows, 'regional')
  const far = regional ?? publicNet ?? isp

  if (totalSamples < INSUFFICIENT_SAMPLES) {
    return {
      scope: 'insufficient_data',
      confidence: 0.2,
      summary: 'Not enough probe samples yet to separate LAN trouble from ISP or regional path issues.',
      findings: [
        ...findings,
        {
          id: 'insufficient_data',
          scope: 'insufficient_data',
          severity: 'info',
          title: 'Keep measuring',
          evidence: `Collected ${totalSamples} samples; ${INSUFFICIENT_SAMPLES}+ are required before a local vs upstream call.`
        }
      ],
      cannotConclude: ['Local vs ISP vs regional path', 'Whether 36ms is a physical floor']
    }
  }

  const gatewayUnstable =
    !!gateway &&
    (gateway.lossPct >= 5 ||
      (gateway.p95Ms ?? 0) >= LOCAL_GATEWAY_WARN_P95_MS ||
      (gateway.jitterMs ?? 0) >= 10 ||
      gateway.spikeCount >= 3)
  const gatewayHealthy =
    !!gateway &&
    gateway.lossPct < 1 &&
    (gateway.p95Ms ?? 0) <= GATEWAY_HEALTHY_P95_MS &&
    (gateway.jitterMs ?? 0) < 5
  const farUnstable =
    !!far &&
    (far.lossPct >= 3 || far.spikeCount >= 3 || (far.p95Ms ?? 0) >= input.spikeThresholdMs)
  const congestionLinked =
    (input.coincidence.spikeWithHighUploadPct ?? 0) >= 50 && input.coincidence.spikeCount >= 3
  const jumpHop = input.traceroute?.firstSustainedJumpHop ?? null

  if (congestionLinked) {
    findings.push({
      id: 'local_congestion_bufferbloat',
      scope: 'local',
      severity: 'problem',
      title: 'Latency spikes coincide with upload use',
      evidence: `${input.coincidence.spikesWithHighUpload}/${input.coincidence.spikeCount} spikes landed in seconds with high upload (p70). Pearson r=${input.coincidence.pearsonRttUpload?.toFixed(2) ?? 'n/a'}. This is consistent with bufferbloat or local congestion, not a shorter Riyadh route.`
    })
  }

  if (gatewayUnstable) {
    findings.push({
      id: 'local_gateway_instability',
      scope: 'local',
      severity: 'problem',
      title: 'Default gateway is unstable',
      evidence: `Gateway loss ${gateway?.lossPct.toFixed(1)}%, p95 ${gateway?.p95Ms ?? 'n/a'}ms, jitter ${gateway?.jitterMs ?? 'n/a'}ms, spikes ${gateway?.spikeCount ?? 0}. On Ethernet this should stay near 1ms. The PC, NIC, cable, or LAN is in the picture.`
    })
  } else if (gatewayHealthy && farUnstable) {
    findings.push({
      id: 'upstream_beyond_lan',
      scope: 'upstream',
      severity: 'problem',
      title: 'LAN is quiet while the public path spikes',
      evidence: `Gateway p95 ${gateway?.p95Ms}ms with ${gateway?.lossPct.toFixed(1)}% loss, but ${far ? 'the farther target' : 'upstream'} p95 is ${far?.p95Ms ?? 'n/a'}ms with ${far?.spikeCount ?? 0} spikes. Delay is forming beyond your Ethernet segment.`
    })
  }

  if (jumpHop === 1) {
    findings.push({
      id: 'trace_local_jump',
      scope: 'local',
      severity: 'watch',
      title: 'Traceroute jump starts at hop 1',
      evidence: 'The first sustained RTT increase is at hop 1, which usually means the local hop, router, or NIC path.'
    })
  } else if (jumpHop !== null && jumpHop <= 4) {
    findings.push({
      id: 'isp_early_hop',
      scope: 'isp',
      severity: 'watch',
      title: `Traceroute jump at hop ${jumpHop}`,
      evidence: `The first sustained RTT increase is hop ${jumpHop}. On WE Egypt that is typically still inside the access/ISP network, not Riot.`
    })
  } else if (jumpHop !== null) {
    findings.push({
      id: 'upstream_later_hop',
      scope: 'upstream',
      severity: 'watch',
      title: `Latency accumulates after hop ${jumpHop}`,
      evidence: `The first sustained jump is hop ${jumpHop}, which is more consistent with transit or regional internet than with your LAN.`
    })
  }

  if (far?.minMs !== null && far?.minMs !== undefined && far.minMs >= 30) {
    findings.push({
      id: 'path_floor',
      scope: 'context',
      severity: 'info',
      title: 'Baseline RTT looks path-bound',
      evidence: `Best measured regional/public min is ${far.minMs}ms. Egypt to Riyadh/Bahrain is a long terrestrial/subsea path. Beating a stable ~36ms VALORANT baseline is often not possible without a shorter route, which this app cannot create.`
    })
  }

  if (input.valorant && input.valorant.sampleCount >= 3 && far?.p95Ms != null) {
    const delta = input.valorant.p95Ms! - far.p95Ms
    if (Math.abs(delta) >= 15) {
      findings.push({
        id: 'game_rtt_diverges',
        scope: 'context',
        severity: 'watch',
        title: 'In-game RTT diverges from public probes',
        evidence: `Recorded VALORANT p95 is ${input.valorant.p95Ms}ms vs public/regional p95 ${far.p95Ms}ms (Δ ${delta.toFixed(0)}ms). Game traffic uses a different UDP path and QoS class. Do not treat ICMP as Riot.`
      })
    }
  }

  const localHits = findings.filter((finding) => finding.scope === 'local').length
  const ispHits = findings.filter((finding) => finding.scope === 'isp').length
  const upHits = findings.filter((finding) => finding.scope === 'upstream').length

  let scope: Diagnosis['scope'] = 'healthy'
  if (localHits && (ispHits || upHits)) scope = 'mixed'
  else if (localHits) scope = 'local'
  else if (ispHits) scope = 'isp'
  else if (upHits) scope = 'upstream'
  else if (!farUnstable && !gatewayUnstable) {
    findings.push({
      id: 'healthy',
      scope: 'healthy',
      severity: 'info',
      title: 'No severe spike pattern in this window',
      evidence: 'Gateway and farther probes are not showing a strong spike/loss signature right now. Keep a before/after snapshot if you change anything later.'
    })
  }

  if (!input.valorant || input.valorant.sampleCount < 3) {
    cannotConclude.push('True VALORANT Riyadh RTT until you record the in-game overlay here')
  }
  if (!input.traceroute) {
    cannotConclude.push('Which hop introduces delay until a traceroute is captured')
  }
  if (!gateway) {
    cannotConclude.push('LAN vs upstream split until the default gateway can be probed')
  }

  const confidence = Math.min(
    0.95,
    0.35 +
      Math.min(totalSamples, 60) / 120 +
      (gateway ? 0.15 : 0) +
      (input.traceroute ? 0.1 : 0) +
      (input.valorant && input.valorant.sampleCount >= 3 ? 0.1 : 0)
  )

  const summary =
    scope === 'healthy'
      ? 'Current samples do not show a severe local or upstream spike pattern. Baseline RTT is still bounded by the Egypt–Riyadh path.'
      : scope === 'local'
        ? 'Evidence points at the PC, NIC, cable, or LAN (including possible bufferbloat), not a shorter route to Riyadh.'
        : scope === 'isp'
          ? 'Evidence points at WE Egypt access/early hops. This app cannot retune the ISP path.'
          : scope === 'upstream'
            ? 'LAN looks stable; delay and spikes form beyond it. Public ICMP still is not Riot RTT.'
            : 'Local and upstream signals are both present. Use traceroute, throughput correlation, and in-game recordings to split them.'

  return { scope, confidence, summary, findings, cannotConclude }
}
