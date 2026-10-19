import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SettingsBackup } from '../../shared/types'

interface BackupFile {
  backups: SettingsBackup[]
}

export class BackupStore {
  private chain: Promise<void> = Promise.resolve()

  constructor(private readonly filePath: string) {}

  async list(): Promise<SettingsBackup[]> {
    const data = await this.read()
    return data.backups.slice().sort((a, b) => b.createdAt - a.createdAt)
  }

  async get(id: string): Promise<SettingsBackup | null> {
    const data = await this.read()
    return data.backups.find((item) => item.id === id) ?? null
  }

  async save(backup: SettingsBackup): Promise<SettingsBackup> {
    await this.update((data) => {
      data.backups = [backup, ...data.backups.filter((item) => item.id !== backup.id)].slice(0, 40)
      return data
    })
    return backup
  }

  private async update(mutator: (data: BackupFile) => BackupFile): Promise<void> {
    this.chain = this.chain.then(async () => {
      const current = await this.read()
      const next = mutator(current)
      await mkdir(join(this.filePath, '..'), { recursive: true })
      await writeFile(this.filePath, JSON.stringify(next, null, 2), 'utf8')
    })
    await this.chain
  }

  private async read(): Promise<BackupFile> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as BackupFile
      return { backups: Array.isArray(parsed.backups) ? parsed.backups : [] }
    } catch {
      return { backups: [] }
    }
  }
}
