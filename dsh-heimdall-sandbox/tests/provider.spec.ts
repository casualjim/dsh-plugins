/**
 * Provider tests: argv shape, per-call policy file contents, binary
 * resolution precedence, and lifecycle cleanup. No real confinement here —
 * the exec-level behavior against the installed binary lives in exec.e2e.ts.
 */

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { HeimdallSandboxProvider, resolveBinaryPath } from '../src/index.ts'

const WW = { mode: 'workspace-write', workspaceRoot: '/ws' } as const

afterAll(() => {
  // vitest tmp dirs are swept by the OS; nothing to do explicitly.
})

async function setup(config: Record<string, unknown> = {}) {
  const ctx = new Context()
  await ctx.plugin(HeimdallSandboxProvider, config)
  return ctx.sandbox as HeimdallSandboxProvider
}

describe('confine', () => {
  it('wraps the caller argv as `binary exec --policy <file>` and serializes the document', async () => {
    const sandbox = await setup({ binaryPath: process.execPath })
    const confined = sandbox.confine(['bash', '-c', 'echo hi'], WW)

    expect(confined.argv[0]).toBe(process.execPath)
    expect(confined.argv.slice(1, 3)).toEqual(['exec', '--policy'])
    expect(confined.enforcement).toBe('full')
    expect(confined.denialSignatures.length).toBeGreaterThan(0)
    expect(confined.runnerFailureRules.some(rule => rule.allowedExitCodes?.includes(2))).toBe(true)

    const document = JSON.parse(readFileSync(confined.argv[3]!, 'utf-8'))
    expect(document).toEqual({
      cwd: '/ws',
      command: ['bash', '-c', 'echo hi'],
      stdio: 'inherit',
      filesystem: { writable: ['/ws'] },
    })
  })

  it('removes its policy temp dirs when the plugin stops', async () => {
    const ctx = new Context()
    await ctx.plugin(HeimdallSandboxProvider, { binaryPath: process.execPath })
    const sandbox = ctx.sandbox as HeimdallSandboxProvider
    const confined = sandbox.confine(['true'], WW)
    expect(existsSync(confined.argv[3]!)).toBe(true)

    sandbox.internals.dispose()
    expect(existsSync(confined.argv[3]!)).toBe(false)
  })
})

describe('resolveBinaryPath', () => {
  it('prefers the configured path when it exists', () => {
    expect(resolveBinaryPath(process.execPath)).toBe(process.execPath)
  })

  it('falls through to PATH when the configured path is missing', () => {
    const resolved = resolveBinaryPath('/does/not/exist-xyz/heimdall-sandbox')
    expect(resolved).toContain('heimdall-sandbox')
  }, 10_000)
})
