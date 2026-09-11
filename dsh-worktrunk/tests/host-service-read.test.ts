import { describe, expect, it } from 'vitest'
import { createWorktrunkService } from '../src/host/service.js'

const LIST = JSON.stringify({
  schema: 2,
  repo: { default_branch: 'main', forge: { url: 'https://github.com/acme/repo' } },
  items: [
    { branch: 'main', head: { sha: 'a'.repeat(40), short_sha: 'aaaaaaa', subject: 'init' },
      worktree: { path: '/repo', main: true, current: true, changes: {} } },
    { branch: 'feature/a', head: { sha: 'b'.repeat(40), short_sha: 'bbbbbbb', subject: 'work' },
      worktree: { path: '/wt/a', main: false, current: false, changes: { modified: true } } },
  ],
})
const HOOKS = JSON.stringify([{ name: 'install', needs_approval: true, source: 'project', template: 'mise install', type: 'pre-start' }])

function fakeCtx(script: Array<{ stdout?: string, exitCode?: number }>, services: Record<string, unknown> = {}) {
  const calls: Array<{ argv: string[], cwd: string }> = []
  const subprocess = {
    spawn(options: { argv: string[], cwd: string }) {
      calls.push({ argv: options.argv, cwd: options.cwd })
      const step = script.shift() ?? { exitCode: 0 }
      const collect = (text: string) => ({ readFrom: () => ({ text }) })
      return {
        done: Promise.resolve({ exitCode: step.exitCode ?? 0, signal: null }),
        collected: { stdout: collect(step.stdout ?? ''), stderr: collect('') },
      }
    },
  }
  return {
    calls,
    ctx: {
      subprocess,
      get: (name: string) => (name === 'workspaceRegistry' ? services.workspaceRegistry : services[name]),
    },
  }
}

describe('worktrunk service reads', () => {
  it('reads repo facts, rows, hooks, and cwd-matched sessions', async () => {
    const { ctx, calls } = fakeCtx([{ stdout: LIST }, { stdout: '[]' }, { stdout: HOOKS }], {
      workspaceRegistry: {
        get: (id: string) => (id === 'w1' ? { id: 'w1', path: '/repo' } : undefined),
        list: () => [{ id: 'w1', path: '/repo' }],
        resolveByPath: async (path: string) => (path === '/wt/a' ? { id: 'w2' } : undefined),
      },
      sessions: { list: () => [{ id: 's1', header: { cwd: '/wt/a' } }, { id: 's2', header: { cwd: '/repo' } }] },
    })
    const service = createWorktrunkService(ctx as never, { bin: 'wt', labelPrefix: '[wt]' })
    const panel = await service.readPanel({ workspaceId: 'w1' })

    expect(calls.map(call => call.argv.join(' '))).toEqual(['wt list --format=json', 'wt list --format=json', 'wt hook show --format=json'])
    expect(panel.repo).toEqual({ root: '/repo', defaultBranch: 'main', forge: 'https://github.com/acme/repo' })
    expect(panel.items).toHaveLength(2)
    expect(panel.items[0]?.registered).toBe(true)
    expect(panel.items[1]?.sessions).toEqual([{ id: 's1', cwd: '/wt/a' }])
    expect(panel.items[1]?.changes.modified).toBe(true)
    expect(panel.hooks).toEqual([{ name: 'install', needsApproval: true, source: 'project', template: 'mise install', type: 'pre-start' }])
  })

  it('degrades to no hooks instead of failing the panel read', async () => {
    const { ctx } = fakeCtx([{ stdout: LIST }, { stdout: LIST }, { exitCode: 1 }], { workspaceRegistry: { list: () => [{ id: 'w1', path: '/repo' }] } })
    const service = createWorktrunkService(ctx as never, { bin: 'wt', labelPrefix: '[wt]' })
    await expect(service.readPanel({ workspaceId: 'w1' })).resolves.toMatchObject({ hooks: [] })
  })

  it('reports an unknown workspace as NOT_FOUND', async () => {
    const { ctx } = fakeCtx([])
    const service = createWorktrunkService(ctx as never, { bin: 'wt', labelPrefix: '[wt]' })
    await expect(service.readPanel({ workspaceId: 'missing' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
