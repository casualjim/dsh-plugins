import { describe, expect, it } from 'vitest'
import { WORKTREE_FULL_ACCESS_PRESET, ensureWorktreeFullAccess, hasFullThenRestriction } from '../src/host/permission.js'

const presetService = (overrides: Partial<{ names: readonly string[], current: (s: unknown) => string, resolve: (n: string) => { sandbox: string, approval: string } }> = {}) => ({
  names: ['workspace-write', WORKTREE_FULL_ACCESS_PRESET],
  current: () => 'workspace-write',
  resolve: () => ({ sandbox: 'danger-full-access', approval: 'ask' }),
  ...overrides,
})

describe('worktree full access decision', () => {
  it('applies the preset to a workspace-write session', async () => {
    const applied: Array<{ session: unknown, preset: string }> = []
    const port = {
      sessions: { get: () => ({ id: 's1', events: [] }) },
      permissionPresets: { ...presetService(), set: (session: unknown, preset: string) => { applied.push({ session, preset }) } },
    }
    await expect(ensureWorktreeFullAccess(port, 's1')).resolves.toEqual({ status: 'applied', preset: WORKTREE_FULL_ACCESS_PRESET })
    expect(applied).toHaveLength(1)
    expect(applied[0]?.preset).toBe(WORKTREE_FULL_ACCESS_PRESET)
  })

  it('reports an already-elevated session without writing', async () => {
    const port = {
      sessions: { get: () => ({ id: 's1', events: [] }) },
      permissionPresets: { ...presetService({ current: () => WORKTREE_FULL_ACCESS_PRESET }), set: () => { throw new Error('must not write') } },
    }
    await expect(ensureWorktreeFullAccess(port, 's1')).resolves.toEqual({ status: 'already-full-access', preset: WORKTREE_FULL_ACCESS_PRESET })
  })

  it('preserves a restriction the user chose after full access', async () => {
    expect(hasFullThenRestriction([
      { type: 'permission/preset', data: { preset: WORKTREE_FULL_ACCESS_PRESET } },
      { type: 'permission/preset', data: { preset: 'read-only' } },
    ])).toBe(true)
    expect(hasFullThenRestriction([
      { type: 'permission/preset', data: { preset: WORKTREE_FULL_ACCESS_PRESET } },
    ])).toBe(false)
    const port = {
      sessions: { get: () => ({ id: 's1', events: [{ type: 'permission/preset', data: { preset: WORKTREE_FULL_ACCESS_PRESET } }, { type: 'permission/preset', data: { preset: 'read-only' } }] }) },
      permissionPresets: { ...presetService(), set: () => { throw new Error('must not write') } },
    }
    await expect(ensureWorktreeFullAccess(port, 's1')).resolves.toEqual({ status: 'user-restricted' })
  })

  it('reports unavailable when the preset service or the preset itself is missing', async () => {
    await expect(ensureWorktreeFullAccess({ sessions: { get: () => ({ id: 's1' }) } }, 's1')).resolves.toEqual({ status: 'unavailable' })
    const withoutPreset = { sessions: { get: () => ({ id: 's1' }) }, permissionPresets: { ...presetService({ names: ['workspace-write'] }), set: () => { throw new Error('must not write') } } }
    await expect(ensureWorktreeFullAccess(withoutPreset, 's1')).resolves.toEqual({ status: 'unavailable' })
  })

  it('reports unavailable for an unknown session', async () => {
    const port = { sessions: { get: () => undefined }, permissionPresets: { ...presetService(), set: () => undefined } }
    await expect(ensureWorktreeFullAccess(port, 'gone')).resolves.toEqual({ status: 'unavailable' })
  })

  it('reports unavailable and never writes when the session event log cannot be read', async () => {
    let writes = 0
    const port = {
      sessions: { get: () => ({ id: 's1', snapshotEvents: () => { throw new Error('event log unreadable') } }) },
      permissionPresets: {
        ...presetService({ current: () => 'read-only' }),
        set: () => { writes += 1; throw new Error('must not write') },
      },
    }
    await expect(ensureWorktreeFullAccess(port, 's1')).resolves.toEqual({ status: 'unavailable' })
    expect(writes).toBe(0)
  })

  it('reports already-full-access from the verified current preset even when the event log cannot be read', async () => {
    let writes = 0
    const port = {
      sessions: { get: () => ({ id: 's1', snapshotEvents: () => { throw new Error('event log unreadable') } }) },
      permissionPresets: {
        ...presetService({ current: () => WORKTREE_FULL_ACCESS_PRESET }),
        set: () => { writes += 1; throw new Error('must not write') },
      },
    }
    await expect(ensureWorktreeFullAccess(port, 's1')).resolves.toEqual({ status: 'already-full-access', preset: WORKTREE_FULL_ACCESS_PRESET })
    expect(writes).toBe(0)
  })
})
