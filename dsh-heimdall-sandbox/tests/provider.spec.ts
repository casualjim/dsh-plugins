/**
 * Provider tests: argv shape, per-call policy file contents, binary
 * resolution precedence, and lifecycle cleanup. No real confinement here —
 * the exec-level behavior against the installed binary lives in exec.e2e.ts.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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

  it('appends per-project overrides for a matching workspace root', async () => {
    const sandbox = await setup({
      binaryPath: process.execPath,
      extraWritableRoots: ['/global/writable'],
      deniedPaths: ['~/secrets'],
      projects: {
        '/ws/sub': { extraWritableRoots: ['/proj/target'], deniedPaths: ['!~/secrets/allow'] },
      },
    })

    const inside = sandbox.confine(['true'], { mode: 'workspace-write', workspaceRoot: '/ws/sub/app' } as const)
    const insideDoc = JSON.parse(readFileSync(inside.argv[3]!, 'utf-8'))
    expect(insideDoc.filesystem).toEqual({
      writable: ['/ws/sub/app', '/global/writable', '/proj/target'],
      deny: ['~/secrets', '!~/secrets/allow'],
    })

    // unrelated root: global lists only
    const outside = sandbox.confine(['true'], { mode: 'workspace-write', workspaceRoot: '/other' } as const)
    const outsideDoc = JSON.parse(readFileSync(outside.argv[3]!, 'utf-8'))
    expect(outsideDoc.filesystem).toEqual({ writable: ['/other', '/global/writable'], deny: ['~/secrets'] })
  })

  it('prefers the longest matching project key and treats keys as directory boundaries', async () => {
    const sandbox = await setup({
      binaryPath: process.execPath,
      projects: {
        '/ws': { deniedPaths: ['~/shallow'] },
        '/ws/sub/deep': { deniedPaths: ['~/deep'] },
        '/ws/submarine': { deniedPaths: ['~/submarine'] },
      },
    })

    const deep = sandbox.confine(['true'], { mode: 'workspace-write', workspaceRoot: '/ws/sub/deep/x' } as const)
    expect(JSON.parse(readFileSync(deep.argv[3]!, 'utf-8')).filesystem.deny).toEqual(['~/deep'])

    // `/ws/submarine` must not match `/ws/sub*` sibling — boundary-aware prefix
    const sibling = sandbox.confine(['true'], { mode: 'workspace-write', workspaceRoot: '/ws/submarine' } as const)
    expect(JSON.parse(readFileSync(sibling.argv[3]!, 'utf-8')).filesystem.deny).toEqual(['~/submarine'])

    const exact = sandbox.confine(['true'], { mode: 'workspace-write', workspaceRoot: '/ws/sub/other' } as const)
    expect(JSON.parse(readFileSync(exact.argv[3]!, 'utf-8')).filesystem.deny).toEqual(['~/shallow'])
  })

  it('applies workspace grants when .dsh/heimdall.json exists and nothing otherwise', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-heimdall-wsp-'))
    mkdirSync(join(root, '.dsh'), { recursive: true })
    writeFileSync(join(root, '.dsh', 'heimdall.json'), JSON.stringify({
      extraWritableRoots: ['/opt/toolchains'],
      deniedPaths: ['~/secret-project'],
    }))

    const enabled = await setup({ binaryPath: process.execPath })
    const inside = enabled.confine(['true'], { mode: 'workspace-write', workspaceRoot: root } as const)
    const doc = JSON.parse(readFileSync(inside.argv[3]!, 'utf-8'))
    expect(doc.filesystem.writable).toEqual([root, '/opt/toolchains'])
    expect(doc.filesystem.deny).toEqual(['~/secret-project'])

    const bare = mkdtempSync(join(tmpdir(), 'dsh-heimdall-wsp-'))
    const off = enabled.confine(['true'], { mode: 'workspace-write', workspaceRoot: bare } as const)
    expect(JSON.parse(readFileSync(off.argv[3]!, 'utf-8')).filesystem).toEqual({ writable: [bare] })

    rmSync(root, { recursive: true, force: true })
    rmSync(bare, { recursive: true, force: true })
  })

  it('fails loudly on malformed workspace policy', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-heimdall-wsp-'))
    mkdirSync(join(root, '.dsh'), { recursive: true })
    writeFileSync(join(root, '.dsh', 'heimdall.json'), '{ nope')

    const sandbox = await setup({ binaryPath: process.execPath })
    expect(() => sandbox.confine(['true'], { mode: 'workspace-write', workspaceRoot: root } as const))
      .toThrow(/invalid JSON/)

    rmSync(root, { recursive: true, force: true })
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
