import { classifyNicProperty, preferredAlternate } from '../../shared/nicDetect'
import type { NicAdvancedSnapshot, NicFeature } from '../../shared/types'
import { systemBinary } from '../network/binaries'
import { runCommand } from '../network/runCommand'
import { runAdminPowershell } from './windows'

function asRows(parsed: unknown): Record<string, unknown>[] {
  if (!parsed) return []
  return (Array.isArray(parsed) ? parsed : [parsed]) as Record<string, unknown>[]
}

export async function readNicAdvanced(): Promise<NicFeature[]> {
  if (process.platform !== 'win32') return []
  const script =
    'Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | ForEach-Object { $n=$_.Name; Get-NetAdapterAdvancedProperty -Name $n -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ Adapter=$n; DisplayName=$_.DisplayName; Keyword=[string]$_.RegistryKeyword; Value=[string]$_.DisplayValue; Valid=($_.ValidDisplayValues -join "|") } } } | ConvertTo-Json -Compress'
  const result = await runCommand(
    systemBinary('powershell'),
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { timeoutMs: 15000 }
  )
  const trimmed = result.stdout.trim()
  if (!trimmed) return []
  try {
    return asRows(JSON.parse(trimmed)).map((row) => {
      const displayName = String(row.DisplayName ?? '')
      const keyword = String(row.Keyword ?? '')
      const valid = String(row.Valid ?? '')
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean)
      return {
        adapter: String(row.Adapter ?? ''),
        displayName,
        keyword,
        value: String(row.Value ?? ''),
        kind: classifyNicProperty(displayName, keyword),
        supportedValues: valid
      }
    }).filter((row) => row.adapter)
  } catch {
    return []
  }
}

export async function setNicAdvanced(adapter: string, displayName: string, value: string): Promise<void> {
  if (process.platform !== 'win32') throw new Error('NIC advanced properties are Windows-only')
  if (!/^[A-Za-z0-9 _()-]+$/.test(adapter)) throw new Error('Invalid adapter name')
  if (!/^[A-Za-z0-9 _()/+.-]+$/.test(displayName)) throw new Error('Invalid display name')
  if (!/^[A-Za-z0-9 _()/+.-]+$/.test(value)) throw new Error('Invalid property value')
  const script = `Set-NetAdapterAdvancedProperty -Name '${adapter.replaceAll("'", "''")}' -DisplayName '${displayName.replaceAll("'", "''")}' -DisplayValue '${value.replaceAll("'", "''")}'`
  await runAdminPowershell(script, 20000)
}

export function snapshotForKind(features: NicFeature[], kind: NicFeature['kind']): NicAdvancedSnapshot[] {
  return features
    .filter((feature) => feature.kind === kind)
    .map((feature) => ({
      adapter: feature.adapter,
      displayName: feature.displayName,
      value: feature.value
    }))
}

export function alternateFor(feature: NicFeature): string | null {
  if (feature.kind !== 'eee' && feature.kind !== 'interrupt-moderation') return null
  return preferredAlternate(feature.kind, feature.value, feature.supportedValues)
}
