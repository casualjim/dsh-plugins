import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { rowChips } from '../src/client/panel/rows.js'
import { WorktreePanel } from '../src/client/panel/WorktreePanel.js'
import { createPanelStore } from '../src/client/store.js'
import type { PanelSnapshot } from '../src/contract.js'

const t = (key: string, params?: Record<string, unknown>) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`)

const snapshot: PanelSnapshot = {
  repo: { root: '/repo', defaultBranch: 'main', forge: 'https://github.com/acme/repo' },
  items: [
    { path: '/repo', branch: 'main', isMain: true, isCurrent: false, detached: false, branchMismatch: false, duplicateBranch: false,
      head: { sha: 'a'.repeat(40), shortSha: 'aaaaaaa', subject: 'init', committedAt: null },
      changes: { staged: false, modified: false, untracked: false, renamed: false, deleted: false, conflicted: false }, upstream: null, sessions: [], registered: true },
    { path: '/wt/a', branch: 'feature/a', isMain: false, isCurrent: false, detached: false, branchMismatch: true, duplicateBranch: false,
      head: null, changes: { staged: false, modified: true, untracked: true, renamed: false, deleted: false, conflicted: false },
      upstream: { remote: 'origin', branch: 'feature/a', ahead: 2, behind: 0 }, sessions: [{ id: 's1', cwd: '/wt/a' }], registered: true },
  ],
  hooks: [],
}

describe('panel rendering', () => {
  it('describes a row through chips', () => {
    expect(rowChips(snapshot.items[1]!, t as never)).toEqual(['panel.dirty', 'panel.branchMismatch', 'panel.ahead:{"n":2}'])
    expect(rowChips(snapshot.items[0]!, t as never)).toEqual([])
  })

  it('renders the repository header, the local row, and the sessions count', () => {
    const store = createPanelStore({ readPanel: async () => snapshot } as never)
    const html = renderToStaticMarkup(createElement(WorktreePanel, {
      store: { getSnapshot: () => ({ workspaceId: 'w1', repo: snapshot.repo, rows: snapshot.items, hooks: [], loading: false, error: undefined }), subscribe: () => () => {}, load: async () => {}, setSelection: () => {}, getSelection: () => undefined, dispose: () => {} } as never,
      connection: {} as never,
      t: t as never,
      currentSessionCwd: '/wt/a',
      openSession: () => undefined,
      onCreate: () => undefined,
    }))
    expect(html).toContain('panel.title')
    expect(html).toContain('main')
    expect(html).toContain('feature/a')
    expect(html).toContain('panel.sessions')
  })

  it('renders the empty state, and the retryable error instead of an empty list', () => {
    const empty = renderToStaticMarkup(createElement(WorktreePanel, {
      store: { getSnapshot: () => ({ workspaceId: 'w1', repo: snapshot.repo, rows: [], hooks: [], loading: false, error: undefined }), subscribe: () => () => {}, load: async () => {}, setSelection: () => {}, getSelection: () => undefined, dispose: () => {} } as never,
      connection: {} as never, t: t as never, openSession: () => undefined, onCreate: () => undefined,
    }))
    expect(empty).toContain('panel.empty')

    const failed = renderToStaticMarkup(createElement(WorktreePanel, {
      store: { getSnapshot: () => ({ workspaceId: 'w1', repo: undefined, rows: [], hooks: [], loading: false, error: { code: 'WT_NOT_INSTALLED', retryable: true, message: '' } }), subscribe: () => () => {}, load: async () => {}, setSelection: () => {}, getSelection: () => undefined, dispose: () => {} } as never,
      connection: {} as never, t: t as never, openSession: () => undefined, onCreate: () => undefined,
    }))
    expect(failed).toContain('error.wtNotInstalled')
    expect(failed).toContain('panel.retry')
    expect(failed).not.toContain('panel.empty')
  })
})
