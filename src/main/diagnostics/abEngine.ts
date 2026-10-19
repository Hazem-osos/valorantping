import { AB_PROBE_DURATION_MS, AB_SETTLE_MS, DEFAULT_INTERVAL_MS } from '../../shared/constants'
import { compareAbWindows } from '../../shared/abCompare'
import { delay } from '../network/runCommand'
import type { AbRunResult, AdapterSample, Diagnosis, ProbeSample, StoredSession, WindowMetrics } from '../../shared/types'
import { applyApprovedChange, rollbackBackup } from '../optimize/apply'
import type { BackupStore } from '../optimize/backupStore'
import { ProbeEngine } from '../network/engine'
import { AdapterMonitor } from '../network/adapters'
import { TimedProbe } from './timed'

const EMPTY_METRICS: WindowMetrics = {
  sampleCount: 0,
  timeoutCount: 0,
  lossPct: 0,
  minMs: null,
  maxMs: null,
  avgMs: null,
  p50Ms: null,
  p95Ms: null,
  p99Ms: null,
  stdevMs: null,
  jitterMs: null,
  spikeCount: 0,
  lastMs: null
}

function farMetrics(session: StoredSession): WindowMetrics {
  return (
    session.targets.find((target) => target.target.kind === 'regional')?.metrics ??
    session.targets.find((target) => target.target.kind === 'public')?.metrics ??
    session.targets[0]?.metrics ??
    EMPTY_METRICS
  )
}

export async function runAbOptimization(input: {
  actionId: string
  diagnosis: Diagnosis
  platform: NodeJS.Platform
  backups: BackupStore
  engine: ProbeEngine
  adapters: AdapterMonitor
  hasBaseline: boolean
  mtuMismatch: boolean
  nicFeaturePresent: boolean
  recommendedMtu: number | null
  mtuConfirm?: boolean
  onSample: (sample: ProbeSample) => void
  onAdapter: (sample: AdapterSample) => void
  onProgress: (phase: string, elapsedMs: number, remainingMs: number) => void
  onSave: (session: StoredSession) => Promise<StoredSession>
}): Promise<AbRunResult> {
  const timed = new TimedProbe(input.engine, input.adapters)
  input.onProgress('baseline-probes', 0, AB_PROBE_DURATION_MS)
  const before = await input.onSave(await timed.run({
    durationMs: AB_PROBE_DURATION_MS,
    intervalMs: DEFAULT_INTERVAL_MS,
    label: `A/B before ${input.actionId}`,
    kind: 'ab',
    progressKind: 'ab',
    onSample: input.onSample,
    onAdapter: input.onAdapter,
    onProgress: (progress) => input.onProgress(progress.phase, progress.elapsedMs, progress.remainingMs)
  }))
  const applied = await applyApprovedChange({
    actionId: input.actionId,
    confirm: true,
    diagnosis: input.diagnosis,
    platform: input.platform,
    backups: input.backups,
    hasBaseline: input.hasBaseline,
    mtuMismatch: input.mtuMismatch,
    nicFeaturePresent: input.nicFeaturePresent,
    recommendedMtu: input.recommendedMtu,
    mtuConfirm: input.mtuConfirm
  })
  if (!applied.applied) {
    const empty = farMetrics(before)
    return {
      actionId: input.actionId,
      comparison: compareAbWindows(empty, empty),
      applied: false,
      rolledBack: false,
      backupId: applied.backupId,
      message: applied.message,
      beforeSessionId: before.id,
      afterSessionId: before.id
    }
  }
  input.onProgress('settle', 0, AB_SETTLE_MS)
  await delay(AB_SETTLE_MS)
  input.onProgress('after-probes', 0, AB_PROBE_DURATION_MS)
  const after = await input.onSave(await timed.run({
    durationMs: AB_PROBE_DURATION_MS,
    intervalMs: DEFAULT_INTERVAL_MS,
    label: `A/B after ${input.actionId}`,
    kind: 'ab',
    progressKind: 'ab',
    onSample: input.onSample,
    onAdapter: input.onAdapter,
    onProgress: (progress) => input.onProgress(progress.phase, progress.elapsedMs, progress.remainingMs)
  }))
  const comparison = compareAbWindows(farMetrics(before), farMetrics(after))
  let rolledBack = false
  if (comparison.rollbackRecommended && applied.backupId) {
    const backup = await input.backups.get(applied.backupId)
    if (backup) {
      await rollbackBackup(backup, input.backups)
      rolledBack = true
    }
  }
  const message =
    comparison.verdict === 'IMPROVED'
      ? `IMPROVED on probe metrics. ${comparison.reasons.join(' ')} VALORANT overlay RTT is still separate.`
      : comparison.verdict === 'WORSE'
        ? `WORSE — original setting was restored. ${comparison.reasons.join(' ')}`
        : `${comparison.verdict.replaceAll('_', ' ')}. Original setting restored because the delta was not meaningful. ${comparison.reasons.join(' ')}`
  return {
    actionId: input.actionId,
    comparison,
    applied: true,
    rolledBack,
    backupId: applied.backupId,
    message,
    beforeSessionId: before.id,
    afterSessionId: after.id
  }
}
