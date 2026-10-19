import { describe, expect, it } from 'vitest'
import { classifyNicProperty, linkSpeedWarning, preferredAlternate } from '../src/shared/nicDetect'

describe('NIC feature detection', () => {
  it('classifies EEE, interrupt moderation, and speed keywords', () => {
    expect(classifyNicProperty('Energy Efficient Ethernet', '*EEE')).toBe('eee')
    expect(classifyNicProperty('Interrupt Moderation', '*InterruptModeration')).toBe('interrupt-moderation')
    expect(classifyNicProperty('Speed & Duplex', '*SpeedDuplex')).toBe('speed')
    expect(classifyNicProperty('Jumbo Packet', '*JumboPacket')).toBe('other')
  })

  it('prefers disabling EEE and toggling IM rather than inventing values', () => {
    expect(preferredAlternate('eee', 'Enabled', ['Enabled', 'Disabled'])).toBe('Disabled')
    expect(preferredAlternate('eee', 'Disabled', ['Enabled', 'Disabled'])).toBeNull()
    expect(preferredAlternate('interrupt-moderation', 'Enabled', ['Enabled', 'Disabled'])).toBe('Disabled')
  })

  it('warns on 100 Mbps links without forcing duplex', () => {
    expect(linkSpeedWarning(100_000_000)).toMatch(/Do not auto-force/)
    expect(linkSpeedWarning(1_000_000_000)).toBeNull()
  })
})
