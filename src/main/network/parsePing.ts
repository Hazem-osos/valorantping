export interface ParsedPing {
  rttMs: number | null
  timedOut: boolean
  error?: string
}

function parseTimeToken(raw: string): number {
  const normalized = raw.replace(',', '.')
  const value = Number.parseFloat(normalized)
  return Number.isFinite(value) ? value : Number.NaN
}

export function parsePingOutput(output: string): ParsedPing {
  const text = output.replaceAll('\0', '')

  if (/time\s*<\s*1\s*ms/i.test(text)) {
    return { rttMs: 0.5, timedOut: false }
  }

  const timeMatch = text.match(/time[=<]\s*([\d.,]+)\s*ms/i)
  if (timeMatch) {
    const rttMs = parseTimeToken(timeMatch[1])
    if (Number.isFinite(rttMs)) return { rttMs, timedOut: false }
  }

  const unixMatch = text.match(/\btime[= ]\s*([\d.,]+)\s*ms\b/i)
  if (unixMatch) {
    const rttMs = parseTimeToken(unixMatch[1])
    if (Number.isFinite(rttMs)) return { rttMs, timedOut: false }
  }

  if (/packet needs to be fragmented|frag needed|message too long|df set/i.test(text)) {
    return { rttMs: null, timedOut: true, error: 'fragmentation required' }
  }

  if (
    /request timed out/i.test(text) ||
    /request timeout/i.test(text) ||
    /100%\s*packet loss/i.test(text) ||
    /destination host unreachable/i.test(text) ||
    /general failure/i.test(text) ||
    /transmit failed/i.test(text)
  ) {
    return { rttMs: null, timedOut: true }
  }

  if (!text.trim()) {
    return { rttMs: null, timedOut: true, error: 'empty ping output' }
  }

  return { rttMs: null, timedOut: true, error: 'unrecognized ping output' }
}
