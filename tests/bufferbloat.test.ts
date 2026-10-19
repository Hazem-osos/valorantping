import { describe, expect, it } from 'vitest'
import { buildBufferbloatResult, gradeBufferbloat } from '../src/shared/bufferbloat'

describe('bufferbloat classification', () => {
  it('grades idle-to-load deltas', () => {
    expect(gradeBufferbloat(3, 0)).toBe('Excellent')
    expect(gradeBufferbloat(12, 0)).toBe('Good')
    expect(gradeBufferbloat(30, 0)).toBe('Moderate')
    expect(gradeBufferbloat(80, 0)).toBe('Poor')
    expect(gradeBufferbloat(200, 0)).toBe('Severe')
  })

  it('recommends router SQM when severe and never claims Windows CAKE', () => {
    const result = buildBufferbloatResult({
      idleP50: 8,
      loadedDownP50: 20,
      loadedUpP50: 180,
      loadedP95: 220,
      jitterMs: 40,
      lossPct: 1,
      cancelled: false
    })
    expect(result.grade).toBe('Severe')
    expect(result.deltaUpMs).toBe(172)
    expect(result.note).toMatch(/SQM\/QoS on the router/)
    expect(result.note).not.toMatch(/Windows can implement CAKE/)
  })

  it('marks cancelled runs without inventing a win', () => {
    const result = buildBufferbloatResult({
      idleP50: null,
      loadedDownP50: null,
      loadedUpP50: null,
      loadedP95: null,
      jitterMs: null,
      lossPct: 0,
      cancelled: true
    })
    expect(result.cancelled).toBe(true)
    expect(result.grade).toBe('Moderate')
  })
})
