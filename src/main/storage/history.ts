import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { MAX_HISTORY_SESSIONS } from '../../shared/constants'
import { compareSessions } from '../../shared/compare'
import { sessionToCsv } from '../../shared/csv'
import { summarizeValorant } from '../../shared/metrics'
import type { Comparison, SessionSummary, StoredSession, ValorantSample } from '../../shared/types'

interface HistoryFile {
  sessions: StoredSession[]
}

export class HistoryStore {
  private chain: Promise<void> = Promise.resolve()

  constructor(private readonly filePath: string) {}

  async list(): Promise<SessionSummary[]> {
    const data = await this.read()
    return data.sessions
      .slice()
      .sort((a, b) => b.startedAt - a.startedAt)
      .map((session) => toSummary(session))
  }

  async get(id: string): Promise<StoredSession | null> {
    const data = await this.read()
    return data.sessions.find((session) => session.id === id) ?? null
  }

  async save(session: StoredSession): Promise<StoredSession> {
    await this.update((data) => {
      const next = data.sessions.filter((item) => item.id !== session.id)
      next.unshift(session)
      data.sessions = next.slice(0, MAX_HISTORY_SESSIONS)
      return data
    })
    return session
  }

  async delete(id: string): Promise<void> {
    await this.update((data) => {
      data.sessions = data.sessions.filter((session) => session.id !== id)
      return data
    })
  }

  async compare(beforeId: string, afterId: string): Promise<Comparison> {
    const before = await this.get(beforeId)
    const after = await this.get(afterId)
    if (!before || !after) throw new Error('Both snapshots must exist before comparison')
    return compareSessions(before, after)
  }

  async exportCsv(id: string): Promise<string> {
    const session = await this.get(id)
    if (!session) throw new Error('Snapshot not found')
    return sessionToCsv(session)
  }

  async attachValorant(id: string, sample: ValorantSample): Promise<StoredSession> {
    const session = await this.get(id)
    if (!session) throw new Error('Snapshot not found')
    session.valorant.push(sample)
    session.valorantMetrics = summarizeValorant(session.valorant, session.spikeThresholdMs)
    if (session.kind === 'probe') session.kind = 'combined'
    await this.save(session)
    return session
  }

  private async update(mutator: (data: HistoryFile) => HistoryFile): Promise<void> {
    this.chain = this.chain.then(async () => {
      const current = await this.read()
      const next = mutator(current)
      await mkdir(join(this.filePath, '..'), { recursive: true })
      await writeFile(this.filePath, JSON.stringify(next), 'utf8')
    })
    await this.chain
  }

  private async read(): Promise<HistoryFile> {
    try {
      const raw = await readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as HistoryFile
      return { sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [] }
    } catch {
      return { sessions: [] }
    }
  }
}

function toSummary(session: StoredSession): SessionSummary {
  const far =
    session.targets.find((target) => target.target.kind === 'regional') ??
    session.targets.find((target) => target.target.kind === 'public')
  const gateway = session.targets.find((target) => target.target.kind === 'gateway')
  return {
    id: session.id,
    kind: session.kind,
    label: session.label,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    scope: session.diagnosis.scope,
    regionalP95: far?.metrics.p95Ms ?? null,
    gatewayP95: gateway?.metrics.p95Ms ?? null,
    lossPct: far?.metrics.lossPct ?? null,
    valorantP95: session.valorantMetrics?.p95Ms ?? null,
    spikeCount: far?.metrics.spikeCount ?? 0
  }
}
