import type { BufferbloatGrade, BufferbloatResult } from './types'

export function gradeBufferbloat(deltaMs: number | null, lossPct: number): BufferbloatGrade {
  if (deltaMs === null) return 'Moderate'
  if (lossPct >= 5 || deltaMs >= 150) return 'Severe'
  if (deltaMs >= 50) return 'Poor'
  if (deltaMs >= 20) return 'Moderate'
  if (deltaMs >= 5) return 'Good'
  return 'Excellent'
}

export function buildBufferbloatResult(input: {
  idleP50: number | null
  loadedDownP50: number | null
  loadedUpP50: number | null
  loadedP95: number | null
  jitterMs: number | null
  lossPct: number
  cancelled: boolean
}): BufferbloatResult {
  const deltaDownMs =
    input.idleP50 !== null && input.loadedDownP50 !== null ? input.loadedDownP50 - input.idleP50 : null
  const deltaUpMs =
    input.idleP50 !== null && input.loadedUpP50 !== null ? input.loadedUpP50 - input.idleP50 : null
  const worst = Math.max(deltaDownMs ?? 0, deltaUpMs ?? 0)
  const grade = input.cancelled ? 'Moderate' : gradeBufferbloat(deltaDownMs === null && deltaUpMs === null ? null : worst, input.lossPct)
  const severe = grade === 'Poor' || grade === 'Severe'
  return {
    ...input,
    deltaDownMs,
    deltaUpMs,
    grade,
    note: severe
      ? 'The best fix may be SQM/QoS on the router rather than a Windows tweak. This app cannot implement CAKE or FQ-CoDel on the WE gateway.'
      : 'SQM mainly cuts latency under load. It generally does not shrink the Egypt–Riyadh path floor.'
  }
}
