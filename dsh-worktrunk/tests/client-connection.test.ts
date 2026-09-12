import { describe, expect, it } from 'vitest'
import { WORKTRUNK_ENDPOINTS, createWorktrunkConnection } from '../src/client/connection.js'

function fakeRpc(result: unknown) {
  const calls: Array<{ channel: string, endpoint: string, body: unknown, signal?: AbortSignal }> = []
  return {
    calls,
    rpc: {
      call: async (channel: string, endpoint: string, body: unknown, signal?: AbortSignal) => {
        calls.push({ channel, endpoint, body, signal })
        return result
      },
    },
  }
}

const okValue = (value: unknown) => ({ ok: true, value: { ok: true, value } })

describe('worktrunk connection', () => {
  it('calls the /api channel with the documented envelope', async () => {
    const { rpc, calls } = fakeRpc(okValue({ repo: { root: '/repo' }, items: [], hooks: [] }))
    const connection = createWorktrunkConnection(rpc as never)
    const panel = await connection.readPanel({ workspaceId: 'w1' })
    expect(calls[0]?.channel).toBe('/api')
    expect(calls[0]?.endpoint).toBe(WORKTRUNK_ENDPOINTS.readPanel)
    expect(calls[0]?.body).toEqual({ args: { input: { workspaceId: 'w1' } } })
    expect(panel).toMatchObject({ repo: { root: '/repo' } })
  })

  it('turns a gateway failure into a retryable error', async () => {
    const { rpc } = fakeRpc({ ok: false, error: { code: 'GATEWAY_DOWN', message: 'gone', details: {} } })
    const connection = createWorktrunkConnection(rpc as never)
    await expect(connection.readPanel({ workspaceId: 'w1' })).rejects.toMatchObject({ code: 'GATEWAY_DOWN', retryable: true })
  })

  it('turns a domain failure into a non-retryable error carrying the code', async () => {
    const { rpc } = fakeRpc({ ok: true, value: { ok: false, error: { code: 'SESSION_WORKTREE', message: 'refused', details: {} } } })
    const connection = createWorktrunkConnection(rpc as never)
    await expect(connection.removeWorktree({ workspaceId: 'w1', branch: 'b' })).rejects.toMatchObject({ code: 'SESSION_WORKTREE', retryable: false })
  })

  /**
   * Every domain code through the real adapter: a fabricated `{ retryable }` would prove
   * nothing, so each row drives the inner envelope and asserts the flag the panel's Retry
   * button reads. `WT_NOT_INSTALLED` (design §7/§9's retryable setup state) is the row that
   * regressed to `false` when the mapping was blanket-false.
   */
  const domainRetryability: ReadonlyArray<[string, boolean]> = [
    ['WT_NOT_INSTALLED', true],
    ['WT_BUSY', true],
    ['WT_FAILED', true],
    ['HOOK_FAILED', true],
    ['PERMISSION_UNVERIFIED', true],
    ['NOT_A_REPO', true],
    ['NO_INITIAL_COMMIT', true],
    ['NO_LOCAL_BRANCH', true],
    ['WT_BAD_JSON', true],
    ['SESSION_WORKTREE', false],
    ['NOT_FOUND', false],
    ['PRESET_UNAVAILABLE', false],
  ]
  it.each(domainRetryability)('classifies a %s domain failure as retryable=%s', async (code, retryable) => {
    const { rpc } = fakeRpc({ ok: true, value: { ok: false, error: { code, message: 'domain refused', details: {} } } })
    const connection = createWorktrunkConnection(rpc as never)
    await expect(connection.readPanel({ workspaceId: 'w1' })).rejects.toMatchObject({ code, retryable })
  })

  it('aborts in-flight calls on dispose and rejects further ones', async () => {
    let observed: AbortSignal | undefined
    const rpc = { call: (_c: string, _e: string, _b: unknown, signal?: AbortSignal) => { observed = signal; return new Promise(() => {}) } }
    const connection = createWorktrunkConnection(rpc as never)
    void connection.readPanel({ workspaceId: 'w1' }).catch(() => undefined)
    connection.dispose()
    expect(observed?.aborted).toBe(true)
    await expect(connection.readPanel({ workspaceId: 'w1' })).rejects.toMatchObject({ code: 'CLIENT_DISPOSED' })
  })
})
