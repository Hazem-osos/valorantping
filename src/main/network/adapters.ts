import type { AdapterSample, NetworkAdapterInfo } from '../../shared/types'
import { readNetworkInfo } from './gateway'
import { delay } from './runCommand'

export class AdapterMonitor {
  private previous = new Map<string, { t: number; inBytes: number; outBytes: number }>()
  private abort: AbortController | null = null

  async snapshot(): Promise<NetworkAdapterInfo[]> {
    const info = await readNetworkInfo()
    return info.adapters
  }

  start(onSample: (sample: AdapterSample) => void): void {
    this.stop()
    this.abort = new AbortController()
    void this.loop(this.abort.signal, onSample)
  }

  stop(): void {
    this.abort?.abort()
    this.abort = null
    this.previous.clear()
  }

  private async loop(signal: AbortSignal, onSample: (sample: AdapterSample) => void): Promise<void> {
    while (!signal.aborted) {
      try {
        const adapters = await this.snapshot()
        const now = Date.now()
        for (const adapter of adapters) {
          const prev = this.previous.get(adapter.id)
          this.previous.set(adapter.id, {
            t: now,
            inBytes: adapter.bytesReceived,
            outBytes: adapter.bytesSent
          })
          if (!prev) continue
          const dt = Math.max(0.001, (now - prev.t) / 1000)
          onSample({
            t: now,
            adapterId: adapter.id,
            name: adapter.name,
            bytesInPerSec: Math.max(0, (adapter.bytesReceived - prev.inBytes) / dt),
            bytesOutPerSec: Math.max(0, (adapter.bytesSent - prev.outBytes) / dt),
            linkSpeedBps: adapter.linkSpeedBps
          })
        }
      } catch {
        // Keep the loop alive; a single poll failure is not fatal.
      }
      try {
        await delay(1000, signal)
      } catch {
        break
      }
    }
  }
}
