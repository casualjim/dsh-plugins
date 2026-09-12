import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * End-to-end check of the **built** browser artifact. The GUI lives in the
 * session that runs this suite, so restarting the profile to eyeball the panel
 * is not an option; instead this loads `lib/client.js` exactly as DSH's client
 * module loader does — capture the closure factory, hand it the loader's
 * `require` table, then run the exported `apply` against a stub client context.
 * Seeing the Worktrees row in a live GUI stays a manual step.
 */
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  exports: Record<string, { default: string }>
}
/** The artifact the manifest actually serves for `dsh-worktrunk/client`. */
const clientEntry = resolve(manifest.exports['./client']!.default)
const bundle = readFileSync(clientEntry, 'utf8')

interface LoadedModule {
  readonly id: string
  readonly factory: (require: (id: string) => unknown) => Record<string, unknown>
}

/** Run the bundle against a fake `window.__ModuleLoader__` and capture what it registers. */
function loadBundle(): { module: LoadedModule, exports: Record<string, unknown>, requested: string[] } {
  const loaded: LoadedModule[] = []
  const fakeWindow = { __ModuleLoader__: { load: (module: LoadedModule) => { loaded.push(module) } } }
  new Function('window', bundle)(fakeWindow)

  const module = loaded[0]
  if (module === undefined) throw new Error(`${clientEntry} registered no module`)
  if (typeof module.factory !== 'function') throw new Error(`${clientEntry} registered no factory`)

  // The loader's require table: the bundle's only runtime externals are React
  // and the JSX runtime (every @deepseek-ai import is type-only and erased), so
  // the installed packages are the faithful stand-in — no Proxy no-ops needed.
  const nodeRequire = createRequire(import.meta.url)
  const requested: string[] = []
  const exports = module.factory((id: string) => {
    requested.push(id)
    return nodeRequire(id)
  })
  return { module, exports, requested }
}

/** The client faces `apply` touches, as the client plugin context supplies them. */
function fakeClientCtx() {
  const registered: Array<{ slot: string, options: Record<string, unknown>, component: unknown }> = []
  const ctx = {
    connection: { rpc: { call: async () => ({ ok: true, value: { ok: true, value: {} } }) } },
    locale: { register: () => () => undefined, bind: () => (key: string) => key },
    sessions: {
      list: { getSnapshot: () => ({ ids: [], byId: {}, current: undefined }), subscribe: () => () => undefined },
      create: async () => 's1',
      open: () => undefined,
    },
    workspaces: { list: { getSnapshot: () => ({ items: [] }), subscribe: () => () => undefined } },
    effect: (fn: () => unknown) => { void fn() },
    slots: {
      inject: (slot: string, callback: () => unknown) => { void slot; callback() },
      register: (options: Record<string, unknown>, component: unknown) => {
        registered.push({ slot: String(options.name), options, component })
        return () => undefined
      },
    },
  }
  return { ctx, registered }
}

describe('built client bundle', () => {
  it('is the closure-factory artifact the module loader expects', () => {
    expect(bundle.startsWith('window.__ModuleLoader__.load({')).toBe(true)
    expect(bundle).toContain('id: "dsh-worktrunk"')
    expect(clientEntry.endsWith('/lib/client.js')).toBe(true)
  })

  it('executes the factory with only the loader-provided externals', () => {
    const { module, exports, requested } = loadBundle()
    expect(module.id).toBe('dsh-worktrunk')
    expect(typeof exports.apply).toBe('function')
    expect(requested.length).toBeGreaterThan(0)
    expect([...new Set(requested)].sort()).toEqual(['react', 'react/jsx-runtime'])
  })

  it('registers the sidebar panel entry and the keyed main panel', () => {
    const { exports } = loadBundle()
    const { ctx, registered } = fakeClientCtx()
    ;(exports.apply as (ctx: unknown) => void)(ctx)

    expect(registered.map(entry => entry.slot)).toEqual(['sidebar.panellist', 'main'])

    const sidebar = registered[0]!
    expect(sidebar.options.id).toBe('worktrunk')
    expect(typeof sidebar.options.order).toBe('number')
    expect(sidebar.options.order).toBe(20)
    expect(typeof sidebar.options.label).toBe('function')
    expect((sidebar.options.label as () => unknown)()).toBe('panel.label')
    expect(sidebar.component).toBeTypeOf('function')

    const main = registered[1]!
    expect(main.options.key).toBe('worktrunk')
    expect(main.options.locale).toBe('worktrunk')
    expect(main.component).toBeTypeOf('function')
  })
})
