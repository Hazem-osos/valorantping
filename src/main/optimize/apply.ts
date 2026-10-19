import { randomUUID } from 'node:crypto'
import { assertApplySafe, nicRestoreValue, OPTIMIZE_ACTIONS } from '../../shared/optimization'
import type {
  ApplyResult,
  Diagnosis,
  HostPlatform,
  RollbackResult,
  SettingsBackup
} from '../../shared/types'
import { BackupStore } from './backupStore'
import { readMtu, setMtu } from './mtu'
import { alternateFor, readNicAdvanced, setNicAdvanced, snapshotForKind } from './nicAdvanced'
import {
  highPerformanceGuid,
  isElevated,
  readNicPower,
  readPowerScheme,
  setNicPower,
  setPowerScheme
} from './windows'

export async function applyApprovedChange(input: {
  actionId: string
  confirm: true
  diagnosis: Diagnosis
  platform: HostPlatform
  backups: BackupStore
  hasBaseline?: boolean
  mtuMismatch?: boolean
  nicFeaturePresent?: boolean
  recommendedMtu?: number | null
  mtuConfirm?: boolean
}): Promise<ApplyResult> {
  const action = OPTIMIZE_ACTIONS.find((item) => item.id === input.actionId)
  if (!action) return { applied: false, message: 'Unknown optimization action.' }
  const elevated = await isElevated()
  const gate = assertApplySafe(action, {
    platform: input.platform,
    elevated: elevated || action.requiresAdmin,
    userConfirmed: input.confirm,
    diagnosis: input.diagnosis,
    hasBaseline: input.hasBaseline,
    mtuMismatch: input.mtuMismatch,
    nicFeaturePresent: input.nicFeaturePresent
  })
  if (!gate.allowed) {
    return { applied: false, message: gate.reasons.join(' ') }
  }
  if (action.id === 'mtu-fix' && input.mtuConfirm !== true) {
    return { applied: false, message: 'MTU changes need an extra explicit confirmation.' }
  }

  const backup: SettingsBackup = {
    id: randomUUID(),
    actionId: action.id,
    createdAt: Date.now(),
    rolledBackAt: null,
    diagnosisScope: input.diagnosis.scope,
    evidenceIds: gate.evidenceMatched,
    payload: {}
  }

  try {
    if (action.changeSurface === 'power-plan') {
      const current = await readPowerScheme()
      if (!current) return { applied: false, message: 'Could not read the active power scheme; nothing was changed.' }
      backup.payload.powerScheme = current
      await input.backups.save(backup)
      await setPowerScheme(highPerformanceGuid())
      return {
        applied: true,
        backupId: backup.id,
        message: `High Performance is active. Previous scheme ${current.name} was saved. This is not a proven ping reduction until you measure again.`
      }
    }
    if (action.changeSurface === 'nic-power') {
      const current = await readNicPower()
      if (current.length === 0) return { applied: false, message: 'No adapters reported power-management state; nothing was changed.' }
      backup.payload.nicPower = current
      await input.backups.save(backup)
      for (const adapter of current) {
        await setNicPower(adapter.name, 'Disabled')
      }
      return {
        applied: true,
        backupId: backup.id,
        message: 'NIC device power-off was disabled on up adapters. Rollback from Optimization Center. Measure before claiming any spike change.'
      }
    }
    if (action.changeSurface === 'nic-advanced') {
      const features = await readNicAdvanced()
      const kind = action.id === 'nic-eee' ? 'eee' : 'interrupt-moderation'
      const matches = features.filter((feature) => feature.kind === kind)
      if (matches.length === 0) {
        return { applied: false, message: 'This NIC/driver does not expose the property; nothing was changed.' }
      }
      backup.payload.nicAdvanced = snapshotForKind(features, kind)
      await input.backups.save(backup)
      for (const feature of matches) {
        const next = alternateFor(feature)
        if (!next) continue
        await setNicAdvanced(feature.adapter, feature.displayName, next)
      }
      return {
        applied: true,
        backupId: backup.id,
        message:
          action.id === 'nic-interrupt-moderation'
            ? 'Interrupt Moderation was toggled for A/B. Keep it only if the follow-up probe is meaningfully better.'
            : 'Energy Efficient Ethernet was set toward Disabled where the driver allowed it. Hardware support varies.'
      }
    }
    if (action.changeSurface === 'mtu') {
      if (!input.recommendedMtu) {
        return { applied: false, message: 'No recommended MTU from DF evidence; nothing was changed.' }
      }
      const current = await readMtu()
      if (current.length === 0) return { applied: false, message: 'Could not read interface MTU; nothing was changed.' }
      backup.payload.mtu = current
      await input.backups.save(backup)
      await setMtu(current[0].iface, input.recommendedMtu)
      return {
        applied: true,
        backupId: backup.id,
        message: `MTU on ${current[0].iface} set to ${input.recommendedMtu}. Original values were backed up. A/B must decide keep vs rollback.`
      }
    }
    return { applied: false, message: 'This item is guidance-only and cannot change Windows.' }
  } catch (error) {
    return {
      applied: false,
      backupId: backup.id,
      message: error instanceof Error ? error.message : 'Apply failed; check backups before retrying.'
    }
  }
}

export async function rollbackBackup(backup: SettingsBackup, store: BackupStore): Promise<RollbackResult> {
  if (backup.rolledBackAt) return { restored: false, message: 'This backup was already restored.' }
  if (process.platform !== 'win32') {
    return { restored: false, message: 'Rollback of Windows settings cannot run on this OS.' }
  }
  try {
    if (backup.payload.powerScheme) {
      await setPowerScheme(backup.payload.powerScheme.guid)
    }
    if (backup.payload.nicPower) {
      for (const adapter of backup.payload.nicPower) {
        const value = nicRestoreValue(adapter.allowComputerToTurnOffDevice)
        await setNicPower(adapter.name, value)
      }
    }
    if (backup.payload.nicAdvanced) {
      for (const item of backup.payload.nicAdvanced) {
        await setNicAdvanced(item.adapter, item.displayName, item.value)
      }
    }
    if (backup.payload.mtu) {
      for (const item of backup.payload.mtu) {
        await setMtu(item.iface, item.mtu)
      }
    }
    backup.rolledBackAt = Date.now()
    await store.save(backup)
    return { restored: true, message: 'Previous settings were restored. Re-run probes before calling the path better or worse.' }
  } catch (error) {
    return { restored: false, message: error instanceof Error ? error.message : 'Rollback failed' }
  }
}
