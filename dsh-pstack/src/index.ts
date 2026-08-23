import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { CommandDefinition } from '@deepseek-ai/dsh-commands'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'
import * as toolSubagent from '@deepseek-ai/dsh-tool-subagent'

export const name = 'dsh-pstack'
export const inject = ['skills', 'commands']

/**
 * Row config for the `dsh-pstack` patch entry.
 *
 * - `provider` — `ctx.subagents` provider the bundled agent personas
 *   (`poteto-agent`, `comment-sicko`) delegate on. Default `spawn` (fresh
 *   child, no parent context).
 * - `enableAgents` — register the two bundled agent personas as subagent
 *   tools (`poteto_agent`, `comment_sicko`). Default `true`.
 * - `enablePotetoSection` — register the sticky Poteto Mode system-prompt
 *   section, toggled by the `/poteto-mode` command. Default `true`.
 */
export interface Config {
  readonly provider?: string
  readonly enableAgents?: boolean
  readonly enablePotetoSection?: boolean
}

/** Prompt-section order: after the caveman style layer (`1`), before tool guidance. */
const POTETO_SECTION_ORDER = 2

/**
 * Package root: this module lives one directory below it — `src/` during
 * tests, `lib/` in the published build — and `skills/` and `agents/` ship at
 * the package root beside it.
 */
const root = dirname(dirname(fileURLToPath(import.meta.url)))

interface Frontmatter {
  readonly name?: string
  readonly description: string
  readonly hint?: string
  readonly tools?: readonly string[]
  readonly content: string
}

function parseFrontmatter(file: string): Frontmatter {
  const text = readFileSync(file, 'utf8')
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  if (!match) throw new Error(`missing frontmatter in ${file}`)
  const meta: Record<string, string> = {}
  const lines = match[1].split('\n')
  for (const line of lines) {
    const separator = line.indexOf(':')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    const rawValue = line.slice(separator + 1).trim()
    meta[key] = rawValue.replace(/^['"]|['"]$/g, '').trim()
  }
  const { name, description } = meta
  if (!description || description === '') throw new Error(`missing description in ${file}`)
  // `tools:` accepts a bracket list (`[read, grep]`) or a bare comma list
  // (`read, grep`), both from upstream personas.
  const rawTools = meta.tools ?? ''
  const tools = rawTools === ''
    ? undefined
    : (rawTools.startsWith('[') ? rawTools.slice(1, -1) : rawTools)
      .split(',').map(entry => entry.trim().replace(/^['"]|['"]$/g, '')).filter(entry => entry !== '')
  return { name, description, hint: meta['argument-hint'], tools, content: text.slice(match[0].length).trim() }
}

/** Parse a SKILL.md frontmatter block (`name`, `description`) and return the body. */
export function parseSkill(file: string): Pick<SkillRegistration, 'name' | 'description' | 'content'> {
  const { name, description, content } = parseFrontmatter(file)
  if (!name) throw new Error(`missing name in ${file}`)
  return { name, description, content }
}

/** One bundled agent persona file: model-facing tool name, description, persona text, tool allowlist. */
export interface Persona {
  readonly toolName: string
  readonly description: string
  readonly persona: string
  readonly tools?: readonly string[]
}

/**
 * Parse a bundled agent persona (`agents/*.md`): frontmatter `name` becomes
 * the delegation tool name (`poteto-agent` → `poteto_agent`), frontmatter
 * `tools` (when present) becomes the child's tool allowlist, and the body is
 * the persona text.
 */
export function parsePersona(file: string): Persona {
  const { name, description, tools, content } = parseFrontmatter(file)
  if (!name) throw new Error(`missing name in ${file}`)
  return { toolName: name.replace(/-/g, '_'), description, persona: content, tools }
}

/** Sticky-mode section text: injected into every prompt while Poteto Mode is on. */
const POTETO_SECTION_TEXT = [
  'Pstack Poteto Mode is enabled for this session. Follow its persisted workflow: open a todo list for non-trivial work, select and read the matching playbook from the `poteto-mode` skill, delegate through the subagent tools when delegation helps, verify real behavior, and name only principles that changed a decision. Load the `poteto-mode` skill in full when unsure.',
].join('\n')

export function apply(ctx: Context, config: Config = {}): void {
  // Skills: each directory under skills/ registers its SKILL.md, with the
  // skill directory as resource base so `references/` and `playbooks/` paths
  // in the body resolve.
  const skillsDir = join(root, 'skills')
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = join(skillsDir, entry.name, 'SKILL.md')
    ctx.skills.register({
      ...parseSkill(file),
      source: 'bundled',
      resourceBase: { kind: 'directory', path: dirname(file) },
    })
  }

  // Sticky Poteto Mode, toggled by the /poteto-mode command below. The
  // section is registered once and renders empty while the mode is off, so
  // the toggle has nothing to dispose or re-register.
  let potetoMode = false
  if (config.enablePotetoSection !== false) {
    const systemPrompt = ctx.get('systemPrompt')
    systemPrompt?.section({
      name: 'pstack:poteto-mode',
      order: POTETO_SECTION_ORDER,
      text: () => potetoMode ? POTETO_SECTION_TEXT : '',
    })
  }

  const potetoCommand: CommandDefinition = {
    name: 'poteto-mode',
    description: 'Enable or disable sticky pstack Poteto Mode for this session. Usage: /poteto-mode [task] | /poteto-mode off',
    input: { hint: '[task] | off' },
    handler: ({ agent, rawInput }) => {
      const args = rawInput.trim()
      if (/^(off|disable|stop)$/i.test(args)) {
        potetoMode = false
        return { kind: 'success' }
      }
      potetoMode = true
      agent.followup(createUserMessage({
        content: [{
          type: 'text',
          text: args === ''
            ? 'Use the `poteto-mode` skill for this request.'
            : `Use the \`poteto-mode\` skill for this request.\n\nArguments: ${args}`,
        }],
        source: { kind: 'user' },
      }))
      return { kind: 'success' }
    },
  }
  ctx.commands.register(potetoCommand)

  const setupCommand: CommandDefinition = {
    name: 'setup-pstack',
    description: 'Check the current project can prove its behavior before pstack workflows run; offers to generate a verification skill.',
    handler: ({ agent, rawInput }) => {
      agent.followup(createUserMessage({
        content: [{
          type: 'text',
          text: `Use the \`setup-pstack\` skill workflow for this request.\n\nArguments: ${rawInput.trim()}`,
        }],
        source: { kind: 'user' },
      }))
      return { kind: 'success' }
    },
  }
  ctx.commands.register(setupCommand)

  // Bundled agent personas: one dsh-tool-subagent child fiber per agents/*.md.
  // A persona without a `tools` allowlist (poteto-agent) keeps the child's
  // full tool set; one with it (comment-sicko) restricts the child.
  if (config.enableAgents !== false) {
    const provider = config.provider ?? 'spawn'
    const agentsDir = join(root, 'agents')
    for (const entry of readdirSync(agentsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue
      const persona = parsePersona(join(agentsDir, entry.name))
      ctx.plugin(toolSubagent, {
        provider,
        toolName: persona.toolName,
        persona: persona.persona,
        ...(persona.tools !== undefined ? { toolFilter: { allow: [...persona.tools] } } : {}),
        backgroundMode: 'one-shot',
      })
    }
  }
}
