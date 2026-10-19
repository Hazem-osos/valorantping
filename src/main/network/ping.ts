import { hostSchema } from '../../shared/validation'
import { systemBinary } from './binaries'
import { parsePingOutput } from './parsePing'
import { runCommand } from './runCommand'

function pingArgs(host: string, timeoutMs: number, dfPayload?: number): string[] {
  if (process.platform === 'win32') {
    return dfPayload !== undefined
      ? ['-n', '1', '-w', String(timeoutMs), '-l', String(dfPayload), '-f', host]
      : ['-n', '1', '-w', String(timeoutMs), host]
  }
  if (process.platform === 'darwin') {
    return dfPayload !== undefined
      ? ['-c', '1', '-W', String(timeoutMs), '-D', '-s', String(dfPayload), host]
      : ['-c', '1', '-W', String(timeoutMs), host]
  }
  return dfPayload !== undefined
    ? ['-c', '1', '-M', 'do', '-s', String(dfPayload), '-W', String(Math.max(1, Math.ceil(timeoutMs / 1000))), host]
    : ['-c', '1', '-W', String(Math.max(1, Math.ceil(timeoutMs / 1000))), host]
}

export async function icmpPing(
  host: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<{ rttMs: number | null; timedOut: boolean; error?: string }> {
  return icmpPingInner(host, timeoutMs, signal)
}

export async function icmpPingDf(
  host: string,
  payload: number,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<{ rttMs: number | null; timedOut: boolean; error?: string }> {
  if (!Number.isInteger(payload) || payload < 0 || payload > 65500) {
    return { rttMs: null, timedOut: true, error: 'invalid payload' }
  }
  return icmpPingInner(host, timeoutMs, signal, payload)
}

async function icmpPingInner(
  host: string,
  timeoutMs: number,
  signal?: AbortSignal,
  dfPayload?: number
): Promise<{ rttMs: number | null; timedOut: boolean; error?: string }> {
  const safeHost = hostSchema.parse(host)
  const ping = systemBinary('ping')
  const args = pingArgs(safeHost, timeoutMs, dfPayload)

  try {
    const result = await runCommand(ping, args, {
      timeoutMs: timeoutMs + 1000,
      signal
    })
    if (result.cancelled) return { rttMs: null, timedOut: true, error: 'cancelled' }
    return parsePingOutput(`${result.stdout}\n${result.stderr}`)
  } catch (error) {
    return {
      rttMs: null,
      timedOut: true,
      error: error instanceof Error ? error.message : 'ping failed'
    }
  }
}
