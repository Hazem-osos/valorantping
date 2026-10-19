import { createConnection } from 'node:net'
import { performance } from 'node:perf_hooks'

export function tcpConnectRtt(
  host: string,
  port: number,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<{ rttMs: number | null; timedOut: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve({ rttMs: null, timedOut: true, error: 'cancelled' })
      return
    }
    const started = performance.now()
    const socket = createConnection({ host, port })
    let settled = false

    const finish = (result: { rttMs: number | null; timedOut: boolean; error?: string }): void => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      socket.destroy()
      resolve(result)
    }

    const onAbort = (): void => finish({ rttMs: null, timedOut: true, error: 'cancelled' })
    signal?.addEventListener('abort', onAbort, { once: true })
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => {
      finish({ rttMs: performance.now() - started, timedOut: false })
    })
    socket.once('timeout', () => finish({ rttMs: null, timedOut: true }))
    socket.once('error', (error) =>
      finish({ rttMs: null, timedOut: true, error: error.message })
    )
  })
}
