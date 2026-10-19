import { describe, expect, it } from 'vitest'
import { assertApplySafe, evaluateAction, FORBIDDEN_APPLY_IDS, nicRestoreValue, offersFor, OPTIMIZE_ACTIONS } from '../src/shared/optimization'
import type { Diagnosis } from '../src/shared/types'

function diagnosis(scope: Diagnosis['scope'], findingIds: string[]): Diagnosis {
  return {
    scope,
    confidence: 0.7,
    summary: 'test',
    findings: findingIds.map((id) => ({
      id,
      scope: id.includes('local') ? 'local' : 'upstream',
      severity: 'problem',
      title: id,
      evidence: 'measured'
    })),
    cannotConclude: []
  }
}

const power = OPTIMIZE_ACTIONS.find((item) => item.id === 'power-plan-high-performance')!

describe('optimization gate', () => {
  it('never auto-applies and forbids DNS/MTU/route surfaces', () => {
    expect(OPTIMIZE_ACTIONS.every((item) => item.applyMode !== 'never' || item.changeSurface === 'none')).toBe(true)
    expect(FORBIDDEN_APPLY_IDS.has('dns')).toBe(true)
  })

  it('blocks Windows changes without evidence or confirmation', () => {
    const preview = evaluateAction(power, {
      platform: 'win32',
      elevated: false,
      userConfirmed: false,
      diagnosis: diagnosis('local', ['local_gateway_instability'])
    })
    expect(preview.allowed).toBe(false)
    expect(preview.readyForConfirm).toBe(true)

    const noData = evaluateAction(power, {
      platform: 'win32',
      elevated: false,
      userConfirmed: true,
      diagnosis: diagnosis('insufficient_data', [])
    })
    expect(noData.allowed).toBe(false)
  })

  it('allows a backed-up power plan change only with LAN evidence, Windows, and confirm', () => {
    const result = evaluateAction(power, {
      platform: 'win32',
      elevated: false,
      userConfirmed: true,
      diagnosis: diagnosis('local', ['local_gateway_instability'])
    })
    expect(result.allowed).toBe(true)
  })

  it('refuses local tweaks when the path is upstream-only', () => {
    const result = evaluateAction(power, {
      platform: 'win32',
      elevated: false,
      userConfirmed: true,
      diagnosis: diagnosis('upstream', ['upstream_beyond_lan'])
    })
    expect(result.allowed).toBe(false)
    const offers = offersFor({
      platform: 'win32',
      elevated: false,
      diagnosis: diagnosis('upstream', ['upstream_beyond_lan', 'path_floor'])
    })
    expect(offers.some((offer) => offer.action.id === 'isp-or-riot-path')).toBe(true)
  })

  it('keeps guidance items non-applyable even if someone confirms', () => {
    const guidance = OPTIMIZE_ACTIONS.find((item) => item.id === 'router-sqm')!
    const result = assertApplySafe(guidance, {
      platform: 'win32',
      elevated: true,
      userConfirmed: true,
      diagnosis: diagnosis('local', ['local_congestion_bufferbloat'])
    })
    expect(result.allowed).toBe(false)
  })

  it('maps NIC backup strings back to the original enablement', () => {
    expect(nicRestoreValue('Enabled')).toBe('Enabled')
    expect(nicRestoreValue('Disabled')).toBe('Disabled')
    expect(nicRestoreValue('AllowComputerToTurnOffDevice: Enable')).toBe('Enabled')
  })

  it('does not treat mtu-fix as the generic forbidden mtu id', () => {
    const mtu = OPTIMIZE_ACTIONS.find((item) => item.id === 'mtu-fix')!
    const blocked = evaluateAction(mtu, {
      platform: 'win32',
      elevated: true,
      userConfirmed: true,
      diagnosis: diagnosis('local', ['path_mtu_mismatch', 'local_gateway_instability']),
      mtuMismatch: true
    })
    expect(FORBIDDEN_APPLY_IDS.has('mtu')).toBe(true)
    expect(blocked.reasons.some((reason) => /forbidden/i.test(reason))).toBe(false)
    expect(blocked.allowed).toBe(true)
  })

  it('refuses MTU without fragmentation evidence', () => {
    const mtu = OPTIMIZE_ACTIONS.find((item) => item.id === 'mtu-fix')!
    const result = evaluateAction(mtu, {
      platform: 'win32',
      elevated: true,
      userConfirmed: true,
      diagnosis: diagnosis('local', ['path_mtu_mismatch', 'local_gateway_instability']),
      mtuMismatch: false
    })
    expect(result.allowed).toBe(false)
  })

  it('keeps admin actions confirmable without a pre-elevated process', () => {
    const nic = OPTIMIZE_ACTIONS.find((item) => item.id === 'nic-device-power')!
    const result = evaluateAction(nic, {
      platform: 'win32',
      elevated: false,
      userConfirmed: false,
      diagnosis: diagnosis('local', ['local_gateway_instability'])
    })
    expect(result.readyForConfirm).toBe(true)
    expect(result.allowed).toBe(false)
    expect(result.reasons.some((reason) => /UAC/i.test(reason))).toBe(true)
  })
})
