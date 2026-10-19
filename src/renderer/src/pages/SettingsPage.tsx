import { useEffect, useState } from 'react'
import type { DnsResolverResult, MtuProbeResult, NicInspect } from '../../../shared/types'
import { AdvicePage } from './AdvicePage'
import { SessionPage } from './SessionPage'
import { useAppStore } from '../state/appStore'

export function SettingsPage(): JSX.Element {
  const appInfo = useAppStore((state) => state.appInfo)
  const nic = useAppStore((state) => state.nic)
  const inspectNic = useAppStore((state) => state.inspectNic)
  const [dns, setDns] = useState<DnsResolverResult[] | null>(null)
  const [mtu, setMtu] = useState<MtuProbeResult | null>(null)

  useEffect(() => {
    void inspectNic()
  }, [inspectNic])

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Settings & reality check</h1>
        <p className="mt-1 max-w-3xl text-sm text-white/55">
          Data lives in the Windows user application-data directory. If gateway, bufferbloat, NIC, and local traffic
          are clean but VALORANT stays ~36 ms, the floor is distance / WE peering / Riot routing. This app cannot force
          a different international path and does not implement VPN/VPS.
        </p>
        <dl className="mt-4 grid gap-2 text-sm text-white/60 md:grid-cols-2">
          <div>Version {appInfo?.version} · phase {appInfo?.phase}</div>
          <div>{appInfo?.elevated ? 'Elevated' : 'Standard user (UAC per change)'}</div>
          <div className="md:col-span-2 font-mono text-xs">{appInfo?.userData}</div>
        </dl>
      </section>
      <NicBlock nic={nic} />
      <section className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">DNS benchmark</h2>
          <button className="text-sm text-sand-400" onClick={() => void window.api.benchmarkDns().then(setDns)}>
            Run
          </button>
        </div>
        <p className="mt-1 text-xs text-white/40">
          DNS can improve lookup responsiveness but generally does not reduce established VALORANT game-server RTT. Not
          changed automatically.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-white/65">
          {(dns ?? []).map((row) => (
            <li key={row.server}>
              {row.name}: avg {row.avgMs ?? 'n/a'} ms · p95 {row.p95Ms ?? 'n/a'} · fail {row.fail}
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">MTU diagnostic</h2>
          <button className="text-sm text-sand-400" onClick={() => void window.api.probeMtu().then(setMtu)}>
            Probe
          </button>
        </div>
        <p className="mt-1 text-xs text-white/40">Never randomly set. Apply only from Smart Optimize with evidence, backup, rollback, A/B.</p>
        {mtu ? (
          <div className="mt-2 text-sm text-white/65">
            Host {mtu.host} · largest DF {mtu.largestWorkingPayload ?? 'n/a'} · recommended {mtu.recommendedMtu ?? 'none'} ·
            fragmentation {mtu.fragmentationEvidence ? 'yes' : 'no'}
            <ul className="mt-2 list-disc pl-5 text-xs text-white/40">
              {mtu.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
      <SessionPage />
      <AdvicePage />
    </div>
  )
}

function NicBlock({ nic }: { nic: NicInspect | null }): JSX.Element {
  return (
    <section className="rounded-2xl border border-white/5 bg-ink-800/70 p-4">
      <h2 className="text-sm font-semibold">Ethernet NIC</h2>
      <ul className="mt-2 space-y-1 text-xs text-white/45">
        {(nic?.linkWarnings ?? []).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <ul className="mt-3 space-y-1 text-sm text-white/65">
        {(nic?.features ?? [])
          .filter((feature) => feature.kind !== 'other')
          .map((feature) => (
            <li key={`${feature.adapter}-${feature.keyword}`}>
              {feature.adapter} · {feature.displayName} = {feature.value} ({feature.kind})
            </li>
          ))}
      </ul>
    </section>
  )
}
