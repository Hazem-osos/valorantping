import { DEFAULT_PUBLIC_TARGETS } from '../../../shared/constants'
import { formatMs } from '../lib/format'
import { useAppStore } from '../state/appStore'

export function PathPage(): JSX.Element {
  const hops = useAppStore((state) => state.hops)
  const tracing = useAppStore((state) => state.tracing)
  const traceroute = useAppStore((state) => state.traceroute)
  const network = useAppStore((state) => state.network)
  const runTrace = useAppStore((state) => state.runTrace)
  const cancelTrace = useAppStore((state) => state.cancelTrace)
  const hosts = [
    network?.gateway,
    ...DEFAULT_PUBLIC_TARGETS.map((target) => target.host)
  ].filter((host): host is string => Boolean(host))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Read-only traceroute</h1>
        <p className="mt-1 max-w-3xl text-sm text-white/55">
          This runs system traceroute/tracert with bounded hops. It never writes routes. A jump at hop 1 is
          usually local; hops 2–4 on WE Egypt are typically still ISP.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {hosts.map((host) => (
          <button
            key={host}
            disabled={tracing}
            onClick={() => void runTrace(host)}
            className="whitespace-nowrap rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
          >
            Trace {host}
          </button>
        ))}
        {tracing ? (
          <button onClick={() => void cancelTrace()} className="rounded-xl bg-pulse-bad px-3 py-2 text-sm">
            Cancel
          </button>
        ) : null}
      </div>
      {traceroute?.firstSustainedJumpHop ? (
        <div className="rounded-xl border border-sand-500/20 bg-sand-500/10 px-4 py-3 text-sm">
          First sustained RTT jump: hop {traceroute.firstSustainedJumpHop}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-white/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-800 text-[11px] uppercase tracking-wider text-white/40">
            <tr>
              <th className="px-4 py-3">Hop</th>
              <th>Host</th>
              <th>RTTs</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {hops.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-white/40">
                  {tracing ? 'Waiting for hops…' : 'Run a traceroute to capture the path.'}
                </td>
              </tr>
            ) : (
              hops.map((hop) => (
                <tr key={hop.hop} className="border-t border-white/5">
                  <td className="px-4 py-3 font-mono">{hop.hop}</td>
                  <td className="font-mono text-xs">{hop.host ?? '*'}</td>
                  <td className="font-mono text-xs">
                    {hop.rttsMs.map((rtt, index) => (
                      <span key={index} className="mr-2">
                        {formatMs(rtt)}
                      </span>
                    ))}
                  </td>
                  <td className="text-xs text-white/50">{hop.timedOut ? 'timeout' : 'reply'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
