/**
 * Provider tests: argv shape, per-call policy file contents, binary
 * resolution precedence, and lifecycle cleanup. The exec-level behavior
 * against the installed binary lives in exec.spec.ts (no skip gates).
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { DEFAULT_PRIVATE_PATHS, migrateWorkspaceConfig } from 'dsh-heimdall/config'
import { HeimdallSandboxProvider, resolveBinaryPath } from '../src/index.ts'
const WW = { mode: 'workspace-write', workspaceRoot: '/ws' } as const

let realHome: string | undefined

beforeAll(() => {
  // Hermetic: the universal user-level chain (~/.config/heimdall) must not
  // leak real machine config into these expectations.
  realHome = process.env.HOME
  process.env.HOME = mkdtempSync(join(tmpdir(), 'dsh-heimdall-home-'))
})

afterAll(() => {
  if (realHome !== undefined) process.env.HOME = realHome
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
      // generated defaults layer: corpus deny + ~/.pi writable + agent flags
      sshAgent: false,
      gpgAgent: false,
      ageAgent: false,
      filesystem: { deny: [...DEFAULT_PRIVATE_PATHS], writable: ['/ws', '~/.pi'] },
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
      filesystem: { writable: ['/global/writable'], deny: ['~/secrets'] },
      projects: {
        '/ws/sub': { filesystem: { writable: ['/proj/target'], deny: ['!~/secrets/allow'] } },
      },
    })

    const inside = sandbox.confine(['true'], { mode: 'workspace-write', workspaceRoot: '/ws/sub/app' } as const)
    const insideDoc = JSON.parse(readFileSync(inside.argv[3]!, 'utf-8'))
    expect(insideDoc.filesystem).toEqual({
      writable: ['/ws/sub/app', '~/.pi', '/global/writable', '/proj/target'],
      deny: [...DEFAULT_PRIVATE_PATHS, '~/secrets', '!~/secrets/allow'],
    })

    // unrelated root: defaults + global lists only
    const outside = sandbox.confine(['true'], { mode: 'workspace-write', workspaceRoot: '/other' } as const)
    const outsideDoc = JSON.parse(readFileSync(outside.argv[3]!, 'utf-8'))
    expect(outsideDoc.filesystem).toEqual({
      writable: ['/other', '~/.pi', '/global/writable'],
      deny: [...DEFAULT_PRIVATE_PATHS, '~/secrets'],
    })
  })


  it('prefers the longest matching project key and treats keys as directory boundaries', async () => {
    const sandbox = await setup({
      binaryPath: process.execPath,
      projects: {
        '/ws': { filesystem: { deny: ['~/shallow'] } },
        '/ws/sub/deep': { filesystem: { deny: ['~/deep'] } },
        '/ws/submarine': { filesystem: { deny: ['~/submarine'] } },
      },
    })

    const deep = sandbox.confine(['true'], { mode: 'workspace-write', workspaceRoot: '/ws/sub/deep/x' } as const)
    expect(JSON.parse(readFileSync(deep.argv[3]!, 'utf-8')).filesystem.deny).toEqual([...DEFAULT_PRIVATE_PATHS, '~/deep'])

    // `/ws/submarine` must not match `/ws/sub*` sibling — boundary-aware prefix
    const sibling = sandbox.confine(['true'], { mode: 'workspace-write', workspaceRoot: '/ws/submarine' } as const)
    expect(JSON.parse(readFileSync(sibling.argv[3]!, 'utf-8')).filesystem.deny).toEqual([...DEFAULT_PRIVATE_PATHS, '~/submarine'])

    const exact = sandbox.confine(['true'], { mode: 'workspace-write', workspaceRoot: '/ws/sub/other' } as const)
    expect(JSON.parse(readFileSync(exact.argv[3]!, 'utf-8')).filesystem.deny).toEqual([...DEFAULT_PRIVATE_PATHS, '~/shallow'])
  })
  it('applies the sandbox section of the multi-plugin .config/heimdall.json', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-heimdall-wsp-'))
    mkdirSync(join(root, '.config'), { recursive: true })
    writeFileSync(join(root, '.config', 'heimdall.json'), JSON.stringify({
      sandbox: {
        network: 'none',
        sshAgent: true,
        gpgAgent: true,
        filesystem: {
          writable: ['/opt/toolchains', '/var/run/docker.sock'],
          deny: ['fnox.*', '!~/.docker'],
          virtual: { '/inside/tool': '/host/tool' },
        },
      },
      commandPolicies: [{ name: 'other-plugin-section', blocked: ['cat', 'fnox.toml'] }],
    }))

    const sandbox = await setup({ binaryPath: process.execPath })
    const confined = sandbox.confine(['true'], { mode: 'workspace-write', workspaceRoot: root } as const)
    const doc = JSON.parse(readFileSync(confined.argv[3]!, 'utf-8'))
    expect(doc.network).toBe('none')
    expect(doc.sshAgent).toBe(true)
    expect(doc.gpgAgent).toBe(true)
    expect(doc.filesystem.writable).toEqual([root, '~/.pi', '/opt/toolchains', '/var/run/docker.sock'])
    expect(doc.filesystem.deny).toEqual([...DEFAULT_PRIVATE_PATHS, 'fnox.*', '!~/.docker'])
    expect(doc.filesystem.virtual).toEqual({ '/inside/tool': '/host/tool' })

    rmSync(root, { recursive: true, force: true })
  })

  it('applies workspace grants when a sandbox section exists and nothing otherwise', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-heimdall-wsp-'))
    mkdirSync(join(root, '.config'), { recursive: true })
    writeFileSync(join(root, '.config', 'heimdall.json'), JSON.stringify({
      sandbox: { filesystem: { writable: ['/opt/toolchains'], deny: ['~/secret-project'] } },
    }))

    const enabled = await setup({ binaryPath: process.execPath })
    const inside = enabled.confine(['true'], { mode: 'workspace-write', workspaceRoot: root } as const)
    const doc = JSON.parse(readFileSync(inside.argv[3]!, 'utf-8'))
    expect(doc.filesystem.writable).toEqual([root, '~/.pi', '/opt/toolchains'])
    expect(doc.filesystem.deny).toEqual([...DEFAULT_PRIVATE_PATHS, '~/secret-project'])

    const bare = mkdtempSync(join(tmpdir(), 'dsh-heimdall-wsp-'))
    const off = enabled.confine(['true'], { mode: 'workspace-write', workspaceRoot: bare } as const)
    expect(JSON.parse(readFileSync(off.argv[3]!, 'utf-8')).filesystem).toEqual({
      deny: [...DEFAULT_PRIVATE_PATHS],
      writable: [bare, '~/.pi'],
    })

    // file present but no sandbox section (other plugins only): defaults apply
    const siblings = mkdtempSync(join(tmpdir(), 'dsh-heimdall-wsp-'))
    mkdirSync(join(siblings, '.config'), { recursive: true })
    writeFileSync(join(siblings, '.config', 'heimdall.json'), JSON.stringify({
      commandPolicies: [{ name: 'only-commands', blocked: ['cargo', 'clippy'] }],
    }))
    const sibling = enabled.confine(['true'], { mode: 'workspace-write', workspaceRoot: siblings } as const)
    expect(JSON.parse(readFileSync(sibling.argv[3]!, 'utf-8')).filesystem).toEqual({
      deny: [...DEFAULT_PRIVATE_PATHS],
      writable: [siblings, '~/.pi'],
    })


    rmSync(root, { recursive: true, force: true })
    rmSync(bare, { recursive: true, force: true })
    rmSync(siblings, { recursive: true, force: true })
  })

  it('merges the user-level sandbox section under the workspace section', async () => {
    const home = process.env.HOME!
    mkdirSync(join(home, '.config', 'heimdall'), { recursive: true })
    writeFileSync(join(home, '.config', 'heimdall', 'config.json'), JSON.stringify({
      sandbox: {
        gpgAgent: true,
        filesystem: { writable: ['/global/w'], deny: ['~/g-secret'] },
      },
    }))
    const root = mkdtempSync(join(tmpdir(), 'dsh-heimdall-wsp-'))
    mkdirSync(join(root, '.config'), { recursive: true })
    writeFileSync(join(root, '.config', 'heimdall.json'), JSON.stringify({
      sandbox: { gpgAgent: false, filesystem: { writable: ['/local/w'] } },
    }))

    const sandbox = await setup({ binaryPath: process.execPath })
    const confined = sandbox.confine(['true'], { mode: 'workspace-write', workspaceRoot: root } as const)
    const doc = JSON.parse(readFileSync(confined.argv[3]!, 'utf-8'))
    // lists append global -> workspace; scalars take the most specific layer
    expect(doc.filesystem.writable).toEqual([root, '~/.pi', '/global/w', '/local/w'])
    expect(doc.filesystem.deny).toEqual([...DEFAULT_PRIVATE_PATHS, '~/g-secret'])
    expect(doc.gpgAgent).toBe(false)

    rmSync(join(home, '.config', 'heimdall', 'config.json'), { force: true })
    rmSync(root, { recursive: true, force: true })
  })

  it('fails loudly on malformed universal workspace policy', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-heimdall-wsp-'))
    mkdirSync(join(root, '.config'), { recursive: true })
    writeFileSync(join(root, '.config', 'heimdall.json'), '{ nope')

    const sandbox = await setup({ binaryPath: process.execPath })
    expect(() => sandbox.confine(['true'], { mode: 'workspace-write', workspaceRoot: root } as const))
      .toThrow(/invalid JSON/)

    rmSync(root, { recursive: true, force: true })
  })

  it('merges the full heimdall fragment across config layers', async () => {
    const sandbox = await setup({
      binaryPath: process.execPath,
      network: 'none',
      proc: 'default',
      env: { allow: ['PATH'], deny: ['AWS_SECRET_ACCESS_KEY'] },
      sshAgent: true,
      gpgAgent: false,
      filesystem: { virtual: { '/inside/tool': '/host/tool' } },
      projects: {
        '/ws': {
          network: 'host',
          env: { deny: ['GITHUB_TOKEN'] },
          filesystem: { virtual: { '/inside/data': '/host/data' } },
          ageAgent: true,
        },
      },
    })

    const confined = sandbox.confine(['true'], { mode: 'workspace-write', workspaceRoot: '/ws/app' } as const)
    const doc = JSON.parse(readFileSync(confined.argv[3]!, 'utf-8'))
    // scalars: most specific layer wins; agent flags default to unset
    expect(doc.network).toBe('host')
    expect(doc.proc).toBe('default')
    expect(doc.sshAgent).toBe(true)
    expect(doc.gpgAgent).toBe(false)
    expect(doc.ageAgent).toBe(true)
    // lists concat across layers; virtual mounts merge by key
    expect(doc.env).toEqual({ allow: ['PATH'], deny: ['AWS_SECRET_ACCESS_KEY', 'GITHUB_TOKEN'] })
    expect(doc.filesystem.virtual).toEqual({ '/inside/tool': '/host/tool', '/inside/data': '/host/data' })
    // defaults still apply when no layer defines fragment fields: agent
    // flags false, corpus deny + ~/.pi writable; network/env stay absent
    const noFragment = await setup({ binaryPath: process.execPath })
    const plain = noFragment.confine(['true'], { mode: 'workspace-write', workspaceRoot: '/other' } as const)
    const plainDoc = JSON.parse(readFileSync(plain.argv[3]!, 'utf-8'))
    expect(plainDoc.network).toBeUndefined()
    expect(plainDoc.env).toBeUndefined()
    expect(plainDoc.sshAgent).toBe(false)
    expect(plainDoc.gpgAgent).toBe(false)
    expect(plainDoc.ageAgent).toBe(false)
    expect(plainDoc.filesystem.deny).toEqual([...DEFAULT_PRIVATE_PATHS])
    expect(plainDoc.filesystem.writable).toEqual(['/other', '~/.pi'])
    expect(plainDoc.filesystem.virtual).toBeUndefined()
  })
  it('sees a legacy .dsh workspace policy after dsh-heimdall migrated it into .config', async () => {
    // The dsh-heimdall guard plugin migrates-and-deletes legacy
    // {,.pi,.omp}/heimdall.json files on ITS first load. Regression: the
    // provider must find the sandbox section at the universal location the
    // migration lands it in — never silently lose the workspace opt-in.
    const root = mkdtempSync(join(tmpdir(), 'dsh-heimdall-wsp-'))
    mkdirSync(join(root, '.dsh'), { recursive: true })
    writeFileSync(join(root, '.dsh', 'heimdall.json'), JSON.stringify({
      sandbox: { filesystem: { writable: ['/opt/toolchains'], deny: ['~/secret-project'] } },
    }))

    // Simulate the guard plugin's migrate pass (the provider's loader runs
    // the same migration before reading universal locations).
    migrateWorkspaceConfig(root)
    const sandbox = await setup({ binaryPath: process.execPath })
    const confined = sandbox.confine(['true'], { mode: 'workspace-write', workspaceRoot: root } as const)
    const doc = JSON.parse(readFileSync(confined.argv[3]!, 'utf-8'))
    expect(doc.filesystem.writable).toEqual([root, '~/.pi', '/opt/toolchains'])
    expect(doc.filesystem.deny).toEqual([...DEFAULT_PRIVATE_PATHS, '~/secret-project'])
    expect(existsSync(join(root, '.dsh', 'heimdall.json'))).toBe(false)

    rmSync(root, { recursive: true, force: true })
  })

  it('migrates a legacy user-global .dsh policy into ~/.config/heimdall and applies it', async () => {
    const home = process.env.HOME!
    mkdirSync(join(home, '.dsh'), { recursive: true })
    writeFileSync(join(home, '.dsh', 'heimdall.json'), JSON.stringify({
      sandbox: { gpgAgent: true, filesystem: { writable: ['/global/w'] } },
    }))

    const root = mkdtempSync(join(tmpdir(), 'dsh-heimdall-wsp-'))
    const sandbox = await setup({ binaryPath: process.execPath })
    const confined = sandbox.confine(['true'], { mode: 'workspace-write', workspaceRoot: root } as const)
    const doc = JSON.parse(readFileSync(confined.argv[3]!, 'utf-8'))
    expect(doc.filesystem.writable).toEqual([root, '~/.pi', '/global/w'])
    expect(doc.gpgAgent).toBe(true)
    // migration happened under the provider's loader
    expect(existsSync(join(home, '.dsh', 'heimdall.json'))).toBe(false)
    expect(existsSync(join(home, '.config', 'heimdall', 'config.json'))).toBe(true)

    rmSync(join(home, '.config', 'heimdall', 'config.json'), { force: true })
    rmSync(root, { recursive: true, force: true })
  })

  it('fails loudly on a malformed user-level universal config', async () => {
    const home = process.env.HOME!
    mkdirSync(join(home, '.config', 'heimdall'), { recursive: true })
    writeFileSync(join(home, '.config', 'heimdall', 'config.json'), '{ nope')

    const sandbox = await setup({ binaryPath: process.execPath })
    expect(() => sandbox.confine(['true'], WW)).toThrow(/invalid JSON/)

    rmSync(join(home, '.config', 'heimdall', 'config.json'), { force: true })
  })

  it('generates default.jsonc on a fresh home and confines with the 44-entry corpus', async () => {
    const home = process.env.HOME!
    // Fresh home: no ~/.config/heimdall at all. confine() must regenerate
    // the corpus file and fold it as the most-general layer.
    const sandbox = await setup({ binaryPath: process.execPath })
    const confined = sandbox.confine(['true'], { mode: 'workspace-write', workspaceRoot: '/ws' } as const)
    const doc = JSON.parse(readFileSync(confined.argv[3]!, 'utf-8'))

    const defaultPath = join(home, '.config', 'heimdall', 'default.jsonc')
    expect(existsSync(defaultPath)).toBe(true)
    // default.jsonc is JSONC (leading comments) — strip before parsing
    const generated = JSON.parse(
      readFileSync(defaultPath, 'utf-8').split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n'),
    ).sandbox
    expect(generated.useDefaultFilesystemDeny).toBe(true)
    expect(generated.filesystem.writable).toEqual(['~/.pi'])
    // 44 entries — a dropped or renamed entry (e.g. `~/.config`) is a
    // silent sandbox widening, so the count AND the content are pinned.
    expect(generated.filesystem.deny).toHaveLength(44)
    expect(generated.filesystem.deny).toContain('~/.config')
    expect(doc.filesystem.deny).toEqual(generated.filesystem.deny)
    expect(doc.filesystem.writable).toEqual(['/ws', '~/.pi'])
    expect(doc.sshAgent).toBe(false)
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
