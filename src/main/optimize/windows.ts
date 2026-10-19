import { HIGH_PERFORMANCE_SCHEME } from '../../shared/constants'
import type { BackgroundProcessHit, CongestionScan, NicPowerSnapshot, PowerSchemeSnapshot } from '../../shared/types'
import { systemBinary } from '../network/binaries'
import { runCommand } from '../network/runCommand'

const GUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export async function isElevated(): Promise<boolean> {
  if (process.platform !== 'win32') return false
  const result = await runCommand(
    systemBinary('powershell'),
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)'
    ],
    { timeoutMs: 8000 }
  )
  return /True/i.test(result.stdout)
}

export async function readPowerScheme(): Promise<PowerSchemeSnapshot | null> {
  if (process.platform !== 'win32') return null
  const result = await runCommand(systemBinary('powercfg'), ['/getactivescheme'], { timeoutMs: 8000 })
  const match = result.stdout.match(/GUID:\s*([0-9a-fA-F-]{36})\s*(?:\((.+)\))?/i)
  if (!match) return null
  return { guid: match[1], name: match[2]?.trim() || 'active scheme' }
}

export async function setPowerScheme(guid: string): Promise<void> {
  if (!GUID_RE.test(guid)) throw new Error('Invalid power scheme GUID')
  if (process.platform !== 'win32') throw new Error('Power scheme changes are Windows-only')
  const result = await runCommand(systemBinary('powercfg'), ['/setactive', guid], { timeoutMs: 8000 })
  if (result.code && result.code !== 0) {
    throw new Error(result.stderr.trim() || 'powercfg failed')
  }
}

export function highPerformanceGuid(): string {
  return HIGH_PERFORMANCE_SCHEME
}

export async function readNicPower(): Promise<NicPowerSnapshot[]> {
  if (process.platform !== 'win32') return []
  const script =
    'Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | ForEach-Object { $p = Get-NetAdapterPowerManagement -Name $_.Name; [pscustomobject]@{ Name=$_.Name; AllowComputerToTurnOffDevice=[string]$p.AllowComputerToTurnOffDevice } } | ConvertTo-Json -Compress'
  const result = await runCommand(
    systemBinary('powershell'),
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { timeoutMs: 12000 }
  )
  const trimmed = result.stdout.trim()
  if (!trimmed) return []
  const parsed = JSON.parse(trimmed) as unknown
  const rows = Array.isArray(parsed) ? parsed : [parsed]
  return rows.map((row) => {
    const record = row as Record<string, string>
    return {
      name: String(record.Name ?? ''),
      allowComputerToTurnOffDevice: String(record.AllowComputerToTurnOffDevice ?? 'Unknown')
    }
  }).filter((row) => row.name)
}

export async function runAdminPowershell(script: string, timeoutMs: number): Promise<void> {
  if (process.platform !== 'win32') throw new Error('Administrator PowerShell is Windows-only')
  const elevated = await isElevated()
  if (elevated) {
    const result = await runCommand(
      systemBinary('powershell'),
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeoutMs }
    )
    if (result.code && result.code !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || 'PowerShell change failed')
    }
    return
  }
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  const launcher = `Start-Process -FilePath '${systemBinary('powershell').replaceAll("'", "''")}' -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand','${encoded}')`
  const result = await runCommand(
    systemBinary('powershell'),
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', launcher],
    { timeoutMs: timeoutMs + 60_000 }
  )
  if (result.code && result.code !== 0) {
    throw new Error(
      result.stderr.trim() ||
        result.stdout.trim() ||
        'Administrator approval was declined or the elevated command failed. Ordinary diagnostics stay unelevated.'
    )
  }
}

export async function setNicPower(name: string, value: 'Enabled' | 'Disabled'): Promise<void> {
  if (process.platform !== 'win32') throw new Error('NIC power changes are Windows-only')
  if (!/^[A-Za-z0-9 _()-]+$/.test(name)) throw new Error('Invalid adapter name')
  const script = `Set-NetAdapterPowerManagement -Name '${name.replaceAll("'", "''")}' -AllowComputerToTurnOffDevice ${value}`
  await runAdminPowershell(script, 15000)
}

const WATCH_PROCESSES = [
  { match: /^OneDrive$/i, reason: 'Cloud sync upload' },
  { match: /^steam/i, reason: 'Steam downloads' },
  { match: /^Discord$/i, reason: 'Discord overlay/clips' },
  { match: /^Dropbox$/i, reason: 'Cloud sync upload' },
  { match: /^GoogleDrive/i, reason: 'Cloud sync upload' },
  { match: /^EpicGamesLauncher$/i, reason: 'Epic downloads' },
  { match: /^Battle\.net$/i, reason: 'Blizzard downloads' },
  { match: /^GameBar/i, reason: 'Xbox Game Bar capture' },
  { match: /^Teams$/i, reason: 'Teams meetings/uploads' },
  { match: /^chrome$/i, reason: 'Browser download/upload' },
  { match: /^msedge$/i, reason: 'Browser download/upload' },
  { match: /^firefox$/i, reason: 'Browser download/upload' },
  { match: /^RiotClient/i, reason: 'Riot Client background' },
  { match: /^wgcs$/i, reason: 'WGCS / launcher traffic' },
  { match: /^MoUsoCoreWorker$/i, reason: 'Windows Update worker' }
]

export async function scanCongestion(): Promise<CongestionScan> {
  const platform = process.platform
  const notes = [
    'Process names are a hint only. Close them yourself; this app never kills tasks.',
    'Router SQM/QoS is configured on the WE gateway, not in Windows.'
  ]
  if (platform !== 'win32') {
    return {
      elevated: false,
      platform,
      processes: [],
      services: [],
      notes: [...notes, 'Background upload scan is Windows-only. Pause cloud apps manually on this machine.']
    }
  }
  const elevated = await isElevated()
  const procResult = await runCommand(
    systemBinary('powershell'),
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      'Get-Process | Select-Object ProcessName,Id | ConvertTo-Json -Compress'
    ],
    { timeoutMs: 12000 }
  )
  const processes: BackgroundProcessHit[] = []
  try {
    const parsed = JSON.parse(procResult.stdout.trim() || '[]') as unknown
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    for (const row of rows) {
      const record = row as Record<string, unknown>
      const name = String(record.ProcessName ?? '')
      const hit = WATCH_PROCESSES.find((item) => item.match.test(name))
      if (!hit) continue
      processes.push({
        name,
        pid: Number(record.Id ?? 0),
        reason: hit.reason,
        seenAt: Date.now(),
        evidence: 'Process was present during the congestion scan. This is not a measured byte rate and is not killed.'
      })
    }
  } catch {
    notes.push('Could not parse the process list.')
  }
  const svcResult = await runCommand(
    systemBinary('powershell'),
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      'Get-Service DoSvc,BITS,wuauserv -ErrorAction SilentlyContinue | Select-Object Name,Status | ConvertTo-Json -Compress'
    ],
    { timeoutMs: 10000 }
  )
  let services: CongestionScan['services'] = []
  try {
    const parsed = JSON.parse(svcResult.stdout.trim() || '[]') as unknown
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    services = rows.map((row) => {
      const record = row as Record<string, unknown>
      const name = String(record.Name ?? '')
      return {
        name,
        status: String(record.Status ?? 'Unknown'),
        reason: name === 'DoSvc' ? 'Delivery Optimization may upload/download in the background' : 'Windows Update / BITS transfer'
      }
    })
  } catch {
    services = []
  }
  return { elevated, platform, processes, services, notes }
}
