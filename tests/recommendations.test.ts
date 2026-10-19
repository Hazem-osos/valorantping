import { describe, expect, it } from 'vitest'
import { assertNoAutomaticChanges, recommendationsFor, RECOMMENDATION_CATALOG } from '../src/shared/recommendations'
import type { Diagnosis } from '../src/shared/types'

describe('recommendations', () => {
  it('never marks advice as automatic', () => {
    expect(() => assertNoAutomaticChanges(RECOMMENDATION_CATALOG)).not.toThrow()
    expect(RECOMMENDATION_CATALOG.every((item) => item.automatic === false)).toBe(true)
    expect(RECOMMENDATION_CATALOG.some((item) => /vpn/i.test(item.body))).toBe(true)
    expect(RECOMMENDATION_CATALOG.every((item) => !/install a vpn|use a vpn/i.test(item.body))).toBe(true)
  })

  it('returns path-floor advice for healthy windows', () => {
    const diagnosis: Diagnosis = {
      scope: 'healthy',
      confidence: 0.6,
      summary: 'quiet',
      findings: [
        {
          id: 'path_floor',
          scope: 'context',
          severity: 'info',
          title: 'floor',
          evidence: 'min 34ms'
        }
      ],
      cannotConclude: []
    }
    const ids = recommendationsFor(diagnosis).map((item) => item.id)
    expect(ids).toContain('do-not-chase-floor')
    expect(ids).toContain('record-game')
  })
})
