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

  it('maps known failure codes to locale keys and falls back to the generic one', () => {
    expect(worktreeErrorMessageKey(new WorktrunkConnectionError({ code: 'WT_NOT_INSTALLED', message: '', retryable: false }))).toBe('error.wtNotInstalled')
    expect(worktreeErrorMessageKey(new WorktrunkConnectionError({ code: 'SESSION_WORKTREE', message: '', retryable: false }))).toBe('error.sessionWorktree')
    expect(worktreeErrorMessageKey(new Error('weird'))).toBe('error.unknown')
  })
})
