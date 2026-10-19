import { useEffect } from 'react'
import { AppShell } from './components/AppShell'
import { Disclaimer } from './components/Disclaimer'
import { BufferbloatPage } from './pages/BufferbloatPage'
import { DashboardPage } from './pages/DashboardPage'
import { GamingPage } from './pages/GamingPage'
import { HistoryPage } from './pages/HistoryPage'
import { LiveTestPage } from './pages/LiveTestPage'
import { OptimizePage } from './pages/OptimizePage'
import { PathPage } from './pages/PathPage'
import { ReportsPage } from './pages/ReportsPage'
import { RouterPage } from './pages/RouterPage'
import { SettingsPage } from './pages/SettingsPage'
import { SmartPage } from './pages/SmartPage'
import { useAppStore } from './state/appStore'

export default function App(): JSX.Element {
  const view = useAppStore((state) => state.view)
  const hydrate = useAppStore((state) => state.hydrate)
  const pushSample = useAppStore((state) => state.pushSample)
  const pushAdapter = useAppStore((state) => state.pushAdapter)
  const pushHop = useAppStore((state) => state.pushHop)
  const setStabilityProgress = useAppStore((state) => state.setStabilityProgress)
  const setTimedProgress = useAppStore((state) => state.setTimedProgress)
  const refreshHistory = useAppStore((state) => state.refreshHistory)

  useEffect(() => {
    if (!window.api) {
      useAppStore.setState({
        error: 'Preload bridge missing. Launch the desktop app with npm run dev, not a bare browser tab.'
      })
      return
    }
    void hydrate()
    const unsubs = [
      window.api.onProbeSample(pushSample),
      window.api.onAdapterSample(pushAdapter),
      window.api.onTraceHop(pushHop),
      window.api.onMonitorEvent((event) => {
        if (event.error) useAppStore.setState({ error: event.error })
        if (!event.running) void refreshHistory()
      }),
      window.api.onStabilityProgress((progress) => {
        setStabilityProgress(progress)
        if (!progress.running && progress.sessionId) {
          void useAppStore.getState().loadReport(progress.sessionId)
        }
      }),
      window.api.onTimedProgress(setTimedProgress)
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [hydrate, pushAdapter, pushHop, pushSample, refreshHistory, setStabilityProgress, setTimedProgress])

  return (
    <>
      <Disclaimer />
      <AppShell>
        {view === 'dashboard' ? <DashboardPage /> : null}
        {view === 'live' ? <LiveTestPage /> : null}
        {view === 'gaming' ? <GamingPage /> : null}
        {view === 'smart' ? <SmartPage /> : null}
        {view === 'optimize' ? <OptimizePage /> : null}
        {view === 'bufferbloat' ? <BufferbloatPage /> : null}
        {view === 'path' ? <PathPage /> : null}
        {view === 'router' ? <RouterPage /> : null}
        {view === 'history' ? <HistoryPage /> : null}
        {view === 'reports' || view === 'diagnostics' ? <ReportsPage /> : null}
        {view === 'settings' || view === 'session' || view === 'advice' ? <SettingsPage /> : null}
      </AppShell>
    </>
  )
}
