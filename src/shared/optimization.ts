import type {
  Diagnosis,
  DiagnosisScope,
  GateResult,
  HostPlatform,
  OptimizeAction,
  OptimizeOffer
} from './types'

export const OPTIMIZE_ACTIONS: OptimizeAction[] = [
  {
    id: 'pause-uploads',
    title: 'Pause background uploads',
    purpose: 'Remove local queueing when spikes coincide with high outbound bytes.',
    risks: 'You may pause cloud backup or game downloads during the match. Nothing in Windows is rewritten.',
    limitations: 'Does not shorten the Egypt–Riyadh floor. The app never kills processes for you.',
    evidenceIds: ['local_congestion_bufferbloat'],
    changeSurface: 'none',
    requiresWindows: false,
    requiresAdmin: false,
    applyMode: 'never'
  },
  {
    id: 'router-sqm',
    title: 'Enable SQM/QoS on the WE router',
    purpose: 'If the home router supports Smart Queue, it can stop upload bursts from inflating RTT.',
    risks: 'A bad QoS profile can cap bandwidth. Change the router yourself; this app cannot log into it.',
    limitations: 'Guidance only. Measure a 15-minute test before and after. Not a VPN and not a shorter Riot path.',
    evidenceIds: ['local_congestion_bufferbloat'],
    changeSurface: 'none',
    requiresWindows: false,
    requiresAdmin: false,
    applyMode: 'never'
  },
  {
    id: 'ethernet-link-check',
    title: 'Confirm 1 Gbps full duplex',
    purpose: 'A 100 Mbps or half-duplex Ethernet link can add delay and loss on an otherwise fine path.',
    risks: 'None from this app; you would change NIC properties yourself in Windows.',
    limitations: 'The app never writes adapter speed/duplex, DNS, MTU, or routes.',
    evidenceIds: ['local_gateway_instability', 'trace_local_jump'],
    changeSurface: 'none',
    requiresWindows: true,
    requiresAdmin: false,
    applyMode: 'never'
  },
  {
    id: 'power-plan-high-performance',
    title: 'Switch to High Performance (user-approved)',
    purpose: 'Stop OS power-saving from parking the CPU/NIC while gateway RTT is already unstable.',
    risks: 'Higher power draw and fan noise. No guaranteed ping drop. Reversible from Optimization Center.',
    limitations: 'Only offered when LAN evidence exists. Will not run silently. Does not touch DNS, MTU, routing, firewall, registry, or TCP stack.',
    evidenceIds: ['local_gateway_instability', 'local_congestion_bufferbloat'],
    changeSurface: 'power-plan',
    requiresWindows: true,
    requiresAdmin: false,
    applyMode: 'user-approved'
  },
  {
    id: 'nic-device-power',
    title: 'Stop Windows turning the NIC off (user-approved)',
    purpose: 'Prevent NIC sleep that can show up as hop-1 / gateway spikes on Ethernet.',
    risks: 'Slightly higher idle power. Needs Administrator. Reversible. Still not a Riot route change.',
    limitations: 'Blocked unless elevated. Ordinary diagnostics stay non-admin. Never changes DNS, MTU, metric, or offload placebo lists.',
    evidenceIds: ['local_gateway_instability', 'trace_local_jump'],
    changeSurface: 'nic-power',
    requiresWindows: true,
    requiresAdmin: true,
    applyMode: 'user-approved'
  },
  {
    id: 'nic-eee',
    title: 'Disable Energy Efficient Ethernet (user-approved)',
    purpose: 'Some NICs add delay when EEE/Green Ethernet is on. Only offered if the driver exposes the property.',
    risks: 'Slightly higher idle power. Hardware/driver support varies. Reversible. Not a Riot route change.',
    limitations: 'Skipped when the adapter has no EEE keyword. Never a silent change. Measure with A/B before calling it a win.',
    evidenceIds: ['local_gateway_instability', 'trace_local_jump'],
    changeSurface: 'nic-advanced',
    requiresWindows: true,
    requiresAdmin: true,
    applyMode: 'user-approved'
  },
  {
    id: 'nic-interrupt-moderation',
    title: 'A/B test Interrupt Moderation (user-approved)',
    purpose: 'Compare the current IM setting against the safe alternate. Keep only a measured improvement.',
    risks: 'Disabling IM can raise CPU use. Blind disable is rejected. Original value is restored if the delta is not meaningful.',
    limitations: 'Requires the NIC to expose Interrupt Moderation. One change at a time. Overlay RTT is still typed by you.',
    evidenceIds: ['local_gateway_instability'],
    changeSurface: 'nic-advanced',
    requiresWindows: true,
    requiresAdmin: true,
    applyMode: 'user-approved'
  },
  {
    id: 'mtu-fix',
    title: 'Correct path-MTU mismatch (user-approved)',
    purpose: 'Only if DF probes show fragmentation below a 1500-byte Ethernet frame.',
    risks: 'A wrong MTU can break sites. Requires extra confirmation, backup, rollback, and A/B.',
    limitations: 'Never randomly set. Not applied without fragmentation evidence. Does not lower the Egypt–Riyadh floor.',
    evidenceIds: ['path_mtu_mismatch'],
    changeSurface: 'mtu',
    requiresWindows: true,
    requiresAdmin: true,
    applyMode: 'user-approved'
  },
  {
    id: 'delivery-optimization',
    title: 'Review Delivery Optimization uploads',
    purpose: 'DoSvc/BITS can upload in the background and inflate bufferbloat. Guidance only.',
    risks: 'None from this app. Windows services are not disabled.',
    limitations: 'You change Delivery Optimization in Windows Settings yourself if evidence supports it.',
    evidenceIds: ['local_congestion_bufferbloat'],
    changeSurface: 'none',
    requiresWindows: true,
    requiresAdmin: false,
    applyMode: 'never'
  },
  {
    id: 'isp-or-riot-path',
    title: 'No safe local fix for this path',
    purpose: 'Tell you when the delay is beyond the PC and LAN so you do not apply placebo tweaks.',
    risks: 'None. No Windows setting is changed.',
    limitations: 'WE Egypt or the Riyadh/regional internet path cannot be shortened from this app. Record overlay RTT and export evidence.',
    evidenceIds: ['upstream_beyond_lan', 'isp_early_hop', 'upstream_later_hop', 'path_floor'],
    changeSurface: 'none',
    requiresWindows: false,
    requiresAdmin: false,
    applyMode: 'never'
  }
]

export const FORBIDDEN_APPLY_IDS = new Set([
  'dns',
  'mtu',
  'routing',
  'firewall',
  'registry',
  'tcp-stack',
  'netsh',
  'vanguard',
  'valorant'
])

export interface GateContext {
  platform: HostPlatform
  elevated: boolean
  userConfirmed: boolean
  diagnosis: Diagnosis
  hasBaseline?: boolean
  mtuMismatch?: boolean
  nicFeaturePresent?: boolean
}

function findingIds(diagnosis: Diagnosis): Set<string> {
  const ids = new Set(diagnosis.findings.map((finding) => finding.id))
  ids.add(diagnosis.scope)
  return ids
}

function localEvidence(ids: Set<string>): boolean {
  return (
    ids.has('local_gateway_instability') ||
    ids.has('local_congestion_bufferbloat') ||
    ids.has('trace_local_jump') ||
    ids.has('local')
  )
}

export function evaluateAction(action: OptimizeAction, ctx: GateContext): GateResult {
  const ids = findingIds(ctx.diagnosis)
  const evidenceMatched = action.evidenceIds.filter((id) => ids.has(id))
  const reasons: string[] = []

  if (FORBIDDEN_APPLY_IDS.has(action.id)) {
    return {
      actionId: action.id,
      allowed: false,
      readyForConfirm: false,
      reasons: ['This surface is forbidden. The app will not silently change DNS, routing, firewall, registry, or TCP stack.'],
      evidenceMatched
    }
  }

  if (ctx.hasBaseline === false && action.applyMode === 'user-approved') {
    reasons.push('Run a Baseline Session (3–5 minutes) before applying Windows changes.')
  }

  if (action.id === 'mtu-fix' && ctx.mtuMismatch !== true) {
    reasons.push('No path-MTU mismatch was measured. MTU is not changed without fragmentation evidence.')
  }

  if (
    (action.id === 'nic-eee' || action.id === 'nic-interrupt-moderation') &&
    ctx.nicFeaturePresent === false
  ) {
    reasons.push('This NIC/driver does not expose the property, so the change is skipped.')
  }

  if (ctx.diagnosis.scope === 'insufficient_data') {
    reasons.push('Not enough probe samples to justify a Windows change.')
  }

  if (action.applyMode === 'user-approved' && !localEvidence(ids) && ctx.diagnosis.scope !== 'mixed') {
    reasons.push('LAN evidence is missing. An ISP or Riot path problem cannot be fixed by a local toggle.')
  }

  if (action.applyMode === 'user-approved' && evidenceMatched.length === 0) {
    reasons.push('Current findings do not support this change.')
  }

  if (action.requiresWindows && ctx.platform !== 'win32') {
    reasons.push('This Windows change cannot run on this OS. Guidance still applies.')
  }

  if (action.requiresAdmin && !ctx.elevated) {
    reasons.push('This change will request Administrator via UAC for this operation only. Ordinary diagnostics stay unelevated.')
  }

  if (action.applyMode === 'never') {
    reasons.push('Guidance only. The app will not apply this for you.')
  }

  if (action.applyMode === 'user-approved' && !ctx.userConfirmed) {
    reasons.push('No setting is written until you confirm in Optimization Center.')
  }

  const blocking = reasons.filter(
    (reason) => !reason.startsWith('No setting is written') && !reason.includes('UAC')
  )
  const readyForConfirm = action.applyMode === 'user-approved' && blocking.length === 0
  const allowed = readyForConfirm && ctx.userConfirmed

  return { actionId: action.id, allowed, readyForConfirm, reasons, evidenceMatched }
}

export function offersFor(ctx: Omit<GateContext, 'userConfirmed'>): OptimizeOffer[] {
  const preview: GateContext = { ...ctx, userConfirmed: false }
  const offers = OPTIMIZE_ACTIONS.map((action) => ({
    action,
    gate: evaluateAction(action, preview)
  }))
  const ids = findingIds(ctx.diagnosis)
  const matched = offers.filter((offer) => offer.gate.evidenceMatched.length > 0 || offer.action.id === 'isp-or-riot-path')
  const relevant = matched.length > 0 ? matched : offers.filter((offer) => offer.action.id === 'isp-or-riot-path')
  if (!localEvidence(ids) && (ctx.diagnosis.scope === 'isp' || ctx.diagnosis.scope === 'upstream' || ids.has('path_floor'))) {
    return relevant
  }
  return relevant
}

export function assertApplySafe(action: OptimizeAction, ctx: GateContext): GateResult {
  const result = evaluateAction(action, ctx)
  if (!result.allowed) {
    return result
  }
  if (action.changeSurface === 'none') {
    return {
      ...result,
      allowed: false,
      readyForConfirm: false,
      reasons: [...result.reasons, 'Guidance items cannot be applied as Windows changes.']
    }
  }
  return result
}

export function rollbackAllowed(scope: DiagnosisScope): boolean {
  return scope !== 'insufficient_data'
}

export function nicRestoreValue(stored: string): 'Enabled' | 'Disabled' {
  return /enable/i.test(stored) ? 'Enabled' : 'Disabled'
}
