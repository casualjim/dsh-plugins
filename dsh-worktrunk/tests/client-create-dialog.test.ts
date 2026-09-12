import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CreateDialog, createDialogSummary } from '../src/client/panel/CreateDialog.js'
import type { HookSpec } from '../src/contract.js'

const t = (key: string, params?: Record<string, unknown>) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`)

const hooks: readonly HookSpec[] = [
  { name: 'install', type: 'pre-start', template: 'mise install', source: 'project', needsApproval: true },
  { name: 'copy', type: 'post-start', template: 'wt step copy-ignored', source: 'project', needsApproval: true },
]

describe('create dialog', () => {
  it('summarizes pre-start hooks as blocking and lists every hook', () => {
    const summary = createDialogSummary(hooks, t as never)
    expect(summary.blocking).toBe(true)
    expect(summary.lines).toEqual(['pre-start install: mise install', 'post-start copy: wt step copy-ignored'])
  })

  it('reports no blocking step for post-start-only configuration', () => {
    expect(createDialogSummary([hooks[1]!], t as never).blocking).toBe(false)
  })

  it('renders the skip toggle and every hook command, and omits the toggle when nothing is configured', () => {
    const withHooks = renderToStaticMarkup(createElement(CreateDialog, {
      repo: { root: '/repo', defaultBranch: 'main', forge: null }, hooks, defaultBranch: 'main', currentBranch: 'main',
      t: t as never, onCancel: () => undefined, onSubmit: () => undefined,
    }))
    expect(withHooks).toContain('create.skipHooks')
    expect(withHooks).toContain('mise install')
    expect(withHooks).toContain('wt step copy-ignored')
    expect(withHooks).toContain('create.blocking')

    const withoutHooks = renderToStaticMarkup(createElement(CreateDialog, {
      repo: { root: '/repo', defaultBranch: 'main', forge: null }, hooks: [], defaultBranch: 'main',
      t: t as never, onCancel: () => undefined, onSubmit: () => undefined,
    }))
    expect(withoutHooks).toContain('create.noHooks')
    expect(withoutHooks).not.toContain('create.skipHooks')
  })
})
