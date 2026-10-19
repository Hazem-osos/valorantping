import { existsSync } from 'node:fs'
import { join } from 'node:path'

function win32System(relative: string): string {
  const root = process.env.SystemRoot || 'C:\\Windows'
  return join(root, relative)
}

const UNIX_CANDIDATES: Record<string, string[]> = {
  ping: ['/sbin/ping', '/usr/bin/ping', '/bin/ping'],
  traceroute: ['/usr/sbin/traceroute', '/usr/bin/traceroute'],
  route: ['/sbin/route', '/usr/sbin/route'],
  netstat: ['/usr/sbin/netstat', '/bin/netstat', '/usr/bin/netstat'],
  ip: ['/usr/sbin/ip', '/sbin/ip', '/usr/bin/ip']
}

export function systemBinary(name: string): string {
  if (process.platform === 'win32') {
    const map: Record<string, string> = {
      ping: win32System('System32/ping.exe'),
      tracert: win32System('System32/tracert.exe'),
      route: win32System('System32/route.exe'),
      netstat: win32System('System32/netstat.exe'),
      powershell: win32System('System32/WindowsPowerShell/v1.0/powershell.exe'),
      ipconfig: win32System('System32/ipconfig.exe'),
      powercfg: win32System('System32/powercfg.exe')
    }
    return map[name] ?? name
  }
  for (const candidate of UNIX_CANDIDATES[name] ?? []) {
    if (existsSync(candidate)) return candidate
  }
  return name
}
