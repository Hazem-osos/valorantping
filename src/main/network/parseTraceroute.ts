import type { TraceHop } from '../../shared/types'

function parseMs(token: string): number | null {
  if (token === '*' || /timeout/i.test(token)) return null
  if (/<\s*1/i.test(token)) return 0.5
  const match = token.replace(',', '.').match(/([\d.]+)/)
  if (!match) return null
  const value = Number.parseFloat(match[1])
  return Number.isFinite(value) ? value : null
}

export function parseTracerouteLine(line: string): TraceHop | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  if (/^trac(?:ing|eroute)|over a maximum|to\s+/i.test(trimmed) && !/^\d+/.test(trimmed)) {
    return null
  }

  const hopMatch = trimmed.match(/^(\d+)\s+(.*)$/)
  if (!hopMatch) return null
  const hop = Number.parseInt(hopMatch[1], 10)
  const rest = hopMatch[2].trim()
  if (/request timed out/i.test(rest) || /^\*\s+\*\s+\*/.test(rest) || rest === '* * *') {
    return { hop, host: null, rttsMs: [null, null, null], timedOut: true, raw: trimmed }
  }

  const rtts: Array<number | null> = []
  const msTokens = rest.match(/<\s*1\s*ms|[\d.,]+\s*ms|\*/gi) ?? []
  for (const token of msTokens) {
    rtts.push(token.trim() === '*' ? null : parseMs(token))
  }

  let host: string | null = null
  const ipMatch = rest.match(/(\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F:]{3,})/)
  if (ipMatch && !/^\d+ms$/i.test(ipMatch[1])) host = ipMatch[1]
  if (!host) {
    const nameMatch = rest.match(/([a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/)
    host = nameMatch?.[1] ?? null
  }

  if (rtts.length === 0 && !host) return null
  const timedOut = rtts.length === 0 || rtts.every((value) => value === null)
  return { hop, host, rttsMs: rtts.length ? rtts : [null], timedOut, raw: trimmed }
}

export function parseTracerouteOutput(output: string): TraceHop[] {
  const hops: TraceHop[] = []
  for (const line of output.split(/\r?\n/)) {
    const hop = parseTracerouteLine(line)
    if (hop) hops.push(hop)
  }
  hops.sort((a, b) => a.hop - b.hop)
  const unique: TraceHop[] = []
  for (const hop of hops) {
    const existing = unique.find((item) => item.hop === hop.hop)
    if (existing) {
      if (!existing.host && hop.host) existing.host = hop.host
      existing.rttsMs = hop.rttsMs.length >= existing.rttsMs.length ? hop.rttsMs : existing.rttsMs
      existing.timedOut = hop.timedOut && existing.timedOut
    } else {
      unique.push({ ...hop })
    }
  }
  return unique
}
