/**
 * Exec-level verification against the real heimdall-sandbox binary, resolved
 * the same way the provider resolves it (npm wrapper, then PATH). Always
 * runs — no skip gates. Fixture roots live under the repo's target/ —
 * OUTSIDE heimdall's always-writable platform temp grants — so a denied
 * write proves confinement rather than a grant.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { HeimdallSandboxProvider, resolveBinaryPath } from '../src/index.ts'

const BIN = resolveBinaryPath(undefined)

function fixtureDir(name: string): string {
  const dir = join(process.cwd(), 'target', `${name}-${process.pid}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

async function provider() {
  const ctx = new Context()
  await ctx.plugin(HeimdallSandboxProvider, {})
  const sandbox = ctx.sandbox as HeimdallSandboxProvider
  return { sandbox, done: () => sandbox.internals.dispose() }
}

function run(sandbox: HeimdallSandboxProvider, argv: string[], mode: 'read-only' | 'workspace-write', cwd: string) {
  const confined = sandbox.confine(argv, { mode, workspaceRoot: cwd })
  return spawnSync(confined.argv[0]!, confined.argv.slice(1), { encoding: 'utf-8' })
}

describe('heimdall-sandbox exec through the provider argv', () => {
  it('read-only: declared-empty filesystem keeps reads and denies cwd writes', async () => {
    const cwd = fixtureDir('read-only')
    writeFileSync(join(cwd, 'seed.txt'), 'data')
    const { sandbox, done } = await provider()
    try {
      const result = run(sandbox, ['sh', '-c', 'cat seed.txt && (printf ro > blocked.txt) 2>/dev/null'], 'read-only', cwd)
      expect(result.stdout).toBe('data')
      expect(existsSync(join(cwd, 'blocked.txt'))).toBe(false)
    } finally {
      done()
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  it('workspace-write: explicit grant lets the child write inside its workspace', async () => {
    const cwd = fixtureDir('workspace-write')
    const { sandbox, done } = await provider()
    try {
      const result = run(sandbox, ['sh', '-c', 'printf ww > out.txt && cat out.txt'], 'workspace-write', cwd)
      expect(result.status).toBe(0)
      expect(result.stdout).toBe('ww')
    } finally {
      done()
      rmSync(cwd, { recursive: true, force: true })
    }
  })

  it('filesystem.deny carves secrets out of an otherwise writable tree', async () => {
    const cwd = fixtureDir('deny-carve')
    mkdirSync(join(cwd, 'secret'), { recursive: true })
    writeFileSync(join(cwd, 'secret', 'key.txt'), 'topsecret')
    // The document shape is exactly what confine() emits for filesystem.deny
    // config; exercised directly so the test needs no second provider.
    const policyFile = join(cwd, '.policy.json')
    writeFileSync(policyFile, JSON.stringify({
      cwd,
      // heimdall-sandbox >= 0.2.0 DENIES denied reads (cat errors) instead
      // of masking them (empty content, exit 0).
      command: ['sh', '-c', '(cat secret/key.txt) 2>/dev/null && echo READ || echo DENIED'],
      stdio: 'inherit',
      filesystem: { writable: [cwd], deny: [join(cwd, 'secret')] },
    }))
    const result = spawnSync(BIN, ['exec', '--policy', policyFile], { encoding: 'utf-8' })
    expect(result.stdout.trim()).toBe('DENIED')
    rmSync(cwd, { recursive: true, force: true })
  })
})
