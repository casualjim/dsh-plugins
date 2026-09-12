import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MergeDialog, mergeHooks } from '../src/client/panel/MergeDialog.js'
import type { HookSpec, WorktreeRow } from '../src/contract.js'

const t = (key: string, params?: Record<string, unknown>) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`)
const clean = { staged: false, modified: false, untracked: false, renamed: false, deleted: false, conflicted: false }
const row: WorktreeRow = { path: '/wt/a', branch: 'feature/a', isMain: false, isCurrent: false, detached: false, branchMismatch: false, duplicateBranch: false,
  head: null, changes: clean, upstream: null, sessions: [], registered: true }
const hooks: readonly HookSpec[] = [
  { name: 'test', type: 'pre-merge', template: 'pnpm test', source: 'project', needsApproval: true },
  { name: 'install', type: 'pre-start', template: 'mise install', source: 'project', needsApproval: true },
]

describe('merge dialog', () => {
  it('lists only pre-merge hooks', () => {
    expect(mergeHooks(hooks, t as never)).toEqual(['pre-merge test: pnpm test'])
  })

  it('renders the default target, both keep options, and the pre-merge hook', () => {
    const html = renderToStaticMarkup(createElement(MergeDialog, {
      row, defaultBranch: 'main', hooks, isCurrentSessionWorktree: true, t: t as never, onCancel: () => undefined, onSubmit: () => undefined,
    }))
    expect(html).toContain('main')
    expect(html).toContain('merge.keepCommit')
    expect(html).toContain('merge.keepWorktree')
    expect(html).toContain('pnpm test')
    expect(html).toContain('merge.hooks')
  })
})
