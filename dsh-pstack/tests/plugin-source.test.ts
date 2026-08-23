import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { apply, parsePersona } from '../src/index.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

interface FakeSection {
  name: string
  order: number
  text: string | (() => string)
}

function fakeCtx() {
  const skills: unknown[] = []
  const commands: Array<{ name: string; description: string; handler: (invocation: unknown) => unknown }> = []
  const plugins: unknown[] = []
  let section: FakeSection | undefined
  const ctx = {
    skills: { register: (skill: unknown) => { skills.push(skill) } },
    commands: { register: (command: unknown) => { commands.push(command as never) } },
    get: (name: string) => name === 'systemPrompt'
      ? { section: (entry: FakeSection) => { section = entry } }
      : undefined,
    plugin: (plugin: unknown, config: unknown) => { plugins.push({ plugin, config }) },
  } as unknown as Context
  return { ctx, skills, commands, plugins, section: () => section }
}

describe('dsh-pstack plugin', () => {
  it('parses bundled personas into subagent tool configs', () => {
    const poteto = parsePersona(path.join(root, 'agents', 'poteto-agent.md'))
    expect(poteto.toolName).toBe('poteto_agent')
    expect(poteto.tools).toBeUndefined()
    expect(poteto.persona).toContain('poteto-mode')

    const sicko = parsePersona(path.join(root, 'agents', 'comment-sicko.md'))
    expect(sicko.toolName).toBe('comment_sicko')
    expect(sicko.tools).toEqual(['read', 'grep', 'glob', 'bash'])
    expect(sicko.persona).toContain('MUST KILL')
  })

  it('registers all skills, both commands, the sticky section, and both personas', () => {
    const { ctx, skills, commands, plugins, section } = fakeCtx()
    apply(ctx)

    expect(skills.length).toBe(44)
    expect(commands.map(command => command.name).sort()).toEqual(['poteto-mode', 'setup-pstack'])
    expect(section()).toEqual({
      name: 'pstack:poteto-mode',
      order: 2,
      text: expect.any(Function) as unknown,
    })
    expect(plugins.length).toBe(2)
    const configs = plugins.map(entry => (entry as { config: Record<string, unknown> }).config)
    const poteto = configs.find(config => config.toolName === 'poteto_agent')
    expect(poteto).toBeDefined()
    expect(poteto?.toolFilter).toBeUndefined()
    expect(poteto?.backgroundMode).toBe('one-shot')
    const sicko = configs.find(config => config.toolName === 'comment_sicko')
    expect(sicko?.toolFilter).toEqual({ allow: ['read', 'grep', 'glob', 'bash'] })
  })

  it('toggles the sticky poteto section through the /poteto-mode command', () => {
    const { ctx, commands, section } = fakeCtx()
    apply(ctx)
    const entry = section() as FakeSection
    const text = entry.text as () => string
    expect(text()).toBe('')

    const command = commands.find(candidate => candidate.name === 'poteto-mode')!
    const followups: string[] = []
    const invocation = (rawInput: string) => ({
      agent: { followup: (message: unknown) => { followups.push(JSON.stringify(message)) } },
      rawInput,
      signal: new AbortController().signal,
    })
    command.handler(invocation('start reviewing this diff'))
    expect(text()).toContain('Poteto Mode is enabled')
    expect(followups.length).toBe(1)
    expect(followups[0]).toContain('poteto-mode')

    command.handler(invocation('off'))
    expect(text()).toBe('')
    expect(followups.length).toBe(1)
  })
})
