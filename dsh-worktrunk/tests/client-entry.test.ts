import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { apply, createPermissionConfirmation, currentWorkspaceIdOf, describePermissionOutcome, inject, name } from '../src/client/entry.js'
import { PermissionDialog } from '../src/client/panel/PermissionDialog.js'
import { en } from '../src/client/locale.js'

/**
 * The connection service is `{ rpc: { call } }` — `ctx.connection.rpc` is the
 * generic RPC face (DSH's own api-gateway calls `connection.rpc.call`). A stub
 * shaped `{ call }` would pass here while production failed every call.
 *
 * The sessions and workspaces stubs carry the field names their controllers
 * actually publish (`SessionListState`: ids/byId/current; the workspace
 * snapshot: items with workspaceId/sessionIds), so a stub that drifts from the
 * real read face shows up as a failure instead of as a green lie.
 */
function fakeClientCtx() {
  const registered: Array<{ name: string, options: Record<string, unknown> }> = []
  const effects: Array<() => void> = []
  const ctx = {
    connection: { rpc: { call: async () => ({ ok: true, value: { ok: true, value: {} } }) } },
    locale: { register: () => () => undefined, bind: () => (key: string) => key },
    sessions: {
      list: { getSnapshot: () => ({ ids: [], byId: {}, current: undefined }), subscribe: () => () => undefined },
      create: async (_opts?: { cwd?: string }): Promise<never> => 's1' as never,
      open: (_id: never) => undefined,
    },
    workspaces: { list: { getSnapshot: () => ({ items: [] }), subscribe: () => () => undefined } },
    effect: (fn: () => (() => void)) => { effects.push(fn()) },
    slots: {
      inject: (slot: string, callback: () => unknown) => { void slot; callback() },
      register: (options: Record<string, unknown>) => { registered.push({ name: String(options.name), options }); return () => undefined },
    },
  }
  return { ctx, registered, effects }
}

describe('client entry', () => {
  it('registers the panel icon and the keyed main panel under one id', () => {
    const { ctx, registered } = fakeClientCtx()
    apply(ctx as never)
    const names = registered.map(entry => entry.name)
    expect(names).toEqual(['sidebar.panellist', 'main'])
    expect(registered[0]?.options.id).toBe('worktrunk')
    expect(registered[0]?.options.order).toBe(20)
    expect(registered[1]?.options.key).toBe('worktrunk')
    expect(registered[1]?.options.locale).toBe('worktrunk')
    expect(typeof registered[0]?.options.label).toBe('function')
    expect((registered[0]?.options.label as () => string)()).toBe('panel.label')
  })

  it('declares the services it needs and a plugin name', () => {
    expect(name).toBe('dsh-worktrunk-client')
    expect(inject).toEqual(expect.arrayContaining(['connection', 'locale', 'slots', 'sessions']))
  })

  it('decides what each permission outcome means for opening the session', () => {
    expect(describePermissionOutcome('applied')).toEqual({ key: undefined, openSession: true })
    expect(describePermissionOutcome('already-full-access')).toEqual({ key: undefined, openSession: true })
    expect(describePermissionOutcome('user-restricted')).toEqual({ key: 'permission.userRestricted', openSession: true })
    expect(describePermissionOutcome('unavailable')).toEqual({ key: 'permission.unavailable', openSession: false })
  })

  it('only ever names a locale key the dictionary actually has', () => {
    for (const status of ['applied', 'already-full-access', 'user-restricted', 'unavailable', 'something-else']) {
      const { key } = describePermissionOutcome(status)
      expect(key === undefined || key in en, `${status} -> ${String(key)}`).toBe(true)
    }
  })

  it('keeps the outcome mapping exhaustive: an unknown status never claims full access', () => {
    expect(describePermissionOutcome('something-else')).toEqual({ key: 'permission.unavailable', openSession: false })
  })

  it('runs one session creation when the confirmation is submitted twice while the first is in flight', async () => {
    const { ctx } = fakeClientCtx()
    const created: string[] = []
    const opened: string[] = []
    const notices: Array<string | undefined> = []
    let releasePermission: (() => void) | undefined
    ctx.sessions.create = async (opts) => { created.push(String(opts?.cwd)); return 's1' as never }
    ctx.sessions.open = id => { opened.push(String(id)) }

    const confirm = createPermissionConfirmation()
    const input = {
      sessions: ctx.sessions,
      // Deferred: the permission call stays in flight while the second click lands.
      ensurePermission: () => new Promise<{ status: string }>(resolve => { releasePermission = () => resolve({ status: 'applied' }) }),
      notice: (key: string | undefined) => { notices.push(key) },
    }
    const first = confirm(input, '/wt/a')
    const second = confirm(input, '/wt/a')
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(created).toEqual(['/wt/a'])
    expect(second).toBe(first)
    releasePermission?.()
    await Promise.all([first, second])

    expect(created).toEqual(['/wt/a'])
    expect(opened).toEqual(['s1'])
    expect(notices).toEqual([undefined])
  })

  it('resolves the workspace owning the current session, else the first registered one', () => {
    const rows = [
      { workspaceId: 'w1', sessionIds: ['s1'] },
      { workspaceId: 'w2', sessionIds: ['s2'] },
    ]
    expect(currentWorkspaceIdOf(rows, 's2')).toBe('w2')
    expect(currentWorkspaceIdOf(rows, 's9')).toBe('w1')
    expect(currentWorkspaceIdOf(rows, undefined)).toBe('w1')
    expect(currentWorkspaceIdOf(undefined, 's1')).toBeUndefined()
  })

  it('disposes the connection and the store through ctx.effect', () => {
    const { ctx, effects } = fakeClientCtx()
    apply(ctx as never)
    expect(effects.length).toBe(3)
    for (const dispose of effects) expect(typeof dispose).toBe('function')
  })
})

describe('permission dialog', () => {
  const t = (key: string, params?: Record<string, unknown>) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`)

  it('cannot confirm before the acknowledgement is ticked', () => {
    const html = renderToStaticMarkup(createElement(PermissionDialog, {
      cwd: '/wt/a',
      t: t as never,
      onCancel: () => undefined,
      onConfirm: () => undefined,
    }))
    expect(html).toContain('permission.title')
    expect(html).toContain('permission.description:')
    expect(html).toContain('/wt/a')
    expect(html).toContain('permission.enable')
    expect(html).toContain('disabled')
  })
})
