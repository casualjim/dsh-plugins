import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RemoveDialog, removeDialogBlocked, removeDialogFacts, removeDialogSubmit } from '../src/client/panel/RemoveDialog.js'
import type { WorktreeRow } from '../src/contract.js'

const t = (key: string, params?: Record<string, unknown>) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`)
const clean = { staged: false, modified: false, untracked: false, renamed: false, deleted: false, conflicted: false }
const row = (overrides: Partial<WorktreeRow> = {}): WorktreeRow => ({
  path: '/wt/a', branch: 'feature/a', isMain: false, isCurrent: false, detached: false, branchMismatch: false, duplicateBranch: false,
  head: null, changes: clean, upstream: null, sessions: [], registered: true, ...overrides,
})

describe('remove dialog', () => {
  it('requires force for a dirty worktree and names the changes', () => {
    const facts = removeDialogFacts(row({ changes: { ...clean, modified: true, untracked: true } }), t as never)
    expect(facts.needsForce).toBe(true)
    expect(facts.canDeleteBranch).toBe(true)
    expect(facts.lines).toContain('remove.dirty')
  })

  it('never offers branch deletion for a detached HEAD', () => {
    const facts = removeDialogFacts(row({ detached: true }), t as never)
    expect(facts.canDeleteBranch).toBe(false)
    expect(facts.lines).toContain('remove.detached')
  })

  it('renders the path, the branch, and the unmerged-branch choice', () => {
    const html = renderToStaticMarkup(createElement(RemoveDialog, {
      row: row({ changes: { ...clean, modified: true } }), unmerged: true, t: t as never, onCancel: () => undefined, onSubmit: () => undefined,
    }))
    expect(html).toContain('/wt/a')
    expect(html).toContain('feature/a')
    expect(html).toContain('remove.force')
    expect(html).toContain('remove.forceDeleteBranch')
  })

  it('pins the force gate: dirty + unticked disables submit and never calls onSubmit', () => {
    const dirty = row({ changes: { ...clean, modified: true } })
    const blockedHtml = renderToStaticMarkup(createElement(RemoveDialog, {
      row: dirty, unmerged: true, t: t as never, onCancel: () => undefined, onSubmit: () => undefined,
    }))
    expect(blockedHtml).toContain('<button type="submit" disabled=""')
    expect(removeDialogBlocked(removeDialogFacts(dirty, t as never).needsForce, false)).toBe(true)

    const cleanHtml = renderToStaticMarkup(createElement(RemoveDialog, {
      row: row(), unmerged: true, t: t as never, onCancel: () => undefined, onSubmit: () => undefined,
    }))
    expect(cleanHtml).toContain('<button type="submit">')
    expect(removeDialogBlocked(removeDialogFacts(row(), t as never).needsForce, false)).toBe(false)

    const calls: Array<{ force: boolean, forceDeleteBranch: boolean, keepBranch: boolean }> = []
    removeDialogSubmit({ needsForce: true }, { force: false, forceDeleteBranch: false, keepBranch: false }, input => calls.push(input))
    expect(calls).toEqual([])
    removeDialogSubmit({ needsForce: true }, { force: true, forceDeleteBranch: false, keepBranch: true }, input => calls.push(input))
    expect(calls).toEqual([{ force: true, forceDeleteBranch: false, keepBranch: true }])
  })
})
