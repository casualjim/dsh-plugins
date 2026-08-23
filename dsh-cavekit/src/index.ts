import { readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { CommandDefinition } from '@deepseek-ai/dsh-commands'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'

export const name = 'dsh-cavekit'
export const inject = ['skills', 'commands']

/**
 * Package root: this module lives one directory below it — `src/` during
 * tests, `lib/` in the published build — and `skills/` and `prompts/` ship
 * at the package root beside it.
 */
const root = dirname(dirname(fileURLToPath(import.meta.url)))

interface Frontmatter {
  readonly name?: string
  readonly description: string
  readonly hint?: string
  readonly content: string
}

function parseFrontmatter(file: string): Frontmatter {
  const text = readFileSync(file, 'utf8')
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  if (!match) throw new Error(`missing frontmatter in ${file}`)
  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const i = line.indexOf(':')
    if (i === -1) continue
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  const { name, description } = meta
  if (!description) throw new Error(`missing description in ${file}`)
  return { name, description, hint: meta['argument-hint'], content: text.slice(match[0].length) }
}

/** Parse a SKILL.md frontmatter block (`name`, `description`) and return the body. */
export function parseSkill(file: string): Pick<SkillRegistration, 'name' | 'description' | 'content'> {
  const { name, description, content } = parseFrontmatter(file)
  if (!name) throw new Error(`missing name in ${file}`)
  return { name, description, content }
}

/** Parse a prompt template: command name from the filename (`ck:spec` → `ck-spec`), description, input hint, body. */
export function parsePrompt(file: string): Pick<CommandDefinition, 'name' | 'description' | 'input'> & { readonly content: string } {
  const { name, description, hint, content } = parseFrontmatter(file)
  return {
    name: basename(file).replace(/\.md$/, '').replace(':', '-'),
    description,
    ...(hint ? { input: { hint } } : {}),
    content,
  }
}

export function apply(ctx: Context): void {
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

  const promptsDir = join(root, 'prompts')
  for (const entry of readdirSync(promptsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const prompt = parsePrompt(join(promptsDir, entry.name))
    const skill = prompt.name.replace('ck-', 'cavekit-')
    ctx.commands.register({
      name: prompt.name,
      description: prompt.description,
      ...(prompt.input ? { input: prompt.input } : {}),
      handler: ({ agent, rawInput }) => {
        agent.followup(createUserMessage({
          content: [{
            type: 'text',
            text: `Use the \`${skill}\` skill workflow for this request.\n\nArguments: ${rawInput.trim()}`,
          }],
          source: { kind: 'user' },
        }))
        return { kind: 'success' }
      },
    })
  }
}
