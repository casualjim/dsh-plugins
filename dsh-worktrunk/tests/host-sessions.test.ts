import { describe, expect, it } from 'vitest'
import { readSessionHeaders, sessionsForWorktree } from '../src/host/sessions.js'

describe('session header index', () => {
  it('merges live headers with persisted headers, live winning on a shared id', async () => {
    const refs = await readSessionHeaders({
      sessions: { list: () => [{ id: 's1', header: { cwd: '/repo' } }, { id: 's2', header: {} }] },
      sessionPersistence: { list: async () => [{ id: 's1', cwd: '/stale' }, { id: 's3', cwd: '/wt/a' }] },
    })
    expect(refs).toEqual([{ id: 's1', cwd: '/repo' }, { id: 's3', cwd: '/wt/a' }])
  })

  it('returns an empty index without either service, and survives a persistence failure', async () => {
    await expect(readSessionHeaders({})).resolves.toEqual([])
    await expect(readSessionHeaders({ sessionPersistence: { list: async () => { throw new Error('disk') } } })).resolves.toEqual([])
  })

  it('matches sessions by exact worktree path and by a nested cwd', () => {
    const refs = [{ id: 'a', cwd: '/wt/x' }, { id: 'b', cwd: '/wt/x/packages/app' }, { id: 'c', cwd: '/wt/xy' }, { id: 'd', cwd: '/repo' }]
    expect(sessionsForWorktree(refs, '/wt/x').map(ref => ref.id)).toEqual(['a', 'b'])
  })
})
