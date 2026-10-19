import type { Diagnosis, Recommendation } from './types'

export const RECOMMENDATION_CATALOG: Recommendation[] = [
  {
    id: 'pause-uploads',
    title: 'Pause background uploads before ranked',
    body: 'If spikes line up with high outbound bytes, pause OneDrive, Steam, Windows Update, Discord clips, and cloud backups. This does not shorten the Egypt–Riyadh floor; it only reduces queueing.',
    appliesWhen: ['local_congestion_bufferbloat', 'mixed'],
    windowsFocused: true,
    automatic: false
  },
  {
    id: 'ethernet-link',
    title: 'Confirm the Ethernet link is 1 Gbps full duplex',
    body: 'In Windows Adapter Status, link speed should be 1.0 Gbps. 100 Mbps or half duplex can add latency and loss. Change this yourself in NIC properties; Phase 1 will not touch it.',
    appliesWhen: ['local_gateway_instability', 'trace_local_jump'],
    windowsFocused: true,
    automatic: false
  },
  {
    id: 'cable-nic',
    title: 'Swap the cable and review the NIC driver',
    body: 'A noisy Ethernet path shows up as gateway jitter and hop-1 delay. Try another Cat5e/Cat6 cable, a different NIC port, and the vendor driver — not a VPN.',
    appliesWhen: ['local_gateway_instability', 'trace_local_jump'],
    windowsFocused: true,
    automatic: false
  },
  {
    id: 'bufferbloat-sqm',
    title: 'If the router supports SQM/QoS, enable it there',
    body: 'When upload correlates with RTT, Smart Queue or similar on the WE router can cut spikes. Measure a before snapshot, change the router, then capture after. This app will not rewrite router settings.',
    appliesWhen: ['local_congestion_bufferbloat'],
    windowsFocused: false,
    automatic: false
  },
  {
    id: 'isp-evidence',
    title: 'Send WE Egypt hop evidence, not a ping screenshot',
    body: 'If traceroute jumps at hop 2–4 while the gateway stays ~1ms, the access network is the likely queue. Export CSV plus traceroute from this app. A VPN would hide that evidence and is out of scope.',
    appliesWhen: ['isp_early_hop', 'upstream_beyond_lan'],
    windowsFocused: false,
    automatic: false
  },
  {
    id: 'do-not-chase-floor',
    title: 'Do not expect a guaranteed drop below 36ms',
    body: 'A stable 36ms VALORANT Riyadh baseline on WE Egypt Ethernet is already a strong path result. Phase 1 can expose spikes and local queues. It cannot invent a shorter route or promise a lower floor.',
    appliesWhen: ['path_floor', 'healthy', 'icmp_not_game'],
    windowsFocused: false,
    automatic: false
  },
  {
    id: 'record-game',
    title: 'Record the in-game overlay during spikes',
    body: 'Open VALORANT settings, read the Riyadh RTT, and log it here every 10–15 seconds during a match. That is the only number this app treats as game RTT.',
    appliesWhen: ['game_rtt_diverges', 'icmp_not_game', 'insufficient_data', 'healthy'],
    windowsFocused: false,
    automatic: false
  },
  {
    id: 'nic-interrupt',
    title: 'Advanced NIC tweaks are optional and manual',
    body: 'Interrupt moderation, large send offload, and power saving can affect spike shape. Change one setting at a time and compare snapshots. Phase 1 never writes registry, netsh, or driver values.',
    appliesWhen: ['local_gateway_instability', 'local_congestion_bufferbloat'],
    windowsFocused: true,
    automatic: false
  }
]

export function recommendationsFor(diagnosis: Diagnosis): Recommendation[] {
  const ids = new Set(diagnosis.findings.map((finding) => finding.id))
  ids.add(diagnosis.scope)
  const matched = RECOMMENDATION_CATALOG.filter((item) =>
    item.appliesWhen.some((flag) => ids.has(flag))
  )
  if (matched.length === 0) {
    return RECOMMENDATION_CATALOG.filter((item) => item.id === 'do-not-chase-floor' || item.id === 'record-game')
  }
  const seen = new Set<string>()
  return matched.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

export function assertNoAutomaticChanges(items: Recommendation[]): void {
  for (const item of items) {
    if (item.automatic !== false) {
      throw new Error(`Recommendation ${item.id} must remain manual in Phase 1`)
    }
  }
}
