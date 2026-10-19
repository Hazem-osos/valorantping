import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

interface AppSettings {
  baselineSessionId: string | null
  verifiedActionIds: string[]
}

const EMPTY: AppSettings = { baselineSessionId: null, verifiedActionIds: [] }

export class SettingsStore {
  constructor(private readonly filePath: string) {}

  async get(): Promise<AppSettings> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as Partial<AppSettings>
      return {
        baselineSessionId: parsed.baselineSessionId ?? null,
        verifiedActionIds: Array.isArray(parsed.verifiedActionIds) ? parsed.verifiedActionIds : []
      }
    } catch {
      return { ...EMPTY }
    }
  }

  async setBaseline(sessionId: string | null): Promise<AppSettings> {
    const current = await this.get()
    return this.write({ ...current, baselineSessionId: sessionId })
  }

  async addVerified(actionId: string): Promise<AppSettings> {
    const current = await this.get()
    const verifiedActionIds = [...new Set([...current.verifiedActionIds, actionId])]
    return this.write({ ...current, verifiedActionIds })
  }

  private async write(next: AppSettings): Promise<AppSettings> {
    await mkdir(join(this.filePath, '..'), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(next, null, 2), 'utf8')
    return next
  }
}
