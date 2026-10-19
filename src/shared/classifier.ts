import { GATEWAY_HEALTHY_P95_MS, INSUFFICIENT_SAMPLES, LOCAL_GATEWAY_WARN_P95_MS } from './constants'
import type { ClassifierResult, ClassifierState, CoincidenceStats, WindowMetrics } from './types'

export interface ClassifierInput {
  gateway: WindowMetrics | null
  isp: WindowMetrics | null
  publicNet: WindowMetrics | null
  regional: WindowMetrics | null
  coincidence: CoincidenceStats
  valorant: WindowMetrics | null
  linkSpeedBps: number | null
  nicMayPowerOff: boolean
  sampleCount: number
}

function unstable(metrics: WindowMetrics | null, spikeThreshold = 100): boolean {
  if (!metrics) return false
  return (
    metrics.lossPct >= 3 ||
    metrics.spikeCount >= 3 ||
    (metrics.p95Ms ?? 0) >= spikeThreshold ||
    (metrics.jitterMs ?? 0) >= 15
  )
}

export function classifyFromSession(
  session: {
    targets: Array<{ target: { kind: 'gateway' | 'isp' | 'public' | 'regional' }; metrics: WindowMetrics }>
    coincidence: CoincidenceStats
    valorantMetrics: WindowMetrics | null
  },
  extras: { linkSpeedBps?: number | null; nicMayPowerOff?: boolean } = {}
): ClassifierResult {
  const pick = (kind: 'gateway' | 'isp' | 'public' | 'regional'): WindowMetrics | null =>
    session.targets.find((target) => target.target.kind === kind)?.metrics ?? null
  return classifyBottleneck({
    gateway: pick('gateway'),
    isp: pick('isp'),
    publicNet: pick('public'),
    regional: pick('regional'),
    coincidence: session.coincidence,
    valorant: session.valorantMetrics,
    linkSpeedBps: extras.linkSpeedBps ?? null,
    nicMayPowerOff: extras.nicMayPowerOff ?? false,
    sampleCount: session.targets.reduce((sum, target) => sum + target.metrics.sampleCount, 0)
  })
}

export function classifyBottleneck(input: ClassifierInput): ClassifierResult {
  const reasons: string[] = []
  const secondary: ClassifierState[] = []
  if (input.sampleCount < INSUFFICIENT_SAMPLES) {
    return {
      primary: 'INCONCLUSIVE',
      secondary: [],
      confidence: 0.2,
      reasons: [`Only ${input.sampleCount} samples; ${INSUFFICIENT_SAMPLES}+ needed before a confident class.`],
      buckets: {
        baseline: 'unknown',
        jitterSpikes: 'unknown',
        congestion: 'unknown',
        unfixableLocally: false
      }
    }
  }

  const gw = input.gateway
  const far = input.regional ?? input.publicNet ?? input.isp
  const gwBad =
    !!gw &&
    (gw.lossPct >= 5 ||
      (gw.p95Ms ?? 0) >= LOCAL_GATEWAY_WARN_P95_MS ||
      (gw.jitterMs ?? 0) >= 10 ||
      gw.spikeCount >= 3)
  const gwGood =
    !!gw && gw.lossPct < 1 && (gw.p95Ms ?? 0) <= GATEWAY_HEALTHY_P95_MS && (gw.jitterMs ?? 0) < 5
  const farBad = unstable(far)
  const congestion =
    (input.coincidence.spikeWithHighUploadPct ?? 0) >= 50 && input.coincidence.spikeCount >= 3
  const dnsOnly =
    unstable(input.isp) &&
    !unstable(input.publicNet) &&
    !unstable(input.regional) &&
    gwGood
  const gameSpecific =
    gwGood &&
    !farBad &&
    !!input.valorant &&
    input.valorant.sampleCount >= 3 &&
    ((input.valorant.p95Ms ?? 0) >= 80 || input.valorant.spikeCount >= 3)
  const slowLink = input.linkSpeedBps !== null && input.linkSpeedBps > 0 && input.linkSpeedBps < 900_000_000

  if (congestion) {
    reasons.push(
      `${input.coincidence.spikesWithHighUpload}/${input.coincidence.spikeCount} spikes lined up with high upload (p70). That is bufferbloat/local queueing, not a shorter Riyadh route.`
    )
    secondary.push('BUFFERBLOAT_SUSPECTED', 'LOCAL_CONGESTION')
  }
  if (gwBad) {
    reasons.push(
      `Gateway p95 ${gw?.p95Ms ?? 'n/a'}ms, jitter ${gw?.jitterMs ?? 'n/a'}ms, loss ${gw?.lossPct.toFixed(1)}%. Ethernet should stay near 1ms.`
    )
    secondary.push('LOCAL_LAN')
  }
  if (gwGood && farBad) {
    reasons.push(
      `Gateway is quiet (p95 ${gw?.p95Ms}ms) while the farther target p95 is ${far?.p95Ms ?? 'n/a'}ms with ${far?.spikeCount ?? 0} spikes. Delay forms beyond the LAN.`
    )
    secondary.push('UPSTREAM_ROUTE')
  }
  if (dnsOnly) {
    reasons.push('WE DNS is noisy while Cloudflare/Google and the gateway are not. That is a resolver issue, not VALORANT RTT.')
    secondary.push('DNS_ONLY')
  }
  if (gameSpecific) {
    reasons.push(
      `Public/regional probes are stable but overlay p95 is ${input.valorant?.p95Ms}ms. Game UDP may differ from ICMP/TCP.`
    )
    secondary.push('GAME_SPECIFIC')
  }
  if (input.nicMayPowerOff && gwBad) {
    reasons.push('Windows may power down the NIC and the gateway is already unstable. That is a candidate A/B, not a guaranteed fix.')
    secondary.push('NIC_POWER_MANAGEMENT')
  }
  if (slowLink) {
    reasons.push(`Negotiated link is ${(input.linkSpeedBps! / 1_000_000).toFixed(0)} Mbps, not ~1000. Do not auto-force duplex; check the cable/switch.`)
    secondary.push('LOCAL_LAN')
  }
  if (gwGood && farBad && !congestion) {
    secondary.push('ISP_EDGE')
  }

  const unique = [...new Set(secondary)]
  let primary: ClassifierState = 'STABLE'
  if (unique.includes('BUFFERBLOAT_SUSPECTED')) primary = 'BUFFERBLOAT_SUSPECTED'
  else if (unique.includes('LOCAL_CONGESTION')) primary = 'LOCAL_CONGESTION'
  else if (unique.includes('LOCAL_LAN')) primary = 'LOCAL_LAN'
  else if (unique.includes('NIC_POWER_MANAGEMENT')) primary = 'NIC_POWER_MANAGEMENT'
  else if (unique.includes('DNS_ONLY')) primary = 'DNS_ONLY'
  else if (unique.includes('GAME_SPECIFIC')) primary = 'GAME_SPECIFIC'
  else if (unique.includes('UPSTREAM_ROUTE')) primary = 'UPSTREAM_ROUTE'
  else if (unique.includes('ISP_EDGE')) primary = 'ISP_EDGE'
  else if (!gwBad && !farBad) {
    primary = 'STABLE'
    reasons.push('No strong spike/loss signature in this window. A stable ~36ms overlay can still be the path floor.')
  } else {
    primary = 'INCONCLUSIVE'
    reasons.push('Signals conflict or are thin; do not apply Windows changes yet.')
  }

  const unfixableLocally =
    (primary === 'UPSTREAM_ROUTE' || primary === 'ISP_EDGE' || primary === 'GAME_SPECIFIC' || primary === 'STABLE') &&
    !unique.includes('LOCAL_LAN') &&
    !unique.includes('BUFFERBLOAT_SUSPECTED')

  if (unfixableLocally && (far?.minMs ?? 0) >= 30) {
    reasons.push('Best far-end min RTT is already in the 30ms+ band. A local app cannot force WE onto a shorter international route.')
  }

  const confidence = Math.min(
    0.92,
    0.35 + Math.min(input.sampleCount, 80) / 160 + (gw ? 0.15 : 0) + (input.valorant && input.valorant.sampleCount >= 3 ? 0.1 : 0)
  )

  return {
    primary,
    secondary: unique.filter((state) => state !== primary),
    confidence,
    reasons,
    buckets: {
      baseline: (far?.minMs ?? 0) >= 30 ? 'unlikely' : 'unknown',
      jitterSpikes: gwBad ? 'local' : farBad && gwGood ? 'upstream' : 'unknown',
      congestion: congestion ? 'likely' : 'unlikely',
      unfixableLocally
    }
  }
}
