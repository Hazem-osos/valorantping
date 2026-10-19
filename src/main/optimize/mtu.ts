import type { MtuSnapshot } from '../../shared/types'
import { systemBinary } from '../network/binaries'
import { runCommand } from '../network/runCommand'
import { runAdminPowershell } from './windows'

function asRows(parsed: unknown): Record<string, unknown>[] {
  if (!parsed) return []
  return (Array.isArray(parsed) ? parsed : [parsed]) as Record<string, unknown>[]
}

export async function readMtu(): Promise<MtuSnapshot[]> {
  if (process.platform !== 'win32') return []
  const script =
    'Get-NetIPInterface -AddressFamily IPv4 | Where-Object {$_.ConnectionState -eq "Connected"} | Select-Object InterfaceAlias,NlMtu | ConvertTo-Json -Compress'
  const result = await runCommand(
    systemBinary('powershell'),
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { timeoutMs: 12000 }
  )
  const trimmed = result.stdout.trim()
  if (!trimmed) return []
  try {
    return asRows(JSON.parse(trimmed))
      .map((row) => ({
        iface: String(row.InterfaceAlias ?? ''),
        mtu: Number(row.NlMtu ?? 0)
      }))
      .filter((row) => row.iface && row.mtu > 0)
  } catch {
    return []
  }
}

export async function setMtu(iface: string, mtu: number): Promise<void> {
  if (process.platform !== 'win32') throw new Error('MTU changes are Windows-only')
  if (!/^[A-Za-z0-9 _()-]+$/.test(iface)) throw new Error('Invalid interface name')
  if (!Number.isInteger(mtu) || mtu < 576 || mtu > 9000) throw new Error('MTU out of safe range')
  const script = `Set-NetIPInterface -InterfaceAlias '${iface.replaceAll("'", "''")}' -AddressFamily IPv4 -NlMtuBytes ${mtu}`
  await runAdminPowershell(script, 15000)
}
