import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { INSTALLER_FILE_NAME } from '../src/shared/constants'
import { PACKAGING } from '../src/shared/packaging'

describe('packaging contract', () => {
  const yaml = readFileSync(new URL('../electron-builder.yml', import.meta.url), 'utf8')
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string
    scripts: Record<string, string>
  }

  it('names the NSIS installer exactly for the gaming PC copy step', () => {
    expect(PACKAGING.installerFileName).toBe('Riyadh-Ping-Optimizer-Setup.exe')
    expect(INSTALLER_FILE_NAME).toBe('Riyadh-Ping-Optimizer-Setup.exe')
    expect(yaml).toContain('Riyadh-Ping-Optimizer-Setup.exe')
    expect(yaml).toContain('nsis')
    expect(yaml).toContain('x64')
  })

  it('installs per-user without admin for ordinary diagnostics', () => {
    expect(PACKAGING.requestedExecutionLevel).toBe('asInvoker')
    expect(yaml).toContain('requestedExecutionLevel: asInvoker')
    expect(yaml).toContain('createStartMenuShortcut: true')
    expect(yaml).toContain('perMachine: false')
    expect(yaml).toContain('asar: true')
  })

  it('does not instruct a SmartScreen bypass', () => {
    expect(yaml).toContain('signAndEditExecutable: false')
    expect(PACKAGING.smartScreen).toContain('smartscreen')
    expect(yaml.toLowerCase()).not.toContain('disable smartscreen')
  })

  it('exposes a Windows package script', () => {
    expect(pkg.scripts['package:win']).toContain('electron-builder --win')
  })
})
