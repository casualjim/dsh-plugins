import { describe, expect, it } from 'vitest'
import { apply, assertNotSessionWorktree, name as pluginName, parseCommand } from '../src/index.js'
import {
  copyIgnoredArgs,
  createArgs,
  isWithin,
  listWorktrees,
  mergeArgs,
  normalizeEntry,
  removeArgs,
  runWt,
  WtError,
  type WtContext,
} from '../src/wt.js'

/** Scripted subprocess: one queued outcome per spawn call. */
function fakeSubprocess(script: Array<{ exitCode?: number, stdout?: string, stderr?: string }>) {
  const calls: Array<{ argv: string[], cwd: string }> = []
  return {
    calls,
    spawn(options: { argv: string[], cwd: string }) {
      calls.push({ argv: options.argv, cwd: options.cwd })
      const step = script.shift() ?? { exitCode: 0 }
      const collect = (text: string) => ({ readFrom: () => ({ text }) })
      return {
        done: Promise.resolve({ exitCode: step.exitCode ?? 0, signal: null }),
        collected: {
          stdout: collect(step.stdout ?? ''),
          stderr: collect(step.stderr ?? ''),
        },
      }
    },
  }
}

function makeCtx(script: Parameters<typeof fakeSubprocess>[0], registry?: {
  created?: Array<{ path: string, label: string }>
  byPath?: Record<string, { id: string }>
}) {
  const sub = fakeSubprocess(script)
  const created = registry?.created ?? []
  const byPath = registry?.byPath ?? {}
  const ctx = {
    subprocess: sub,
    tools: { register: () => {} },
    commands: { register: () => {} },
    on: () => {},
    get(service: unknown) {
      if (service === 'workspaceRegistry') {
        if (registry === undefined) return undefined
        return {
          create: (path: string, label: string) => { created.push({ path, label }) },
          resolveByPath: (path: string) => (path in byPath ? { id: byPath[path]!.id } : undefined),
          delete: () => {},
        }
      }
      return undefined
    },
  }
  return { ctx, sub, created }
}

describe('argv builders', () => {
  it('builds create argv with defaults', () => {
    expect(createArgs('wt', { branch: 'feat' })).toEqual(['wt', 'switch', '--create', 'feat', '--yes'])
  })

  it('builds create argv with base and hooks off', () => {
    expect(createArgs('wt', { branch: 'feat', base: 'main', hooks: false }))
      .toEqual(['wt', 'switch', '--create', 'feat', '--base', 'main', '--no-hooks', '--yes'])
  })

  it('builds remove argv', () => {
    expect(removeArgs('wt', { branch: 'feat' })).toEqual(['wt', 'remove', '--foreground', '--yes', 'feat'])
    expect(removeArgs('wt', { branch: 'feat', force: true, keepBranch: true }))
      .toEqual(['wt', 'remove', '--force', '--no-delete-branch', '--foreground', '--yes', 'feat'])
    expect(removeArgs('wt', { branch: 'feat', forceDeleteBranch: true }))
      .toEqual(['wt', 'remove', '--force-delete', '--foreground', '--yes', 'feat'])
  })

  it('builds merge argv', () => {
    expect(mergeArgs('wt')).toEqual(['wt', 'merge', '--yes'])
    expect(mergeArgs('wt', { target: 'develop' })).toEqual(['wt', 'merge', 'develop', '--yes'])
    expect(mergeArgs('wt', { keepCommit: true, keepWorktree: true }))
      .toEqual(['wt', 'merge', '--no-squash', '--no-remove', '--yes'])
  })

  it('builds copy-ignored argv', () => {
    expect(copyIgnoredArgs('wt')).toEqual(['wt', 'step', 'copy-ignored'])
    expect(copyIgnoredArgs('wt', { force: true, requireInclude: true }))
      .toEqual(['wt', 'step', 'copy-ignored', '--force', '--require-include'])
  })
})

describe('normalizeEntry', () => {
  it('reads schema 2 (nested worktree/head)', () => {
    const entry = normalizeEntry({
      branch: 'feat',
      worktree: { path: '/repo.feat', main: false, current: true },
      head: { sha: 'abc123', short_sha: 'abc1234', subject: 'Add x' },
    })
    expect(entry).toEqual({
      branch: 'feat', path: '/repo.feat', isMain: false, isCurrent: true,
      headSha: 'abc123', headShortSha: 'abc1234', headSubject: 'Add x',
    })
  })

  it('reads schema 1 (flat path/commit)', () => {
    const entry = normalizeEntry({
      branch: 'feat',
      path: '/repo.feat',
      main: true,
      commit: { sha: 'def456', short_sha: 'def4567', subject: 'Init' },
    })
    expect(entry?.path).toBe('/repo.feat')
    expect(entry?.isMain).toBe(true)
    expect(entry?.headShortSha).toBe('def4567')
  })

  it('returns null without branch or path', () => {
    expect(normalizeEntry({ branch: 'x' })).toBeNull()
    expect(normalizeEntry({ path: '/p' })).toBeNull()
  })
})

describe('listWorktrees', () => {
  it('parses schema 2 envelope', async () => {
    const payload = {
      json_schema: 2,
      items: [{ branch: 'feat', worktree: { path: '/r.feat', main: false, current: false }, head: { sha: 'a', short_sha: 'a', subject: 's' } }],
    }
    const { ctx, sub } = makeCtx([{ stdout: JSON.stringify(payload) }])
    const entries = await listWorktrees(ctx, 'wt', '/repo')
    expect(entries).toHaveLength(1)
    expect(sub.calls[0]?.argv).toEqual(['wt', 'list', '--format=json'])
  })

  it('parses schema 1 bare array', async () => {
    const { ctx } = makeCtx([{ stdout: JSON.stringify([{ branch: 'b', path: '/p' }]) }])
    expect(await listWorktrees(ctx, 'wt', '/repo')).toHaveLength(1)
  })

  it('throws WtError on non-zero exit', async () => {
    const { ctx } = makeCtx([{ exitCode: 1, stderr: 'not a git repo' }])
    await expect(listWorktrees(ctx, 'wt', '/repo')).rejects.toThrow(/not a git repo/)
  })
})

describe('runWt', () => {
  it('maps spawn failure to a friendly WtError', async () => {
    const ctx: WtContext = {
      subprocess: {
        spawn: () => { throw new Error('ENOENT') },
      },
    }
    await expect(runWt(ctx, ['wt', 'list'], '/r')).rejects.toMatchObject({
      code: 'SPAWN_FAILED', message: expect.stringContaining('brew install worktrunk'),
    } satisfies Pick<WtError, 'code' | 'message'>)
  })
})

describe('/wt command', () => {
  it('parses verbs', () => {
    expect(parseCommand('')).toEqual({ kind: 'list' })
    expect(parseCommand('create feat main')).toEqual({ kind: 'create', branch: 'feat', base: 'main' })
    expect(parseCommand('merge feat develop --keep-commit')).toEqual({ kind: 'merge', branch: 'feat', target: 'develop', keepCommit: true, keepWorktree: false })
    expect(parseCommand('merge feat --keep-worktree')).toEqual({ kind: 'merge', branch: 'feat', target: undefined, keepCommit: false, keepWorktree: true })
    expect(parseCommand('merge').kind).toBe('usage')
    expect(parseCommand('remove feat --force')).toEqual({ kind: 'remove', branch: 'feat', force: true })
    expect(parseCommand('open feat')).toEqual({ kind: 'open', branch: 'feat', force: false })
    expect(parseCommand('copy-ignored')).toEqual({ kind: 'copy-ignored' })
    expect(parseCommand('bogus').kind).toBe('unknown')
    expect(parseCommand('create').kind).toBe('usage')
  })
})

describe('session-worktree guard', () => {
  const entry = { branch: 'feat', path: '/repo/wt.feat', isMain: false, isCurrent: false, headSha: null, headShortSha: null, headSubject: null }

  it('refuses when the session cwd is inside the worktree', () => {
    expect(() => assertNotSessionWorktree(entry, '/repo/wt.feat/sub', 'remove')).toThrow(/this session is running inside/)
  })

  it('passes elsewhere and for undefined entries', () => {
    expect(() => assertNotSessionWorktree(entry, '/repo', 'remove')).not.toThrow()
    expect(() => assertNotSessionWorktree(undefined, '/repo/wt.feat', 'remove')).not.toThrow()
  })
})

describe('plugin mounting', () => {
  it('registers tools, command, and hook under the plugin name', () => {
    const tools: unknown[] = []
    const commands: unknown[] = []
    const hooks: Array<[string]> = []
    const ctx = {
      subprocess: fakeSubprocess([]),
      tools: { register: (t: unknown) => { tools.push(t) } },
      commands: { register: (c: unknown) => { commands.push(c) } },
      on: (event: string) => { hooks.push([event]) },
      get: () => undefined,
    }
    apply(ctx as never)
    expect(tools).toHaveLength(5)
    expect(commands).toHaveLength(1)
    expect(hooks).toEqual([['agent/pre-step']])
    expect(pluginName).toBe('dsh-worktrunk')
  })
})

describe('isWithin', () => {
  it('matches self and descendants only', () => {
    expect(isWithin('/r/wt.feat', '/r/wt.feat')).toBe(true)
    expect(isWithin('/r/wt.feat', '/r/wt.feat/sub')).toBe(true)
    expect(isWithin('/r/wt.feat', '/r/wt.feature')).toBe(false)
  })
})
