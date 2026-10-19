import { describe, expect, it } from 'vitest'
import { parsePingOutput } from '../src/main/network/parsePing'

describe('parsePingOutput', () => {
  it('parses Windows replies including sub-millisecond', () => {
    expect(parsePingOutput('Reply from 192.168.1.1: bytes=32 time=12ms TTL=64').rttMs).toBe(12)
    expect(parsePingOutput('Reply from 192.168.1.1: bytes=32 time<1ms TTL=64').rttMs).toBe(0.5)
  })

  it('parses macOS and Linux replies', () => {
    expect(parsePingOutput('64 bytes from 8.8.8.8: icmp_seq=0 ttl=117 time=21.413 ms').rttMs).toBeCloseTo(21.413)
    expect(parsePingOutput('64 bytes from 1.1.1.1: icmp_seq=1 ttl=56 time=36,2 ms').rttMs).toBeCloseTo(36.2)
  })

  it('marks timeouts without fabricating an RTT', () => {
    expect(parsePingOutput('Request timed out.')).toEqual({ rttMs: null, timedOut: true })
    expect(parsePingOutput('Request timeout for icmp_seq 0').timedOut).toBe(true)
    expect(parsePingOutput('100% packet loss').rttMs).toBeNull()
  })
})
