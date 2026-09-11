import { describe, expect, it } from 'vitest'
import {
  WORKTREE_ERROR_CODES,
  createWorktrunkFailure,
  type WorktreeRow,
} from '../src/contract.js'

describe('contract', () => {
  it('exposes the stable error codes without duplicates', () => {
    expect(new Set(WORKTREE_ERROR_CODES).size).toBe(WORKTREE_ERROR_CODES.length)
    expect(WORKTREE_ERROR_CODES).toContain('SESSION_WORKTREE')
    expect(WORKTREE_ERROR_CODES).toContain('PRESET_UNAVAILABLE')
    expect(WORKTREE_ERROR_CODES).toContain('WT_NOT_INSTALLED')
    expect(WORKTREE_ERROR_CODES).toContain('WT_BUSY')
  })

  it('builds a failure whose details are always present', () => {
    const failure = createWorktrunkFailure('WT_FAILED', 'boom')
    expect(failure).toEqual({ code: 'WT_FAILED', message: 'boom', details: {} })
  })

  it('keeps a worktree row JSON-serializable', () => {
    const row: WorktreeRow = {
      path: '/tmp/wt-a',
      branch: 'feature/a',
      isMain: false,
      isCurrent: true,
      detached: false,
      branchMismatch: false,
      duplicateBranch: false,
      head: { sha: 'a'.repeat(40), shortSha: 'aaaaaaa', subject: 'init', committedAt: '2026-09-11T00:00:00Z' },
      changes: { staged: false, modified: false, untracked: false, renamed: false, deleted: false, conflicted: false },
      upstream: null,
      sessions: [{ id: 's1', cwd: '/tmp/wt-a' }],
      registered: false,
    }
    expect(JSON.parse(JSON.stringify(row))).toEqual(row)
  })
})
