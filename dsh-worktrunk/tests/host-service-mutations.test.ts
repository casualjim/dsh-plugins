import { describe, expect, it } from 'vitest'
import { createWorktrunkService } from '../src/host/service.js'

const LIST = JSON.stringify({
  schema: 2,
  repo: { default_branch: 'main' },
  items: [
    { branch: 'main', head: { sha: 'a'.repeat(40), short_sha: 'aaaaaaa', subject: 'init' }, worktree: { path: '/repo', main: true, current: true, changes: {} } },
    { branch: 'feature/a', head: { sha: 'b'.repeat(40), short_sha: 'bbbbbbb', subject: 'work' }, worktree: { path: '/wt/a', main: false, current: false, changes: {} } },
  ],
})

function fakeCtx(script: Array<{ stdout?: string, exitCode?: number }>, registry: Record<string, unknown> = {}) {
  const calls: Array<{ argv: string[], cwd: string }> = []
  const subprocess = {
    spawn(options: { argv: string[], cwd: string }) {
      calls.push({ argv: options.argv, cwd: options.cwd })
      const step = script.shift() ?? { exitCode: 0 }
      const collect = (text: string) => ({ readFrom: () => ({ text }) })
      return { done: Promise.resolve({ exitCode: step.exitCode ?? 0, signal: null }), collected: { stdout: collect(step.stdout ?? ''), stderr: collect('') } }
    },
  }
  const created: Array<{ path: string, label: string }> = []
  const ctx = {
    subprocess,
    get: (name: string) => (name === 'workspaceRegistry'
      ? { list: () => [{ id: 'w1', path: '/repo' }], resolveByPath: async () => undefined, create: async (path: string, label: string) => { created.push({ path, label }) }, ...registry }
      : undefined),
  }
  return { calls, created, ctx }
}

const service = (ctx: unknown) => createWorktrunkService(ctx as never, { bin: 'wt', labelPrefix: '[wt]' })

describe('worktrunk service mutations', () => {
  it('creates with hooks, then registers the worktree workspace', async () => {
    const { ctx, calls, created } = fakeCtx([{ stdout: '' }, { stdout: LIST }])
    const result = await service(ctx).createWorktree({ workspaceId: 'w1', branch: 'feature/a', base: 'main' })
    expect(calls[0]?.argv).toEqual(['wt', 'switch', '--create', 'feature/a', '--base', 'main', '--yes'])
    expect(calls[0]?.cwd).toBe('/repo')
    expect(result).toEqual({ path: '/wt/a', branch: 'feature/a', hooksRan: true })
    expect(created).toEqual([{ path: '/wt/a', label: '[wt] feature/a' }])
  })

  it('maps the skip-hooks toggle to --no-hooks', async () => {
    const { ctx, calls } = fakeCtx([{ stdout: '' }, { stdout: LIST }])
    await service(ctx).createWorktree({ workspaceId: 'w1', branch: 'feature/a', skipHooks: true })
    expect(calls[0]?.argv).toEqual(['wt', 'switch', '--create', 'feature/a', '--no-hooks', '--yes'])
  })

  it('refuses to remove the worktree the current session runs inside', async () => {
    const { ctx } = fakeCtx([{ stdout: LIST }])
    await expect(service(ctx).removeWorktree({ workspaceId: 'w1', branch: 'feature/a', currentCwd: '/wt/a/packages/app' }))
      .rejects.toMatchObject({ code: 'SESSION_WORKTREE' })
  })

  it('removes with the force gates and unregisters the workspace', async () => {
    const { ctx, calls } = fakeCtx([{ stdout: LIST }, { stdout: '' }])
    await expect(service(ctx).removeWorktree({ workspaceId: 'w1', branch: 'feature/a', force: true, forceDeleteBranch: true, currentCwd: '/repo' }))
      .resolves.toEqual({ removed: true })
    expect(calls[1]?.argv).toEqual(['wt', 'remove', '--force', '--force-delete', '--foreground', '--yes', 'feature/a'])
  })

  it('merges inside the worktree path and refuses the session worktree unless kept', async () => {
    const refused = fakeCtx([{ stdout: LIST }])
    await expect(service(refused.ctx).mergeWorktree({ workspaceId: 'w1', branch: 'feature/a', currentCwd: '/wt/a' }))
      .rejects.toMatchObject({ code: 'SESSION_WORKTREE' })

    const kept = fakeCtx([{ stdout: LIST }, { stdout: '' }])
    await expect(service(kept.ctx).mergeWorktree({ workspaceId: 'w1', branch: 'feature/a', target: 'main', keepCommit: true, keepWorktree: true, currentCwd: '/wt/a' }))
      .resolves.toEqual({ merged: true })
    expect(kept.calls[1]?.argv).toEqual(['wt', 'merge', 'main', '--no-squash', '--no-remove', '--yes'])
    expect(kept.calls[1]?.cwd).toBe('/wt/a')
  })

  it('copies gitignored files in an explicit path', async () => {
    const { ctx, calls } = fakeCtx([{ stdout: '' }])
    await expect(service(ctx).copyIgnored({ workspaceId: 'w1', path: '/wt/a', force: true })).resolves.toEqual({ ok: true })
    expect(calls[0]?.argv).toEqual(['wt', 'step', 'copy-ignored', '--force'])
    expect(calls[0]?.cwd).toBe('/wt/a')
  })

  it('opens a worktree by registering it and reports the preset outcome', async () => {
    const { ctx, created } = fakeCtx([])
    await expect(service(ctx).openWorktree({ workspaceId: 'w1', path: '/wt/a', branch: 'feature/a' }))
      .resolves.toEqual({ workspaceId: undefined })
    expect(created).toEqual([{ path: '/wt/a', label: '[wt] feature/a' }])

    const withPresets = fakeCtx([], {})
    const presetCtx = {
      ...withPresets.ctx,
      get: (name: string) => (name === 'permissionPresets'
        ? { names: ['worktree-full-access'], current: () => 'workspace-write', resolve: () => ({ sandbox: 'danger-full-access', approval: 'ask' }), set: () => undefined }
        : name === 'sessions' ? { get: () => ({ id: 's1', events: [] }) } : withPresets.ctx.get(name)),
    }
    await expect(service(presetCtx).ensureWorktreePermission({ sessionId: 's1' })).resolves.toEqual({ status: 'applied', preset: 'worktree-full-access' })
  })
})
