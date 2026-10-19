import { describe, expect, it } from 'vitest'
import { parseTracerouteLine, parseTracerouteOutput } from '../src/main/network/parseTraceroute'

describe('traceroute parser', () => {
  it('parses Windows hops and timeouts', () => {
    const hop = parseTracerouteLine('  1    <1 ms    <1 ms    <1 ms  192.168.1.1')
    expect(hop?.host).toBe('192.168.1.1')
    expect(hop?.rttsMs[0]).toBe(0.5)
    const timeout = parseTracerouteLine('  2     *        *        *     Request timed out.')
    expect(timeout?.timedOut).toBe(true)
  })

  it('parses Unix traceroute', () => {
    const hop = parseTracerouteLine(' 3  10.40.0.1  12.1 ms  11.8 ms  12.0 ms')
    expect(hop?.hop).toBe(3)
    expect(hop?.rttsMs).toEqual([12.1, 11.8, 12.0])
  })

  it('ignores headers', () => {
    expect(parseTracerouteLine('Tracing route to 1.1.1.1 over a maximum of 30 hops')).toBeNull()
    const hops = parseTracerouteOutput(
      ['Tracing route to 1.1.1.1', '  1    1 ms    1 ms    1 ms  192.168.1.1', '  2    9 ms    9 ms    8 ms  10.0.0.1'].join(
        '\n'
      )
    )
    expect(hops).toHaveLength(2)
  })
})
