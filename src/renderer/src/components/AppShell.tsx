import {
  Activity,
  Crosshair,
  Gauge,
  GitBranch,
  History,
  LayoutDashboard,
  Radar,
  Router,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Waves
} from 'lucide-react'
import type { ReactNode } from 'react'
import { classNames } from '../lib/format'
import { useAppStore, type View } from '../state/appStore'

const NAV: Array<{ id: View; label: string; hint: string; icon: typeof Radar }> = [
  { id: 'dashboard', label: 'Dashboard', hint: 'Health & diagnosis', icon: LayoutDashboard },
  { id: 'live', label: 'Live Test', hint: 'RTT, jitter, loss', icon: Radar },
  { id: 'gaming', label: 'Gaming Mode', hint: 'Stable match watch', icon: Crosshair },
  { id: 'smart', label: 'Smart Optimize', hint: 'One change at a time', icon: Sparkles },
  { id: 'optimize', label: 'Optimization Center', hint: 'Backed-up Windows changes', icon: SlidersHorizontal },
  { id: 'bufferbloat', label: 'Bufferbloat', hint: 'Idle vs load', icon: Waves },
  { id: 'path', label: 'Traceroute', hint: 'Read-only hops', icon: GitBranch },
  { id: 'router', label: 'Router', hint: 'SQM guidance', icon: Router },
  { id: 'history', label: 'History', hint: 'CSV & compare', icon: History },
  { id: 'reports', label: 'Reports', hint: 'VALORANT + 15-min', icon: Gauge },
  { id: 'settings', label: 'Settings', hint: 'DNS, MTU, overlay', icon: Settings }
]

export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  const view = useAppStore((state) => state.view)
  const setView = useAppStore((state) => state.setView)
  const monitor = useAppStore((state) => state.monitor)
  const error = useAppStore((state) => state.error)

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-64 shrink-0 flex-col border-r border-white/5 bg-ink-900/80 px-4 py-5">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sand-500/40 bg-ink-800">
            <Activity className="h-5 w-5 text-sand-400" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-sand-400">Riyadh</div>
            <div className="text-sm font-semibold">Ping Optimizer</div>
          </div>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-auto">
          {NAV.map((item) => {
            const Icon = item.icon
            const active = view === item.id
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={classNames(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                  active ? 'bg-white/8 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                )}
              >
                <Icon className={classNames('h-4 w-4', active ? 'text-sand-400' : 'text-white/40')} />
                <span>
                  <span className="block text-sm">{item.label}</span>
                  <span className="block text-[11px] text-white/35">{item.hint}</span>
                </span>
              </button>
            )
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-white/5 bg-ink-800 p-3 text-[11px] leading-5 text-white/50">
          <div className="mb-1 font-medium text-white/80">Final phase · measurable only</div>
          WE Egypt · Ethernet · no VPN · no Vanguard · no silent Windows changes.
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-white/5 px-6 py-4">
          <div className="min-w-0">
            <div className="text-lg font-semibold leading-tight">Riyadh path lab</div>
            <div className="text-xs text-white/45">
              Public ICMP/TCP is path quality. Game RTT is only the overlay you type in.
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={classNames(
                'rounded-full px-3 py-1 text-xs',
                monitor?.running ? 'bg-pulse-good/15 text-pulse-good' : 'bg-white/5 text-white/50'
              )}
            >
              {monitor?.running ? 'Probing' : 'Idle'}
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/50">Free · on-device</span>
          </div>
        </header>
        {error ? (
          <div className="mx-6 mt-4 rounded-xl border border-pulse-bad/30 bg-pulse-bad/10 px-4 py-2 text-sm text-pulse-bad">
            {error}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  )
}
