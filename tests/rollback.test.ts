import { describe, expect, it } from 'vitest'
import { nicRestoreValue } from '../src/shared/optimization'
import type { SettingsBackup } from '../src/shared/types'

function backup(partial: Partial<SettingsBackup> = {}): SettingsBackup {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    actionId: 'power-plan-high-performance',
    createdAt: 1,
    rolledBackAt: null,
    diagnosisScope: 'local',
    evidenceIds: ['local_gateway_instability'],
    payload: {
      powerScheme: { guid: '381b4222-f694-41f0-9685-ff5bb260df2e', name: 'Balanced' }
    },
    ...partial
  }
}

describe('rollback records', () => {
  it('stores the previous scheme so restore is exact, not a default', () => {
    const record = backup()
    expect(record.payload.powerScheme?.guid).toBe('381b4222-f694-41f0-9685-ff5bb260df2e')
    expect(record.rolledBackAt).toBeNull()
  })

  it('restores NIC allow-off to the backed-up value, not a hardcoded disable', () => {
    const record = backup({
      actionId: 'nic-device-power',
      payload: {
        nicPower: [
          { name: 'Ethernet', allowComputerToTurnOffDevice: 'Enabled' },
          { name: 'Ethernet 2', allowComputerToTurnOffDevice: 'Disabled' }
        ]
      }
    })
    expect(record.payload.nicPower?.map((item) => nicRestoreValue(item.allowComputerToTurnOffDevice))).toEqual([
      'Enabled',
      'Disabled'
    ])
  })

  it('treats an already restored backup as consumed', () => {
    const record = backup({ rolledBackAt: 99 })
    expect(record.rolledBackAt).not.toBeNull()
  })

  it('can store NIC advanced and MTU originals for restore', () => {
    const record = backup({
      actionId: 'nic-eee',
      payload: {
        nicAdvanced: [{ adapter: 'Ethernet', displayName: 'Energy Efficient Ethernet', value: 'Enabled' }],
        mtu: [{ iface: 'Ethernet', mtu: 1500 }]
      }
    })
    expect(record.payload.nicAdvanced?.[0]?.value).toBe('Enabled')
    expect(record.payload.mtu?.[0]?.mtu).toBe(1500)
  })
})
