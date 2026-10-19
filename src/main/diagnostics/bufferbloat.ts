import { BUFFERBLOAT_IDLE_MS, BUFFERBLOAT_LOAD_MS, BUFFERBLOAT_MAX_BYTES } from '../../shared/constants'
import { buildBufferbloatResult } from '../../shared/bufferbloat'
import { summarizeRtts } from '../../shared/metrics'
import type { BufferbloatResult } from '../../shared/types'
import { icmpPing } from '../network/ping'
import { readNetworkInfo } from '../network/gateway'

const DOWN_URL = 'https://speed.cloudflare.com/__down?bytes=5000000'
const UP_URL = 'https://speed.cloudflare.com/__up'

export class BufferbloatRunner {
  private abort: AbortController | null = null

  async run(onPhase: (phase: string) => void): Promise<BufferbloatResult> {
    this.abort?.abort()
    this.abort = new AbortController()
    const signal = this.abort.signal
    const info = await readNetworkInfo()
    const host = info.gateway ?? '1.1.1.1'
    try {
      onPhase('idle')
      const idle = await this.probeWindow(host, BUFFERBLOAT_IDLE_MS, signal)
      onPhase('download')
      const loadedDown = await this.withLoad(host, 'down', signal)
      onPhase('upload')
      const loadedUp = await this.withLoad(host, 'up', signal)
      const loadedRtts = [...loadedDown, ...loadedUp]
      const loaded = summarizeRtts(loadedRtts, loadedRtts.filter((value) => value === null).length, 100)
      const idleM = summarizeRtts(idle, idle.filter((value) => value === null).length, 100)
      const downM = summarizeRtts(loadedDown, loadedDown.filter((v) => v === null).length, 100)
      const upM = summarizeRtts(loadedUp, loadedUp.filter((v) => v === null).length, 100)
      return buildBufferbloatResult({
        idleP50: idleM.p50Ms,
        loadedDownP50: downM.p50Ms,
        loadedUpP50: upM.p50Ms,
        loadedP95: loaded.p95Ms,
        jitterMs: loaded.jitterMs,
        lossPct: loaded.lossPct,
        cancelled: false
      })
    } catch (error) {
      const cancelled = signal.aborted || (error instanceof Error && error.message === 'aborted')
      return buildBufferbloatResult({
        idleP50: null,
        loadedDownP50: null,
        loadedUpP50: null,
        loadedP95: null,
        jitterMs: null,
        lossPct: 0,
        cancelled
      })
    } finally {
      this.abort = null
    }
  }

  cancel(): void {
    this.abort?.abort()
  }

  private async probeWindow(host: string, durationMs: number, signal: AbortSignal): Promise<Array<number | null>> {
    const samples: Array<number | null> = []
    const ends = Date.now() + durationMs
    while (Date.now() < ends && !signal.aborted) {
      const result = await icmpPing(host, 1200, signal)
      samples.push(result.timedOut ? null : result.rttMs)
    }
    return samples
  }

  private async withLoad(host: string, direction: 'down' | 'up', signal: AbortSignal): Promise<Array<number | null>> {
    const load = direction === 'down' ? this.download(signal) : this.upload(signal)
    const probes = this.probeWindow(host, BUFFERBLOAT_LOAD_MS, signal)
    const [rtts] = await Promise.all([probes, load])
    return rtts
  }

  private async download(signal: AbortSignal): Promise<void> {
    const res = await fetch(DOWN_URL, { signal })
    if (!res.body) return
    const reader = res.body.getReader()
    let bytes = 0
    const deadline = Date.now() + BUFFERBLOAT_LOAD_MS
    while (bytes < BUFFERBLOAT_MAX_BYTES && Date.now() < deadline && !signal.aborted) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
    }
    await reader.cancel()
  }

  private async upload(signal: AbortSignal): Promise<void> {
    const body = new Uint8Array(Math.min(2_000_000, BUFFERBLOAT_MAX_BYTES))
    await fetch(UP_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.any([signal, AbortSignal.timeout(BUFFERBLOAT_LOAD_MS)])
    }).catch(() => undefined)
  }
}
