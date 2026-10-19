import type { NetworkAdapterInfo } from '../../shared/types'

export function parseNetstatIb(output: string): NetworkAdapterInfo[] {
  const lines = output.split(/\r?\n/).filter((line) => line.trim())
  const headerIndex = lines.findIndex((line) => /Ibytes/i.test(line) && /Obytes/i.test(line))
  if (headerIndex < 0) return []
  const headers = lines[headerIndex].trim().split(/\s+/)
  const ib = headers.findIndex((item) => /^Ibytes$/i.test(item))
  const ob = headers.findIndex((item) => /^Obytes$/i.test(item))
  const adapters: NetworkAdapterInfo[] = []

  for (const line of lines.slice(headerIndex + 1)) {
    if (!/<Link#/i.test(line)) continue
    const cols = line.trim().split(/\s+/)
    const name = cols[0]
    if (!name || name === 'Name') continue
    const bytesReceived = Number.parseInt(cols[ib] ?? '0', 10)
    const bytesSent = Number.parseInt(cols[ob] ?? '0', 10)
    adapters.push({
      id: name,
      name,
      bytesReceived: Number.isFinite(bytesReceived) ? bytesReceived : 0,
      bytesSent: Number.isFinite(bytesSent) ? bytesSent : 0,
      linkSpeedBps: null
    })
  }
  return adapters
}

export function parseWindowsAdapterJson(output: string): NetworkAdapterInfo[] {
  const trimmed = output.trim()
  if (!trimmed) return []
  const parsed = JSON.parse(trimmed) as unknown
  const rows = Array.isArray(parsed) ? parsed : [parsed]
  return rows
    .map((row) => {
      const record = row as Record<string, unknown>
      const name = String(record.Name ?? record.name ?? 'adapter')
      const received = Number(record.ReceivedBytes ?? record.receivedBytes ?? 0)
      const sent = Number(record.SentBytes ?? record.sentBytes ?? 0)
      const speedRaw = record.LinkSpeed ?? record.linkSpeed
      let linkSpeedBps: number | null = null
      if (typeof speedRaw === 'number') linkSpeedBps = speedRaw
      if (typeof speedRaw === 'string') {
        const gbps = speedRaw.match(/([\d.]+)\s*Gbps/i)
        const mbps = speedRaw.match(/([\d.]+)\s*Mbps/i)
        if (gbps) linkSpeedBps = Number.parseFloat(gbps[1]) * 1_000_000_000
        else if (mbps) linkSpeedBps = Number.parseFloat(mbps[1]) * 1_000_000
      }
      return {
        id: name,
        name,
        detail: String(record.InterfaceDescription ?? record.description ?? ''),
        mac: record.MacAddress ? String(record.MacAddress) : undefined,
        bytesReceived: Number.isFinite(received) ? received : 0,
        bytesSent: Number.isFinite(sent) ? sent : 0,
        linkSpeedBps
      } satisfies NetworkAdapterInfo
    })
    .filter((adapter) => adapter.name && adapter.name !== 'undefined')
}

export function parseGatewayFromRouteGet(output: string): { gateway: string | null; iface: string | null } {
  const gateway = output.match(/gateway:\s*([0-9.]+)/i)?.[1] ?? null
  const iface = output.match(/interface:\s*(\S+)/i)?.[1] ?? null
  return { gateway, iface }
}

export function parseGatewayFromIpRoute(output: string): { gateway: string | null; iface: string | null } {
  const match = output.match(/default\s+via\s+([0-9.]+)\s+dev\s+(\S+)/i)
  return { gateway: match?.[1] ?? null, iface: match?.[2] ?? null }
}

export function parseGatewayFromWindowsRoute(output: string): { gateway: string | null; iface: string | null } {
  const lines = output.split(/\r?\n/)
  for (const line of lines) {
    const match = line.trim().match(/^0\.0\.0\.0\s+0\.0\.0\.0\s+([0-9.]+)\s+([0-9.]+)/)
    if (match) return { gateway: match[1], iface: null }
  }
  const jsonTry = output.trim()
  if (jsonTry.startsWith('{') || jsonTry.startsWith('[')) {
    try {
      const parsed = JSON.parse(jsonTry) as Record<string, unknown> | Array<Record<string, unknown>>
      const row = Array.isArray(parsed) ? parsed[0] : parsed
      return {
        gateway: row?.NextHop ? String(row.NextHop) : null,
        iface: row?.InterfaceAlias ? String(row.InterfaceAlias) : null
      }
    } catch {
      return { gateway: null, iface: null }
    }
  }
  return { gateway: null, iface: null }
}
