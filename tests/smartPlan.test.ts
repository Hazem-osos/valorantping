import { describe, expect, it } from 'vitest'
import { classifyBottleneck } from '../src/shared/classifier'
import { evaluateAction, OPTIMIZE_ACTIONS } from '../src/shared/optimization'
import { planSmartOptimize } from '../src/shared/smartPlan'
import { coincidence, diagnosis, metrics } from './helpers'

describe('Smart Optimize gating', () => {
  it('refuses to plan Windows changes without a baseline', () => {
    const classifier = classifyBottleneck({
      gateway: metrics({ p95Ms: 30, jitterMs: 12, spikeCount: 4, sampleCount: 40 }),
      isp: null,
      publicNet: metrics({ p95Ms: 80, spikeCount: 3 }),
      regional: metrics({ p95Ms: 80, spikeCount: 3 }),
      coincidence: coincidence(),
      valorant: null,
      linkSpeedBps: 1_000_000_000,
      nicMayPowerOff: true,
      sampleCount: 40
    })
    expect(planSmartOptimize(classifier, false)).toEqual([])
  })

  it('only proposes path-honesty when the problem is unfixable locally', () => {
    const classifier = classifyBottleneck({
      gateway: metrics({ p95Ms: 1.1, jitterMs: 0.2, sampleCount: 40 }),
      isp: metrics({ p95Ms: 160, spikeCount: 8, jitterMs: 20 }),
      publicNet: metrics({ p95Ms: 170, spikeCount: 8, jitterMs: 22 }),
      regional: metrics({ p95Ms: 180, minMs: 34, spikeCount: 8, jitterMs: 25 }),
      coincidence: coincidence({ spikeCount: 8, spikeWithHighUploadPct: 10 }),
      valorant: null,
      linkSpeedBps: 1_000_000_000,
      nicMayPowerOff: false,
      sampleCount: 40
    })
    const plan = planSmartOptimize(classifier, true)
    expect(plan.map((item) => item.id)).toEqual(['isp-or-riot-path'])
  })

  it('blocks apply when hasBaseline is explicitly false', () => {
    const power = OPTIMIZE_ACTIONS.find((item) => item.id === 'power-plan-high-performance')!
    const result = evaluateAction(power, {
      platform: 'win32',
      elevated: false,
      userConfirmed: true,
      diagnosis: diagnosis('local', ['local_gateway_instability']),
      hasBaseline: false
    })
    expect(result.allowed).toBe(false)
    expect(result.reasons.some((reason) => /Baseline Session/i.test(reason))).toBe(true)
  })
})
