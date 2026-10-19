import { systemBinary } from './binaries'
import {
  parseGatewayFromIpRoute,
  parseGatewayFromRouteGet,
  parseGatewayFromWindowsRoute,
  parseNetstatIb,
  parseWindowsAdapterJson
} from './parseAdapters'
import { runCommand } from './runCommand'
import type { NetworkInfo } from '../../shared/types'

async function unixGateway(): Promise<{ gateway: string | null; iface: string | null }> {
  if (process.platform === 'linux') {
    const result = await runCommand(systemBinary('ip'), ['route', 'show', 'default'], {
      timeoutMs: 4000
    })
    return parseGatewayFromIpRoute(result.stdout)
  }
  const result = await runCommand(systemBinary('route'), ['-n', 'get', 'default'], {
    timeoutMs: 4000
  })
  return parseGatewayFromRouteGet(result.stdout)
}

async function windowsGateway(): Promise<{ gateway: string | null; iface: string | null }> {
  const ps = systemBinary('powershell')
  const script =
    'Get-NetRoute -DestinationPrefix 0.0.0.0/0 | Select-Object -First 1 NextHop,InterfaceAlias | ConvertTo-Json -Compress'
  try {
    const result = await runCommand(
      ps,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeoutMs: 8000 }
    )
    const parsed = parseGatewayFromWindowsRoute(result.stdout)
    if (parsed.gateway) return parsed
  } catch {
    // Fall through to route print.
  }
  const fallback = await runCommand(systemBinary('route'), ['print', '0.0.0.0'], { timeoutMs: 6000 })
  return parseGatewayFromWindowsRoute(fallback.stdout)
}

async function unixAdapters() {
  const result = await runCommand(systemBinary('netstat'), ['-ib'], { timeoutMs: 5000 })
  return parseNetstatIb(result.stdout)
}

async function windowsAdapters() {
  const script =
    'Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | ForEach-Object { $s = Get-NetAdapterStatistics -Name $_.Name; [pscustomobject]@{ Name=$_.Name; InterfaceDescription=$_.InterfaceDescription; LinkSpeed=$_.LinkSpeed; ReceivedBytes=$s.ReceivedBytes; SentBytes=$s.SentBytes; MacAddress=$_.MacAddress } } | ConvertTo-Json -Compress'
  const result = await runCommand(
    systemBinary('powershell'),
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { timeoutMs: 10000 }
  )
  return parseWindowsAdapterJson(result.stdout || '[]')
}

export async function readNetworkInfo(): Promise<NetworkInfo> {
  const notes: string[] = [
    'Gateway and public ICMP/TCP samples are internet-path measurements, not VALORANT Riyadh RTT.',
    'Phase 1 never changes NIC, route, DNS, or firewall settings.'
  ]
  try {
    const gw = process.platform === 'win32' ? await windowsGateway() : await unixGateway()
    const adapters = process.platform === 'win32' ? await windowsAdapters() : await unixAdapters()
    return {
      platform: process.platform,
      gateway: gw.gateway,
      gatewayInterface: gw.iface,
      adapters,
      notes
    }
  } catch (error) {
    return {
      platform: process.platform,
      gateway: null,
      gatewayInterface: null,
      adapters: [],
      notes: [
        ...notes,
        error instanceof Error ? error.message : 'Failed to read network information'
      ]
    }
  }
}
