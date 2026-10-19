import { OPTIMIZE_ACTIONS } from './optimization'
import type { ClassifierResult, OptimizeAction } from './types'

const ORDER = [
  'pause-uploads',
  'power-plan-high-performance',
  'nic-device-power',
  'nic-eee',
  'nic-interrupt-moderation',
  'mtu-fix',
  'router-sqm',
  'isp-or-riot-path'
]

export function planSmartOptimize(
  classifier: ClassifierResult,
  hasBaseline: boolean,
  extras: { mtuMismatch?: boolean; nicEee?: boolean; nicIm?: boolean } = {}
): OptimizeAction[] {
  if (!hasBaseline) return []
  if (classifier.primary === 'INCONCLUSIVE') return []
  const wanted = new Set<string>(['isp-or-riot-path'])
  if (classifier.primary === 'BUFFERBLOAT_SUSPECTED' || classifier.secondary.includes('BUFFERBLOAT_SUSPECTED')) {
    wanted.add('pause-uploads')
    wanted.add('router-sqm')
    wanted.add('delivery-optimization')
  }
  if (classifier.primary === 'LOCAL_LAN' || classifier.secondary.includes('LOCAL_LAN')) {
    wanted.add('power-plan-high-performance')
    wanted.add('nic-device-power')
    wanted.add('ethernet-link-check')
  }
  if (classifier.secondary.includes('NIC_POWER_MANAGEMENT') || classifier.primary === 'NIC_POWER_MANAGEMENT') {
    wanted.add('nic-device-power')
    if (extras.nicEee) wanted.add('nic-eee')
  }
  if (extras.nicIm && (classifier.primary === 'LOCAL_LAN' || classifier.secondary.includes('LOCAL_LAN'))) {
    wanted.add('nic-interrupt-moderation')
  }
  if (classifier.primary === 'LOCAL_CONGESTION') {
    wanted.add('pause-uploads')
    wanted.add('router-sqm')
    wanted.add('delivery-optimization')
  }
  if (extras.mtuMismatch) wanted.add('mtu-fix')
  if (classifier.buckets.unfixableLocally) {
    return OPTIMIZE_ACTIONS.filter((action) => action.id === 'isp-or-riot-path')
  }
  return ORDER.map((id) => OPTIMIZE_ACTIONS.find((action) => action.id === id))
    .filter((action): action is OptimizeAction => Boolean(action))
    .filter((action) => wanted.has(action.id))
}
