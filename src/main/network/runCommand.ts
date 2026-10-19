import { spawn } from 'node:child_process'

export interface CommandResult {
  stdout: string
  stderr: string
  code: number | null
  cancelled: boolean
}

export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('aborted'))
      return
    }
    const timer = setTimeout(resolve, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new Error('aborted'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export function runCommand(
  command: string,
  args: string[],
  options: { timeoutMs: number; signal?: AbortSignal; onStdoutLine?: (line: string) => void }
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      resolve({ stdout: '', stderr: '', code: null, cancelled: true })
      return
    }

    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    let lineBuf = ''
    let settled = false

    const finish = (result: CommandResult): void => {
      if (settled) return
      settled = true
      options.signal?.removeEventListener('abort', onAbort)
      clearTimeout(timer)
      resolve(result)
    }

    const onAbort = (): void => {
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), 500)
      finish({ stdout, stderr, code: null, cancelled: true })
    }

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), 500)
      finish({ stdout, stderr, code: null, cancelled: false })
    }, options.timeoutMs)

    options.signal?.addEventListener('abort', onAbort, { once: true })

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
      if (!options.onStdoutLine) return
      lineBuf += chunk
      const lines = lineBuf.split(/\r?\n/)
      lineBuf = lines.pop() ?? ''
      for (const line of lines) {
        if (line.trim()) options.onStdoutLine(line)
      }
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      if (!settled) reject(error)
    })
    child.on('close', (code) => {
      if (lineBuf.trim() && options.onStdoutLine) options.onStdoutLine(lineBuf)
      finish({ stdout, stderr, code, cancelled: false })
    })
  })
}
