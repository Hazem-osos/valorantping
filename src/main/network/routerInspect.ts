import type { RouterInspect } from '../../shared/types'
import { readNetworkInfo } from './gateway'

const FINGERPRINTS: Array<{ match: RegExp; name: string; sqm: boolean }> = [
  { match: /openwrt|luci/i, name: 'OpenWrt', sqm: true },
  { match: /mikrotik|routeros/i, name: 'MikroTik', sqm: false },
  { match: /asus|asuswrt/i, name: 'ASUS', sqm: false },
  { match: /tplink|tp-link|archer/i, name: 'TP-Link', sqm: false },
  { match: /netgear/i, name: 'NETGEAR', sqm: false },
  { match: /huawei/i, name: 'Huawei', sqm: false },
  { match: /d-link|dlink/i, name: 'D-Link', sqm: false },
  { match: /ubiquiti|unifi|edgerouter/i, name: 'Ubiquiti', sqm: false }
]

export async function inspectRouter(): Promise<RouterInspect> {
  const info = await readNetworkInfo()
  const gateway = info.gateway
  const notes = [
    'SQM mainly reduces latency under congestion. It generally does not reduce the physical/path baseline RTT.',
    'A local app cannot log into the WE gateway or enable CAKE for you.',
    'If SQM is available, start around 85–95% of measured line rate and retest bufferbloat.'
  ]
  if (!gateway) {
    return { gateway: null, fingerprint: null, known: false, notes: [...notes, 'Default gateway is unknown.'], sqmAdvice: [] }
  }
  let body = ''
  let server = ''
  try {
    const res = await fetch(`http://${gateway}/`, {
      signal: AbortSignal.timeout(2500),
      redirect: 'follow'
    })
    server = res.headers.get('server') ?? ''
    body = (await res.text()).slice(0, 8000)
  } catch {
    notes.push('HTTP fingerprint of the gateway failed. Manufacturer/model stay unknown; do not invent router menus.')
    return {
      gateway,
      fingerprint: null,
      known: false,
      notes,
      sqmAdvice: [
        'Capabilities unknown. Look in the router UI for SQM, CAKE, FQ-CoDel, or QoS / gaming-device priority. If none exist, say so and skip.'
      ]
    }
  }
  const blob = `${server}\n${body}`
  const hit = FINGERPRINTS.find((item) => item.match.test(blob))
  const sqmAdvice = hit?.sqm
    ? [
        `This looks like ${hit.name}, which often supports SQM/CAKE/FQ-CoDel.`,
        'Set upload/download to about 85–95% of the real line rate, enable SQM, then rerun the bufferbloat test.',
        'Give the Ethernet gaming PC priority only if the firmware documents that feature.'
      ]
    : [
        hit
          ? `Fingerprint suggests ${hit.name}. SQM/CAKE availability is not confirmed from this probe.`
          : 'Router family is unknown. Do not invent settings.',
        'If the UI has Smart Queue / SQM / CAKE / FQ-CoDel, use that for congestion. If it only has generic QoS, treat it as best-effort.',
        'Gaming-device priority helps only when the bottleneck is the WAN queue, not WE/Riot routing.'
      ]
  return {
    gateway,
    fingerprint: hit?.name ?? (server || null),
    known: Boolean(hit),
    notes,
    sqmAdvice
  }
}
