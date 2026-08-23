import { describe, expect, it } from 'vitest'
import { apply, type Config } from '../src/index.ts'

interface Registered {
  readonly skills: Array<Record<string, unknown>>
  readonly commands: Array<Record<string, unknown>>
  readonly sections: Array<Record<string, unknown>>
  readonly plugins: Array<{
    plugin: unknown
    config: { provider: string; toolName: string; persona: string; toolFilter: { allow: string[] }; backgroundMode: string }
  }>
}

function stubContext(): { ctx: Record<string, unknown>; registered: Registered } {
  const registered: Registered = { skills: [], commands: [], sections: [], plugins: [] }
  const ctx = {
    skills: { register: (skill: Record<string, unknown>) => { registered.skills.push(skill) } },
    commands: { register: (command: Record<string, unknown>) => { registered.commands.push(command) } },
    get: (name: string) => (name === 'systemPrompt'
      ? { section: (section: Record<string, unknown>) => { registered.sections.push(section) } }
      : undefined),
    plugin: (plugin: unknown, config: object) => { registered.plugins.push({ plugin, config: config as Registered['plugins'][number]['config'] }) },
  }
  return { ctx, registered }
}

describe('dsh-caveman apply', () => {
  it('registers all six skills and five commands', () => {
    const { ctx, registered } = stubContext()
    apply(ctx as never, {})

    expect(registered.skills.map(skill => skill.name).sort()).toEqual([
      'caveman', 'caveman-commit', 'caveman-review', 'caveman-help', 'caveman-compress', 'cavecrew',
    ].sort())
    expect(registered.commands.map(command => command.name).sort()).toEqual([
      'caveman', 'caveman-commit', 'caveman-review', 'caveman-help', 'caveman-compress',
    ].sort())
    for (const skill of registered.skills) {
      expect(skill.source).toBe('bundled')
      expect(skill.resourceBase).toMatchObject({ kind: 'directory' })
    }
  })

  it('mounts one delegation child fiber per persona with allowlist and one-shot mode', () => {
    const { ctx, registered } = stubContext()
    apply(ctx as never, {})

    expect(registered.plugins.map(entry => entry.config.toolName).sort()).toEqual([
      'cavecrew_builder', 'cavecrew_investigator', 'cavecrew_reviewer',
    ])
    for (const entry of registered.plugins) {
      expect(entry.config.provider).toBe('spawn')
      expect(entry.config.backgroundMode).toBe('one-shot')
      expect(entry.config.persona.length).toBeGreaterThan(200)
      expect(entry.config.toolFilter.allow.length).toBeGreaterThan(0)
      // the allowlist IS the no-grandchildren guard: no delegation tool may survive
      expect(entry.config.toolFilter.allow).not.toContain('subagent')
    }
  })

  it('honors provider and enableCavecrew config', () => {
    const { ctx, registered } = stubContext()
    apply(ctx as never, { provider: 'fork', enableCavecrew: false })

    expect(registered.plugins).toEqual([])
    // skills and commands still register
    expect(registered.skills).toHaveLength(6)
    expect(registered.commands).toHaveLength(5)
  })

  it('registers the always-on section by default (upstream auto-activation)', () => {
    const on = stubContext()
    apply(on.ctx as never, {})
    expect(on.registered.sections).toHaveLength(1)
    expect(on.registered.sections[0]).toMatchObject({ name: 'caveman:always-on', order: 1 })
    expect(String(on.registered.sections[0].text)).toContain('Current intensity: full')
    expect(String(on.registered.sections[0].text)).not.toContain('{{')

    const ultra = stubContext()
    apply(ultra.ctx as never, { defaultMode: 'ultra' })
    expect(String(ultra.registered.sections[0].text)).toContain('Current intensity: ultra')

    const off = stubContext()
    apply(off.ctx as never, { alwaysOn: false })
    expect(off.registered.sections).toEqual([])
  })

  it('commands interpolate args and defaultMode into the followup text', () => {
    const { ctx, registered } = stubContext()
    apply(ctx as never, { defaultMode: 'wenyan-full' })

    const caveman = registered.commands.find(command => command.name === 'caveman') as {
      handler: (args: { agent: { followup: (message: { content: Array<{ text: string }> }) => void }; rawInput: string }) => unknown
    }
    const followups: string[] = []
    const agent = { followup: (message: { content: Array<{ text: string }> }) => { followups.push(message.content[0].text) } }
    const result = caveman.handler({ agent, rawInput: ' ultra ' })

    expect(result).toEqual({ kind: 'success' })
    expect(followups[0]).toContain('caveman ultra mode')
    expect(followups[0]).not.toContain('{{')

    caveman.handler({ agent, rawInput: '' })
    expect(followups[1]).toContain('caveman wenyan-full mode')
  })
})
