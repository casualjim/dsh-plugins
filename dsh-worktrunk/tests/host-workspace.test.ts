import { describe, expect, it } from 'vitest'
import { registerWorkspace, resolveWorkspacePath, unregisterWorkspace } from '../src/host/workspace.js'

function fakeCtx(registry: unknown) {
  return { get: (name: string) => (name === 'workspaceRegistry' ? registry : undefined) }
}

describe('workspace seam', () => {
  it('creates a registration once and skips an existing path', async () => {
    const created: Array<{ path: string, label: string }> = []
    const registry = {
      resolveByPath: async () => undefined,
      create: async (path: string, label: string) => { created.push({ path, label }) },
    }
    await expect(registerWorkspace(fakeCtx(registry) as never, '/wt/a', 'feature/a', '[wt]')).resolves.toBeUndefined()
    expect(created).toEqual([{ path: '/wt/a', label: '[wt] feature/a' }])

    const existing = { resolveByPath: async () => ({ id: 'w1' }), create: async () => { throw new Error('must not create') } }
    await expect(registerWorkspace(fakeCtx(existing) as never, '/wt/a', 'feature/a', '[wt]')).resolves.toBeUndefined()
  })

  it('reports a registry failure as a warning instead of throwing', async () => {
    const registry = { resolveByPath: async () => { throw new Error('registry down') }, create: async () => undefined }
    await expect(registerWorkspace(fakeCtx(registry) as never, '/wt/a', 'feature/a', '[wt]'))
      .resolves.toBe('workspace registration skipped: registry down')
  })

  it('resolves a workspace path from get() or list()', async () => {
    expect(await resolveWorkspacePath(fakeCtx({ get: (id: string) => (id === 'w1' ? { id: 'w1', path: '/repo' } : undefined) }) as never, 'w1'))
      .toBe('/repo')
    expect(await resolveWorkspacePath(fakeCtx({ list: () => [{ id: 'w2', path: '/other' }] }) as never, 'w2'))
      .toBe('/other')
    expect(await resolveWorkspacePath(fakeCtx({}) as never, 'w3')).toBeUndefined()
  })

  it('deletes an existing registration and ignores a missing one', async () => {
    const deleted: string[] = []
    const registry = { resolveByPath: async () => ({ id: 'w9' }), delete: async (id: string) => { deleted.push(id) } }
    await unregisterWorkspace(fakeCtx(registry) as never, '/wt/a')
    expect(deleted).toEqual(['w9'])
    await expect(unregisterWorkspace(fakeCtx({ resolveByPath: async () => undefined }) as never, '/wt/a')).resolves.toBeUndefined()
  })
})
