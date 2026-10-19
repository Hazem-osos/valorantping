export function classifyNicProperty(displayName: string, keyword: string): 'eee' | 'interrupt-moderation' | 'speed' | 'other' {
  const text = `${displayName} ${keyword}`.toLowerCase()
  if (/energy[- ]?efficient|green ethernet|\beee\b|\*eee/.test(text)) return 'eee'
  if (/interrupt\s*moderation|\*interruptmoderation/.test(text)) return 'interrupt-moderation'
  if (/speed.*duplex|link\s*speed|\*speedduplex/.test(text)) return 'speed'
  return 'other'
}

export function preferredAlternate(kind: 'eee' | 'interrupt-moderation', current: string, valid: string[]): string | null {
  const lower = current.toLowerCase()
  if (kind === 'eee') {
    const disabled = valid.find((value) => /disable|off|false/i.test(value))
    if (disabled && !/disable|off/i.test(lower)) return disabled
    return null
  }
  const disabled = valid.find((value) => /^disable/i.test(value) || /off/i.test(value))
  const enabled = valid.find((value) => /^enable/i.test(value) || /on/i.test(value))
  if (/enable|on/i.test(lower)) return disabled ?? null
  if (/disable|off/i.test(lower)) return enabled ?? null
  return disabled ?? null
}

export function linkSpeedWarning(bitsPerSec: number | null): string | null {
  if (bitsPerSec === null || bitsPerSec <= 0) return null
  if (bitsPerSec < 900_000_000) {
    return `Link is ${(bitsPerSec / 1_000_000).toFixed(0)} Mbps. Gigabit Ethernet was expected. Do not auto-force speed/duplex; check cable, port, and NIC status.`
  }
  return null
}
