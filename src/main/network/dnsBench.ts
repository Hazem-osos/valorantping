import { Resolver } from 'node:dns/promises'
import { DNS_BENCHMARK_HOSTS, DNS_BENCHMARK_NAMES } from '../../shared/constants'
import { percentile } from '../../shared/metrics'
import type { DnsResolverResult } from '../../shared/types'

async function timeResolve(server: string, host: string): Promise<number | null> {
  const resolver = new Resolver()
  if (server !== 'system') resolver.setServers([server])
  const started = Date.now()
  try {
    await resolver.resolve4(host)
    return Date.now() - started
  } catch {
    try {
      await resolver.resolve6(host)
      return Date.now() - started
    } catch {
      return null
    }
  }
}

export async function benchmarkDns(): Promise<DnsResolverResult[]> {
  const results: DnsResolverResult[] = []
  for (const resolver of DNS_BENCHMARK_NAMES) {
    const samples: number[] = []
    let fail = 0
    for (const host of DNS_BENCHMARK_HOSTS) {
      const rtt = await timeResolve(resolver.server, host)
      if (rtt === null) fail += 1
      else samples.push(rtt)
    }
    const sorted = [...samples].sort((a, b) => a - b)
    results.push({
      name: resolver.name,
      server: resolver.server,
      ok: samples.length,
      fail,
      avgMs: samples.length ? Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length) : null,
      p95Ms: percentile(sorted, 95)
    })
  }
  return results
}
