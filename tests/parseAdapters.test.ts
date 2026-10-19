import { describe, expect, it } from 'vitest'
import {
  parseGatewayFromRouteGet,
  parseGatewayFromWindowsRoute,
  parseNetstatIb,
  parseWindowsAdapterJson
} from '../src/main/network/parseAdapters'

describe('adapter parsers', () => {
  it('reads macOS netstat -ib link rows', () => {
    const output = [
      'Name            Mtu   Network       Address            Ipkts Ierrs     Ibytes    Opkts Oerrs     Obytes  Coll',
      'lo0            16384 <Link#1>                           100     0      12345     100     0      12345     0',
      'en0             1500 <Link#14>    aa:bb:cc:dd:ee:ff    200     0   88888888     150     0    4444444     0'
    ].join('\n')
    const adapters = parseNetstatIb(output)
    expect(adapters.find((item) => item.name === 'en0')?.bytesReceived).toBe(88888888)
  })

  it('parses Windows adapter JSON and gateway tables', () => {
    const adapters = parseWindowsAdapterJson(
      JSON.stringify({
        Name: 'Ethernet',
        ReceivedBytes: 100,
        SentBytes: 50,
        LinkSpeed: '1 Gbps'
      })
    )
    expect(adapters[0]?.linkSpeedBps).toBe(1_000_000_000)
    expect(parseGatewayFromRouteGet('gateway: 192.168.1.1\ninterface: en0')).toEqual({
      gateway: '192.168.1.1',
      iface: 'en0'
    })
    expect(parseGatewayFromWindowsRoute('          0.0.0.0          0.0.0.0      192.168.1.1     192.168.1.20').gateway).toBe(
      '192.168.1.1'
    )
  })
})
