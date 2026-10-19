import { FormEvent, useState } from 'react'
import { formatMs } from '../lib/format'
import { useAppStore } from '../state/appStore'
import { summarizeValorant } from '../../../shared/metrics'

export function SessionPage(): JSX.Element {
  const valorant = useAppStore((state) => state.valorant)
  const active = useAppStore((state) => state.valorantActive)
  const monitor = useAppStore((state) => state.monitor)
  const startValorant = useAppStore((state) => state.startValorant)
  const addValorant = useAppStore((state) => state.addValorant)
  const saveSnapshot = useAppStore((state) => state.saveSnapshot)
  const [label, setLabel] = useState('Ranked Riyadh overlay')
  const [rtt, setRtt] = useState('36')
  const [loss, setLoss] = useState('')
  const [note, setNote] = useState('')
  const metrics = summarizeValorant(valorant, 100)

  const onSubmit = (event: FormEvent): void => {
    event.preventDefault()
    const value = Number.parseFloat(rtt)
    if (!Number.isFinite(value)) return
    const parsedLoss = loss.trim() === '' ? undefined : Number.parseFloat(loss)
    void addValorant(value, note || undefined, Number.isFinite(parsedLoss) ? parsedLoss : undefined)
    setNote('')
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-2xl border border-white/5 bg-ink-800/70 p-5">
        <h1 className="text-2xl font-semibold">Manual VALORANT RTT</h1>
        <p className="mt-2 text-sm leading-6 text-white/55">
          Open VALORANT → Settings and read the Riyadh ping from the overlay. Type that number here. This app
          does not read game memory and will not treat Cloudflare or AWS samples as Riot RTT.
        </p>
        {!monitor?.running ? (
          <div className="mt-4 rounded-xl border border-pulse-warn/30 bg-pulse-warn/10 px-3 py-2 text-sm text-pulse-warn">
            Start live probing first if you want overlay samples correlated with gateway/public RTT.
          </div>
        ) : null}
        <div className="mt-4 flex gap-2">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="flex-1 rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
          />
          <button
            onClick={() => void startValorant(label)}
            className="whitespace-nowrap rounded-xl bg-sand-500 px-4 py-2 text-sm font-semibold text-ink-950"
          >
            {active ? 'Restart log' : 'Start log'}
          </button>
        </div>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <label className="block text-xs text-white/45">
            In-game Riyadh RTT (ms)
            <input
              value={rtt}
              onChange={(event) => setRtt(event.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-white/45">
            In-game loss % (optional)
            <input
              value={loss}
              onChange={(event) => setLoss(event.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs text-white/45">
            Optional note
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="round start, spike, spike+upload..."
              className="mt-1 w-full rounded-xl border border-white/10 bg-ink-900 px-3 py-2 text-sm"
            />
          </label>
          <button className="w-full rounded-xl bg-white/10 px-4 py-2 text-sm">Record overlay sample</button>
        </form>
        <button
          onClick={() => void saveSnapshot()}
          className="mt-3 w-full rounded-xl border border-white/10 px-4 py-2 text-sm"
        >
          Save combined snapshot
        </button>
      </section>
      <section className="rounded-2xl border border-white/5 bg-ink-800/70 p-5">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Samples" value={String(valorant.length)} />
          <Stat label="p95" value={formatMs(metrics?.p95Ms)} />
          <Stat label="Jitter" value={formatMs(metrics?.jitterMs)} />
        </div>
        <ul className="mt-4 max-h-[420px] space-y-2 overflow-auto text-sm">
          {valorant.length === 0 ? (
            <li className="text-white/40">No overlay samples yet.</li>
          ) : (
            [...valorant].reverse().map((sample) => (
              <li key={sample.t} className="flex items-center justify-between rounded-xl bg-ink-900 px-3 py-2">
                <span className="font-mono">{formatMs(sample.rttMs)}</span>
                <span className="text-xs text-white/40">
                  {new Date(sample.t).toLocaleTimeString()} {sample.note ? `· ${sample.note}` : ''}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-xl bg-ink-900 p-3">
      <div className="text-[11px] uppercase tracking-wider text-white/35">{label}</div>
      <div className="mt-1 font-mono text-lg">{value}</div>
    </div>
  )
}
