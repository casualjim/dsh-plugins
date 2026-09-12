import { describe, expect, it } from 'vitest'
import { createPanelStore, worktreeErrorMessageKey } from '../src/client/store.js'
import { WorktrunkConnectionError } from '../src/client/connection.js'
import type { PanelSnapshot } from '../src/contract.js'

const snapshot = (branch: string): PanelSnapshot => ({
  repo: { root: '/repo', defaultBranch: 'main', forge: null },
  items: [{ path: `/wt/${branch}`, branch, isMain: false, isCurrent: false, detached: false, branchMismatch: false, duplicateBranch: false,
    head: null, changes: { staged: false, modified: false, untracked: false, renamed: false, deleted: false, conflicted: false }, upstream: null, sessions: [], registered: false }],
  hooks: [],
})

function deferred<Value>() {
  let resolve!: (value: Value) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<Value>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('panel store', () => {
  it('loads a workspace and keeps one generation per workspace', async () => {
    const store = createPanelStore({ readPanel: async () => snapshot('a') } as never)
    await store.load('w1')
    expect(store.getSnapshot().rows.map(row => row.branch)).toEqual(['a'])
    expect(store.getSnapshot().loading).toBe(false)
  })

  it('keeps ready rows when a later targeted refresh fails', async () => {
    let mode: 'ok' | 'fail' = 'ok'
    const store = createPanelStore({
      readPanel: async () => {
        if (mode === 'fail') throw new WorktrunkConnectionError({ code: 'WORKTRUNK_CONNECTION_FAILED', message: 'down', retryable: true })
        return snapshot('a')
      },
    } as never)
    await store.load('w1')
    mode = 'fail'
    await store.load('w1')
    const state = store.getSnapshot()
    expect(state.rows.map(row => row.branch)).toEqual(['a'])
    expect(state.error).toMatchObject({ code: 'WORKTRUNK_CONNECTION_FAILED' })
  })

  it('drops a stale response that settles after a newer load', async () => {
    const first = deferred<PanelSnapshot>()
    const second = deferred<PanelSnapshot>()
    const queue = [first.promise, second.promise]
    const store = createPanelStore({ readPanel: () => queue.shift() as Promise<PanelSnapshot> } as never)
    const loading = store.load('w1')
    const reloading = store.load('w1')
    second.resolve(snapshot('new'))
    await reloading
    first.resolve(snapshot('old'))
    await loading
    expect(store.getSnapshot().rows.map(row => row.branch)).toEqual(['new'])
  })

  it('drops the previous workspace rows while a different workspace loads', async () => {
    const second = deferred<PanelSnapshot>()
    const store = createPanelStore({
      readPanel: ({ workspaceId }: { workspaceId: string }) => workspaceId === 'w1' ? Promise.resolve(snapshot('a')) : second.promise,
    } as never)
    await store.load('w1')
    expect(store.getSnapshot().rows.map(row => row.branch)).toEqual(['a'])
    const loading = store.load('w2')
    const mid = store.getSnapshot()
    expect(mid.workspaceId).toBe('w2')
    expect(mid.loading).toBe(true)
    expect(mid.rows).toEqual([])
    expect(mid.repo).toBeUndefined()
    second.resolve(snapshot('b'))
    await loading
    const done = store.getSnapshot()
    expect(done.workspaceId).toBe('w2')
    expect(done.rows.map(row => row.branch)).toEqual(['b'])
    expect(done.loading).toBe(false)
  })

  it('drops a late response for a workspace the store no longer holds', async () => {
    const first = deferred<PanelSnapshot>()
    const store = createPanelStore({
      readPanel: ({ workspaceId }: { workspaceId: string }) => workspaceId === 'w1' ? first.promise : Promise.resolve(snapshot('b')),
    } as never)
    const stale = store.load('w1')
    await store.load('w2')
    first.resolve(snapshot('a'))
    await stale
    const state = store.getSnapshot()
    expect(state.workspaceId).toBe('w2')
    expect(state.rows.map(row => row.branch)).toEqual(['b'])
  })

  it('maps known failure codes to locale keys and falls back to the generic one', () => {
    expect(worktreeErrorMessageKey(new WorktrunkConnectionError({ code: 'WT_NOT_INSTALLED', message: '', retryable: false }))).toBe('error.wtNotInstalled')
    expect(worktreeErrorMessageKey(new WorktrunkConnectionError({ code: 'SESSION_WORKTREE', message: '', retryable: false }))).toBe('error.sessionWorktree')
    expect(worktreeErrorMessageKey(new Error('weird'))).toBe('error.unknown')
  })
})
