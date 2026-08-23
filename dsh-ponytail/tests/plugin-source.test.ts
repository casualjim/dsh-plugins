import { afterEach, describe, expect, it } from 'vitest'
import { apply, filterSkillBodyForMode, normalizeMode, ponytailRuleset, resolveDefaultMode, type Config } from '../src/index.ts'

interface Registered {
  readonly skills: Array<Record<string, unknown>>
  readonly commands: Array<Record<string, unknown>>
  readonly sections: Array<Record<string, unknown>>
}

function stubContext(): { ctx: Record<string, unknown>; registered: Registered } {
  const registered: Registered = { skills: [], commands: [], sections: [] }
  const ctx = {
    skills: { register: (skill: Record<string, unknown>) => { registered.skills.push(skill) } },
    commands: { register: (command: Record<string, unknown>) => { registered.commands.push(command) } },
    get: (name: string) => (name === 'systemPrompt'
      ? { section: (section: Record<string, unknown>) => { registered.sections.push(section) } }
      : undefined),
  }
  return { ctx, registered }
}

const originalEnv = process.env.PONYTAIL_DEFAULT_MODE

afterEach(() => {
  delete process.env.PONYTAIL_DEFAULT_MODE
  if (originalEnv !== undefined) process.env.PONYTAIL_DEFAULT_MODE = originalEnv
})

describe('dsh-ponytail apply', () => {
  it('registers all six skills and six commands', () => {
    const { ctx, registered } = stubContext()
    apply(ctx as never, {})

    expect(registered.skills.map(skill => skill.name).sort()).toEqual([
      'ponytail', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help', 'ponytail-review',
    ].sort())
    expect(registered.commands.map(command => command.name).sort()).toEqual([
      'ponytail', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help', 'ponytail-review',
    ].sort())
    for (const skill of registered.skills) {
      expect(skill.source).toBe('bundled')
      expect(skill.resourceBase).toMatchObject({ kind: 'directory' })
    }
  })

  it('activates the always-on ruleset by default (upstream auto-activation)', () => {
    const { ctx, registered } = stubContext()
    apply(ctx as never, {})

    expect(registered.sections).toHaveLength(1)
    expect(registered.sections[0]).toMatchObject({ name: 'ponytail:always-on', order: 2 })
    const text = String(registered.sections[0].text)
    expect(text).toContain('PONYTAIL MODE ACTIVE — level: full')
    expect(text).toContain('Does this need to exist at all?')
    expect(text).not.toContain('{{')
  })

  it('can be muted with alwaysOn: false while keeping skills and commands', () => {
    const { ctx, registered } = stubContext()
    apply(ctx as never, { alwaysOn: false })

    expect(registered.sections).toEqual([])
    expect(registered.skills).toHaveLength(6)
    expect(registered.commands).toHaveLength(6)
  })

  it('defaultMode: off starts inactive but keeps the row mounted', () => {
    const { ctx, registered } = stubContext()
    apply(ctx as never, { defaultMode: 'off' })

    expect(registered.sections).toEqual([])
    expect(registered.skills).toHaveLength(6)
  })

  it('honors the PONYTAIL_DEFAULT_MODE env var when the row omits defaultMode', () => {
    process.env.PONYTAIL_DEFAULT_MODE = 'ultra'
    const { ctx, registered } = stubContext()
    apply(ctx as never, {})

    expect(registered.sections).toHaveLength(1)
    expect(String(registered.sections[0].text)).toContain('level: ultra')
  })

  it('row defaultMode wins over the env var', () => {
    process.env.PONYTAIL_DEFAULT_MODE = 'ultra'
    const { ctx, registered } = stubContext()
    apply(ctx as never, { defaultMode: 'lite' })

    expect(String(registered.sections[0].text)).toContain('level: lite')
  })

  it('the ruleset is mode-filtered: ultra keeps its row, lite does not', () => {
    const { ctx, registered } = stubContext()
    apply(ctx as never, { defaultMode: 'ultra' })
    const text = String(registered.sections[0].text)

    expect(text).toMatch(/\*\*ultra\*\* \|/)
    expect(text).not.toMatch(/\*\*lite\*\* \|/)
    expect(text).toContain('No cache until a profiler says so')
    expect(text).not.toContain('FYI: `functools.lru_cache`')
  })

  it('commands interpolate args and defaultMode into the followup text', () => {
    const { ctx, registered } = stubContext()
    apply(ctx as never, { defaultMode: 'full' })

    const ponytail = registered.commands.find(command => command.name === 'ponytail') as {
      handler: (args: { agent: { followup: (message: { content: Array<{ text: string }> }) => void }; rawInput: string }) => unknown
    }
    const followups: string[] = []
    const agent = { followup: (message: { content: Array<{ text: string }> }) => { followups.push(message.content[0].text) } }
    const result = ponytail.handler({ agent, rawInput: ' ultra ' })

    expect(result).toEqual({ kind: 'success' })
    expect(followups[0]).toContain('ponytail ultra mode')
    expect(followups[0]).not.toContain('{{')

    ponytail.handler({ agent, rawInput: '' })
    expect(followups[1]).toContain('ponytail full mode')
  })
})

describe('ponytail rule helpers', () => {
  it('normalizeMode accepts the four runtime levels and rejects the rest', () => {
    expect(normalizeMode('Ultra')).toBe('ultra')
    expect(normalizeMode('full')).toBe('full')
    expect(normalizeMode('review')).toBeNull()
    expect(normalizeMode(undefined)).toBeNull()
  })

  it('resolveDefaultMode falls env-var then full', () => {
    expect(resolveDefaultMode({})).toBe('full')
    process.env.PONYTAIL_DEFAULT_MODE = 'lite'
    expect(resolveDefaultMode({})).toBe('lite')
    expect(resolveDefaultMode({ defaultMode: 'ultra' })).toBe('ultra')
  })

  it("filterSkillBodyForMode keeps the ladder verbatim and drops other modes' examples", () => {
    const body = [
      '# Ponytail',
      '',
      '## Intensity',
      '',
      '| Level | What change |',
      "| **lite** | Build what's asked, name the lazier alternative. |",
      '| **full** | The ladder enforced. Default. |',
      '| **ultra** | YAGNI extremist. |',
      '',
      'Example:',
      '- lite: "Done, cache added."',
      '- full: "@lru_cache on the fetch function."',
      '- ultra: "No cache until a profiler says so."',
      '',
      '## The ladder',
      '',
      '1. Does this need to exist at all?',
    ].join('\n')

    const ultra = filterSkillBodyForMode(body, 'ultra')
    expect(ultra).toContain('| **ultra** |')
    expect(ultra).not.toContain('| **lite** |')
    expect(ultra).toContain('No cache until a profiler says so')
    expect(ultra).not.toContain('Done, cache added')
    expect(ultra).toContain('1. Does this need to exist at all?')
  })

  it('ponytailRuleset produces a header + body with no residual frontmatter', () => {
    const text = ponytailRuleset('full')
    expect(text.startsWith('PONYTAIL MODE ACTIVE — level: full')).toBe(true)
    expect(text).not.toContain('---\n')
  })
})