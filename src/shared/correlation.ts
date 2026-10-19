import type { CoincidenceStats } from './types'
import { percentile } from './metrics'

export function pearson(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 3) return null
  const n = x.length
  const meanX = x.reduce((sum, value) => sum + value, 0) / n
  const meanY = y.reduce((sum, value) => sum + value, 0) / n
  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < n; i += 1) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  if (denX === 0 || denY === 0) return null
  return num / Math.sqrt(denX * denY)
}

export function bucketByTime<T extends { t: number }>(
  items: T[],
  bucketMs: number
): Map<number, T[]> {
  const buckets = new Map<number, T[]>()
  for (const item of items) {
    const key = Math.floor(item.t / bucketMs) * bucketMs
    const list = buckets.get(key) ?? []
    list.push(item)
    buckets.set(key, list)
  }
  return buckets
}

export function correlateLatencyAndUpload(input: {
  rtts: Array<{ t: number; rttMs: number | null }>
  uploads: Array<{ t: number; bytesOutPerSec: number }>
  spikeThresholdMs: number
  bucketMs?: number
}): CoincidenceStats {
  const bucketMs = input.bucketMs ?? 1000
  const rttBuckets = bucketByTime(input.rtts, bucketMs)
  const upBuckets = bucketByTime(input.uploads, bucketMs)
  const keys = [...rttBuckets.keys()].filter((key) => upBuckets.has(key)).sort((a, b) => a - b)

  const rttSeries: number[] = []
  const upSeries: number[] = []
  const spikeFlags: boolean[] = []

  for (const key of keys) {
    const rttValues = (rttBuckets.get(key) ?? [])
      .map((item) => item.rttMs)
      .filter((value): value is number => value !== null)
    const upValues = (upBuckets.get(key) ?? []).map((item) => item.bytesOutPerSec)
    if (rttValues.length === 0 || upValues.length === 0) continue
    const rttAvg = rttValues.reduce((sum, value) => sum + value, 0) / rttValues.length
    const upAvg = upValues.reduce((sum, value) => sum + value, 0) / upValues.length
    rttSeries.push(rttAvg)
    upSeries.push(upAvg)
    spikeFlags.push(rttAvg >= input.spikeThresholdMs)
  }

  const uploadCutoff = percentile([...upSeries].sort((a, b) => a - b), 70) ?? 0
  let spikesWithHighUpload = 0
  let spikeCount = 0
  for (let i = 0; i < spikeFlags.length; i += 1) {
    if (!spikeFlags[i]) continue
    spikeCount += 1
    if (upSeries[i] >= uploadCutoff && uploadCutoff > 0) spikesWithHighUpload += 1
  }

  return {
    sampleCount: rttSeries.length,
    spikeCount,
    spikesWithHighUpload,
    spikeWithHighUploadPct: spikeCount === 0 ? null : (spikesWithHighUpload / spikeCount) * 100,
    pearsonRttUpload: pearson(rttSeries, upSeries)
  }
}

export function alignSeries(
  left: Array<{ t: number; value: number | null }>,
  right: Array<{ t: number; value: number | null }>,
  bucketMs = 1000
): Array<{ t: number; left: number | null; right: number | null }> {
  const keys = new Set<number>()
  for (const item of left) keys.add(Math.floor(item.t / bucketMs) * bucketMs)
  for (const item of right) keys.add(Math.floor(item.t / bucketMs) * bucketMs)
  const leftMap = bucketByTime(left, bucketMs)
  const rightMap = bucketByTime(right, bucketMs)
  return [...keys]
    .sort((a, b) => a - b)
    .map((t) => {
      const l = (leftMap.get(t) ?? [])
        .map((item) => item.value)
        .filter((value): value is number => value !== null)
      const r = (rightMap.get(t) ?? [])
        .map((item) => item.value)
        .filter((value): value is number => value !== null)
      return {
        t,
        left: l.length ? l.reduce((sum, value) => sum + value, 0) / l.length : null,
        right: r.length ? r.reduce((sum, value) => sum + value, 0) / r.length : null
      }
    })
}
