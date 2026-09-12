import { describe, expect, it } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { readSessionHeaders, sessionsForWorktree } from '../src/host/sessions.js'

/**
 * `ctx.sessionPersistence.list()` publishes `SessionPersistenceSnapshot[]` — the header is
 * NESTED (`{ header: { id, cwd }, revision, sizeBytes }`), never `{ id, cwd }`. The stubs below
 * carry that real nesting plus the sibling snapshot fields, so reading a top-level id/cwd drops
 * every persisted session and fails here.
 */
const persisted = (id: string, cwd?: string) => ({ header: { id: SessionId(id), ...(cwd === undefined ? {} : { cwd }) }, revision: 'r1', sizeBytes: 128 })

describe('session header index', () => {
  it('merges live headers with persisted headers, live winning on a shared id', async () => {
    const refs = await readSessionHeaders({
      sessions: { list: () => [{ id: 's1', header: { cwd: '/repo' } }, { id: 's2', header: {} }] },
      sessionPersistence: { list: async () => [persisted('s1', '/stale'), persisted('s3', '/wt/a')] },
    })
    expect(refs).toEqual([{ id: 's1', cwd: '/repo' }, { id: 's3', cwd: '/wt/a' }])
  })

  it('keeps a persisted session that has no live counterpart', async () => {
    const refs = await readSessionHeaders({
      sessions: { list: () => [{ id: 'live', header: { cwd: '/repo' } }] },
      sessionPersistence: { list: async () => [persisted('stored-a', '/wt/a'), persisted('stored-b', '/wt/b')] },
    })
    expect(refs).toEqual([{ id: 'live', cwd: '/repo' }, { id: 'stored-a', cwd: '/wt/a' }, { id: 'stored-b', cwd: '/wt/b' }])
  })

  it('returns an empty index without either service, and survives a persistence failure', async () => {
    await expect(readSessionHeaders({})).resolves.toEqual([])
    await expect(readSessionHeaders({ sessionPersistence: { list: async () => { throw new Error('disk') } } })).resolves.toEqual([])
  })

  it('drops a persisted snapshot whose header carries no cwd', async () => {
    await expect(readSessionHeaders({ sessionPersistence: { list: async () => [persisted('s9')] } })).resolves.toEqual([])
  })

  it('matches sessions by exact worktree path and by a nested cwd', () => {
    const refs = [{ id: 'a', cwd: '/wt/x' }, { id: 'b', cwd: '/wt/x/packages/app' }, { id: 'c', cwd: '/wt/xy' }, { id: 'd', cwd: '/repo' }]
    expect(sessionsForWorktree(refs, '/wt/x').map(ref => ref.id)).toEqual(['a', 'b'])
  })
})
