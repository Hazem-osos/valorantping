import { describe, expect, it } from 'vitest'
import { hostSchema, probeStartSchema, tracerouteInputSchema } from '../src/shared/validation'

describe('validation', () => {
  it('accepts IPs and hostnames', () => {
    expect(hostSchema.parse('163.121.128.134')).toBe('163.121.128.134')
    expect(hostSchema.parse('dynamodb.me-south-1.amazonaws.com')).toBe(
      'dynamodb.me-south-1.amazonaws.com'
    )
  })

  it('rejects command injection in hosts', () => {
    expect(() => hostSchema.parse('1.1.1.1; calc.exe')).toThrow()
    expect(() => hostSchema.parse('8.8.8.8 | rm -rf /')).toThrow()
    expect(() => hostSchema.parse('$(reboot)')).toThrow()
  })

  it('requires a port on TCP targets and caps target count', () => {
    expect(() =>
      probeStartSchema.parse({
        intervalMs: 1000,
        timeoutMs: 1500,
        spikeThresholdMs: 100,
        includeGateway: true,
        targets: [{ id: 'x', label: 'x', host: '1.1.1.1', kind: 'public', protocol: 'tcp' }]
      })
    ).toThrow()

    const targets = Array.from({ length: 9 }, (_, index) => ({
      id: `t${index}`,
      label: `t${index}`,
      host: '1.1.1.1',
      kind: 'public' as const,
      protocol: 'icmp' as const
    }))
    expect(() =>
      probeStartSchema.parse({
        intervalMs: 1000,
        timeoutMs: 1500,
        spikeThresholdMs: 100,
        includeGateway: true,
        targets
      })
    ).toThrow()
  })

  it('bounds traceroute hops', () => {
    expect(() => tracerouteInputSchema.parse({ host: '1.1.1.1', maxHops: 99, timeoutMs: 1000 })).toThrow()
    expect(tracerouteInputSchema.parse({ host: '1.1.1.1', maxHops: 20, timeoutMs: 1000 }).maxHops).toBe(20)
  })
})
