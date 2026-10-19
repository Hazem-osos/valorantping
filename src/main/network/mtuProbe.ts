import type { MtuProbeResult } from '../../shared/types'
import { icmpPingDf } from './ping'
import { readNetworkInfo } from './gateway'

const PAYLOADS = [1472, 1464, 1452, 1400, 1280, 1200, 576]

function fragmented(error?: string): boolean {
  return Boolean(error && /fragment/i.test(error))
}

export async function probePathMtu(signal?: AbortSignal): Promise<MtuProbeResult> {
  const info = await readNetworkInfo()
  const host = info.gateway ?? '1.1.1.1'
  const notes: string[] = [
    'Payload sizes are ICMP data bytes. Ethernet MTU is typically payload + 28.',
    'This is not VALORANT RTT and is never applied automatically.'
  ]
  const working: number[] = []
  let sawFragment = false
  for (const payload of PAYLOADS) {
    if (signal?.aborted) break
    const result = await icmpPingDf(host, payload, 1500, signal)
    if (fragmented(result.error)) sawFragment = true
    if (!result.timedOut && result.rttMs !== null) working.push(payload)
  }
  const largestWorkingPayload = working.length ? Math.max(...working) : null
  const mismatch = sawFragment && largestWorkingPayload !== null && largestWorkingPayload < 1472
  if (!sawFragment && largestWorkingPayload === 1472) {
    notes.push('DF 1472 succeeded. No path-MTU mismatch evidence on this hop.')
  }
  if (mismatch) {
    notes.push(
      `Largest DF payload that worked was ${largestWorkingPayload} bytes. A change is only offered after extra confirmation, backup, rollback, and A/B.`
    )
  }
  if (working.length === 0) {
    notes.push('No DF ping succeeded. Result is inconclusive; ICMP may be filtered.')
  }
  return {
    host,
    payloadTried: PAYLOADS,
    largestWorkingPayload,
    recommendedMtu: mismatch && largestWorkingPayload !== null ? largestWorkingPayload + 28 : null,
    fragmentationEvidence: mismatch,
    notes
  }
}
