import { firstSustainedJumpHop } from '../../shared/metrics'
import type { TraceHop, TracerouteResult } from '../../shared/types'
import { hostSchema } from '../../shared/validation'
import { systemBinary } from './binaries'
import { parseTracerouteLine, parseTracerouteOutput } from './parseTraceroute'
import { runCommand } from './runCommand'

export async function runTraceroute(
  host: string,
  maxHops: number,
  timeoutMs: number,
  signal: AbortSignal,
  onHop?: (hop: TraceHop) => void
): Promise<TracerouteResult> {
  const safeHost = hostSchema.parse(host)
  const startedAt = Date.now()
  const hops: TraceHop[] = []
  const seen = new Set<number>()
  const command = process.platform === 'win32' ? systemBinary('tracert') : systemBinary('traceroute')
  const args =
    process.platform === 'win32'
      ? ['-d', '-h', String(maxHops), '-w', String(timeoutMs), safeHost]
      : ['-n', '-m', String(maxHops), '-q', '1', '-w', String(Math.max(1, Math.round(timeoutMs / 1000))), safeHost]

  const result = await runCommand(command, args, {
    timeoutMs: Math.min(90_000, maxHops * Math.max(timeoutMs, 1000) + 5000),
    signal,
    onStdoutLine: (line) => {
      const hop = parseTracerouteLine(line)
      if (!hop || seen.has(hop.hop)) return
      seen.add(hop.hop)
      hops.push(hop)
      onHop?.(hop)
    }
  })

  if (hops.length === 0) {
    hops.push(...parseTracerouteOutput(result.stdout))
  }

  return {
    host: safeHost,
    startedAt,
    endedAt: Date.now(),
    hops: hops.sort((a, b) => a.hop - b.hop),
    firstSustainedJumpHop: firstSustainedJumpHop(hops),
    cancelled: result.cancelled || signal.aborted,
    error: result.cancelled ? 'cancelled' : undefined
  }
}
