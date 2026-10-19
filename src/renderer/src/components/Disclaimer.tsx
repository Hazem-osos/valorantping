import { useAppStore } from '../state/appStore'

export function Disclaimer(): JSX.Element | null {
  const seen = useAppStore((state) => state.disclaimerSeen)
  const dismiss = useAppStore((state) => state.dismissDisclaimer)
  if (seen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
      <div className="max-w-xl rounded-3xl border border-sand-500/20 bg-ink-800 p-6 shadow-panel">
        <div className="text-xs uppercase tracking-[0.2em] text-sand-400">Read this first</div>
        <h2 className="mt-2 text-2xl font-semibold">No fabricated ping, no Vanguard, no magic 20ms.</h2>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-white/70">
          <li>ICMP to WE DNS / Cloudflare / Google is not VALORANT Riyadh RTT.</li>
          <li>TCP to AWS Bahrain is a regional internet proxy, not Riot game servers.</li>
          <li>A stable 36ms in-game baseline may already be the path floor from Egypt.</li>
          <li>Phase 1 never changes Windows, the NIC, routes, or the game.</li>
          <li>Record the overlay yourself if you want real VALORANT numbers.</li>
        </ul>
        <button
          onClick={dismiss}
          className="mt-6 w-full rounded-xl bg-sand-500 px-4 py-2.5 text-sm font-semibold text-ink-950"
        >
          Measure honestly
        </button>
      </div>
    </div>
  )
}
