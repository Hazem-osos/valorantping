import type { ProbeSample, ValorantSample, WindowMetrics } from './types'

export function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  if (p <= 0) return sorted[0]
  if (p >= 100) return sorted[sorted.length - 1]
  const index = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(index)
  const hi = Math.ceil(index)
  if (lo === hi) return sorted[lo]
  const weight = index - lo
  return sorted[lo] * (1 - weight) + sorted[hi] * weight
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function stdev(values: number[]): number | null {
  if (values.length < 2) return null
  const avg = mean(values)
  if (avg === null) return null
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

export function meanSuccessiveJitter(values: number[]): number | null {
  if (values.length < 2) return null
  let sum = 0
  for (let i = 1; i < values.length; i += 1) {
    sum += Math.abs(values[i] - values[i - 1])
  }
  return sum / (values.length - 1)
}

export function countSpikes(values: number[], spikeThresholdMs: number): number {
  if (values.length === 0) return 0
  const median = percentile([...values].sort((a, b) => a - b), 50) ?? spikeThresholdMs
  const cutoff = Math.max(spikeThresholdMs, median * 2)
  return values.filter((value) => value >= cutoff).length
}

export function summarizeRtts(
  rtts: Array<number | null>,
  timeoutCount: number,
  spikeThresholdMs: number
): WindowMetrics {
  const values = rtts.filter((value): value is number => value !== null && Number.isFinite(value))
  const sampleCount = values.length + timeoutCount
  const sorted = [...values].sort((a, b) => a - b)
  return {
    sampleCount,
    timeoutCount,
    lossPct: sampleCount === 0 ? 0 : (timeoutCount / sampleCount) * 100,
    minMs: sorted.length ? round1(sorted[0]) : null,
    maxMs: sorted.length ? round1(sorted[sorted.length - 1]) : null,
    avgMs: mean(values) === null ? null : round1(mean(values) as number),
    p50Ms: percentile(sorted, 50) === null ? null : round1(percentile(sorted, 50) as number),
    p95Ms: percentile(sorted, 95) === null ? null : round1(percentile(sorted, 95) as number),
    p99Ms: percentile(sorted, 99) === null ? null : round1(percentile(sorted, 99) as number),
    stdevMs: stdev(values) === null ? null : round1(stdev(values) as number),
    jitterMs:
      meanSuccessiveJitter(values) === null ? null : round1(meanSuccessiveJitter(values) as number),
    spikeCount: countSpikes(values, spikeThresholdMs),
    lastMs: values.length ? round1(values[values.length - 1]) : null
  }
}

export function summarizeSamples(
  samples: Pick<ProbeSample, 'rttMs' | 'timedOut'>[],
  spikeThresholdMs: number
): WindowMetrics {
  return summarizeRtts(
    samples.map((sample) => sample.rttMs),
    samples.filter((sample) => sample.timedOut || sample.rttMs === null).length,
    spikeThresholdMs
  )
}

export function summarizeValorant(
  samples: ValorantSample[],
  spikeThresholdMs: number
): WindowMetrics | null {
  if (samples.length === 0) return null
  return summarizeRtts(
    samples.map((sample) => sample.rttMs),
    0,
    spikeThresholdMs
  )
}

export function downsample(
  samples: Array<{ t: number; rttMs: number | null; timedOut?: boolean }>,
  bucketMs: number
): Array<{ t: number; avgMs: number | null; minMs: number | null; maxMs: number | null; lossPct: number }> {
  if (samples.length === 0 || bucketMs <= 0) return []
  const buckets = new Map<number, { rtts: number[]; timeouts: number; t: number }>()
  for (const sample of samples) {
    const key = Math.floor(sample.t / bucketMs) * bucketMs
    const bucket = buckets.get(key) ?? { rtts: [], timeouts: 0, t: key }
    if (sample.rttMs === null || sample.timedOut) bucket.timeouts += 1
    else bucket.rtts.push(sample.rttMs)
    buckets.set(key, bucket)
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, bucket]) => {
      const count = bucket.rtts.length + bucket.timeouts
      return {
        t: bucket.t,
        avgMs: mean(bucket.rtts) === null ? null : round1(mean(bucket.rtts) as number),
        minMs: bucket.rtts.length ? round1(Math.min(...bucket.rtts)) : null,
        maxMs: bucket.rtts.length ? round1(Math.max(...bucket.rtts)) : null,
        lossPct: count === 0 ? 0 : (bucket.timeouts / count) * 100
      }
    })
}

export function firstSustainedJumpHop(
  hops: Array<{ hop: number; rttsMs: Array<number | null> }>,
  jumpMs = 20
): number | null {
  const averages = hops
    .map((hop) => {
      const values = hop.rttsMs.filter((value): value is number => value !== null)
      return { hop: hop.hop, avg: mean(values) }
    })
    .filter((hop) => hop.avg !== null) as Array<{ hop: number; avg: number }>
  for (let i = 1; i < averages.length; i += 1) {
    if (averages[i].avg - averages[i - 1].avg >= jumpMs) {
      return averages[i].hop
    }
  }
  return null
}
