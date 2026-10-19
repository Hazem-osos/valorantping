import { classifyBottleneck, type ClassifierInput } from './classifier'
import { localScore, localStabilityImprovementPct } from './scores'
import type { CoincidenceStats, StoredSession, ValorantOptReport, WindowMetrics } from './types'

function pick(session: StoredSession, kind: 'gateway' | 'isp' | 'public' | 'regional'): WindowMetrics | null {
  return session.targets.find((target) => target.target.kind === kind)?.metrics ?? null
}

function coincidence(session: StoredSession): CoincidenceStats {
  return session.coincidence
}

function inputFrom(session: StoredSession): ClassifierInput {
  return {
    gateway: pick(session, 'gateway'),
    isp: pick(session, 'isp'),
    publicNet: pick(session, 'public'),
    regional: pick(session, 'regional'),
    coincidence: coincidence(session),
    valorant: session.valorantMetrics,
    linkSpeedBps: null,
    nicMayPowerOff: false,
    sampleCount: session.targets.reduce((sum, target) => sum + target.metrics.sampleCount, 0)
  }
}

function delta(before: number | null, after: number | null): number | null {
  if (before === null || after === null) return null
  return Math.round((after - before) * 10) / 10
}

export function buildValorantReport(before: StoredSession, after: StoredSession): ValorantOptReport {
  const classifierBefore = classifyBottleneck(inputFrom(before))
  const classifierAfter = classifyBottleneck(inputFrom(after))
  const gwBefore = pick(before, 'gateway')
  const gwAfter = pick(after, 'gateway')
  const farBefore = pick(before, 'regional') ?? pick(before, 'public')
  const farAfter = pick(after, 'regional') ?? pick(after, 'public')
  const overlayBefore = before.valorantMetrics?.p50Ms ?? before.valorantMetrics?.avgMs ?? null
  const overlayAfter = after.valorantMetrics?.p50Ms ?? after.valorantMetrics?.avgMs ?? null
  const localPct = localStabilityImprovementPct(localScore(gwBefore), localScore(gwAfter))
  const internetP95Delta = delta(farBefore?.p95Ms ?? null, farAfter?.p95Ms ?? null)
  const overlayDelta = delta(overlayBefore, overlayAfter)
  const pathFloorUnchanged =
    overlayBefore !== null && overlayAfter !== null
      ? Math.abs(overlayAfter - overlayBefore) < 3
      : (farBefore?.minMs ?? 0) >= 30 && Math.abs((farAfter?.minMs ?? farBefore?.minMs ?? 0) - (farBefore?.minMs ?? 0)) < 3

  const caveats = [
    'ICMP/TCP numbers are path quality. Only overlay samples are VALORANT Riyadh RTT.',
    'Percentages are computed from measured gateway/far-end windows, not invented.'
  ]
  if (before.valorantMetrics === null || after.valorantMetrics === null) {
    caveats.push('Overlay RTT is missing on one side, so game-latency improvement cannot be claimed.')
  }

  let summary = 'Not enough matched evidence to describe a VALORANT improvement.'
  if (localPct !== null && localPct > 5 && pathFloorUnchanged) {
    summary = `Local network stability improved by ${localPct}%. No evidence shows that the ~36 ms VALORANT path floor changed.`
  } else if (internetP95Delta !== null && internetP95Delta <= -3) {
    summary = `External median/p95 latency improved by ${Math.abs(internetP95Delta)} ms after the measured change. VALORANT RTT must be verified in-game before calling this a game-latency improvement.`
  } else if (overlayDelta !== null && overlayDelta <= -3) {
    summary = `Entered overlay p50 moved ${overlayDelta} ms. Confirm it in a real Riyadh match; this app did not read Vanguard or game memory.`
  } else if (pathFloorUnchanged && classifierAfter.buckets.unfixableLocally) {
    summary =
      'Gateway, congestion, and NIC look healthy enough that ~36 ms is likely WE/Riot path distance. A local app cannot force a different international route.'
  } else if (localPct !== null && localPct < -5) {
    summary = `Local stability score dropped ${Math.abs(localPct)}%. Rollback the last Windows change and retest.`
  }

  return {
    before,
    after,
    classifierBefore,
    classifierAfter,
    overlayBefore,
    overlayAfter,
    gatewayP95Delta: delta(gwBefore?.p95Ms ?? null, gwAfter?.p95Ms ?? null),
    internetP95Delta,
    jitterDelta: delta(farBefore?.jitterMs ?? null, farAfter?.jitterMs ?? null),
    spikeDelta: delta(farBefore?.spikeCount ?? null, farAfter?.spikeCount ?? null),
    localStabilityPct: localPct,
    pathFloorUnchanged,
    summary,
    caveats
  }
}
