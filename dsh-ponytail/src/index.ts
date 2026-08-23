import { readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { CommandDefinition } from '@deepseek-ai/dsh-commands'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { SkillRegistration } from '@deepseek-ai/dsh-skill'

export const name = 'dsh-ponytail'
export const inject = ['skills', 'commands']

/**
 * Row config for the `dsh-ponytail` patch entry.
 *
 * - `alwaysOn` — inject the ponytail ruleset as a `systemPrompt` section for
 *   every session and every spawned subagent (the dsh analog of upstream's
 *   SessionStart auto-activation hook plus the SubagentStart propagation hook).
 *   Default `true`, matching upstream ponytail which is active on every session
 *   unless the default mode is `off`. Set `false` to mount the skills and
 *   commands without auto-activation; activate manually with `/ponytail`.
 * - `defaultMode` — intensity level named in the always-on section and used as
 *   the `/ponytail` fallback (`off`, `lite`, `full`, `ultra`). Default `full`.
 *   Falls back to the `PONYTAIL_DEFAULT_MODE` environment variable when the row
 *   config omits it, then `full` — the same resolution order upstream uses.
 */
export interface Config {
  readonly alwaysOn?: boolean
  readonly defaultMode?: string
}

/** Prompt-section order: the build rule sits after the deployment persona (`0`). */
const PONYTAIL_SECTION_ORDER = 2

/** Valid runtime modes (the `review` mode is a session-only skill, never a default). */
const RUNTIME_MODES = ['off', 'lite', 'full', 'ultra'] as const
type RuntimeMode = (typeof RUNTIME_MODES)[number]

/**
 * Package root: this module lives one directory below it — `src/` during
 * tests, `lib/` in the published build — and `skills/` and `prompts/` ship at
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
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const separator = line.indexOf(':')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    const rawValue = line.slice(separator + 1).trim()
    // Folded (`>`) and literal (`|`) block scalars: consume the indented block.
    if (rawValue === '>' || rawValue === '|' || rawValue === '>-' || rawValue === '|-') {
      const block: string[] = []
      for (let j = i + 1; j < lines.length; j += 1) {
        if (lines[j] === '') { block.push(''); i = j; continue }
        if (!/^\s+\S/.test(lines[j])) break
        block.push(lines[j].trim())
        i = j
      }
      meta[key] = block.join(rawValue.startsWith('>') ? ' ' : '\n').replace(/\s+/g, ' ').trim()
      continue
    }
    meta[key] = rawValue.replace(/^['"]|['"]$/g, '').trim()
  }
  const { name, description } = meta
  if (!description || description === '') throw new Error(`missing description in ${file}`)
  // `tools: [read, grep, glob]` — a bare bracket list, one line.
  const toolsMatch = /^\[(.*)\]$/.exec(meta.tools ?? '')
  const tools = toolsMatch === null
    ? undefined
    : toolsMatch[1].split(',').map(entry => entry.trim().replace(/^['"]|['"]$/g, '')).filter(entry => entry !== '')
  return { name, description, hint: meta['argument-hint'], tools, content: text.slice(match[0].length).trim() }
}

/** Parse a SKILL.md frontmatter block (`name`, `description`) and return the body. */
export function parseSkill(file: string): Pick<SkillRegistration, 'name' | 'description' | 'content'> {
  const { name, description, content } = parseFrontmatter(file)
  if (!name) throw new Error(`missing name in ${file}`)
  return { name, description, content }
}

/**
 * Parse a prompt template: command name from the filename, description, input
 * hint, and body. `{{args}}` in the body interpolates the raw command input.
 */
export function parsePrompt(file: string): Pick<CommandDefinition, 'name' | 'description' | 'input'> & { readonly content: string } {
  const { name, description, hint, content } = parseFrontmatter(file)
  return {
    name: basename(file).replace(/\.md$/, ''),
    description,
    ...(hint ? { input: { hint } } : {}),
    content,
  }
}

/** Normalize a mode string to a runtime mode, or `null` when it is not one. */
export function normalizeMode(mode: string | undefined): RuntimeMode | null {
  if (typeof mode !== 'string') return null
  const normalized = mode.trim().toLowerCase()
  return (RUNTIME_MODES as readonly string[]).includes(normalized) ? (normalized as RuntimeMode) : null
}

/**
 * Resolve the default mode: row `config.defaultMode`, then the
 * `PONYTAIL_DEFAULT_MODE` environment variable, then `full`. Mirrors upstream
 * ponytail's resolution order (env var > config file > full) with the row
 * config taking the config-file slot.
 */
export function resolveDefaultMode(config: Config): RuntimeMode {
  return normalizeMode(config.defaultMode) ?? normalizeMode(process.env.PONYTAIL_DEFAULT_MODE) ?? 'full'
}

/**
 * Filter the `ponytail` SKILL.md body to the active intensity level — a direct
 * port of upstream `ponytail-instructions.js#filterSkillBodyForMode`. Only the
 * intensity-table rows and worked examples are mode-specific; every other line
 * (the ladder, the rules, the boundaries) survives verbatim.
 */
export function filterSkillBodyForMode(body: string, mode: RuntimeMode): string {
  const withoutFrontmatter = String(body || '').replace(/^---[\s\S]*?---\s*/, '')
  return withoutFrontmatter
    .split(/\r?\n/)
    .filter((line) => {
      const tableLabel = line.match(/^\|\s*\*\*(.+?)\*\*\s*\|/)
      if (tableLabel) {
        const labelMode = normalizeMode(tableLabel[1].trim())
        if (labelMode) return labelMode === mode
      }
      // Every worked example is `- lite: "..."`; require the quoted value so an
      // ordinary rule bullet that happens to start with a mode word survives.
      const exampleLabel = line.match(/^-\s*([^:]+):\s*"/)
      if (exampleLabel) {
        const labelMode = normalizeMode(exampleLabel[1].trim())
        if (labelMode) return labelMode === mode
      }
      return true
    })
    .join('\n')
}

/**
 * Build the always-on ruleset for a mode: the upstream
 * `PONYTAIL MODE ACTIVE — level: <mode>` header followed by the mode-filtered
 * `ponytail` SKILL.md body. Falls back to a compact inline ruleset when the
 * skill file cannot be read, so a damaged install never drops the reminder.
 */
export function ponytailRuleset(mode: RuntimeMode): string {
  const header = `PONYTAIL MODE ACTIVE — level: ${mode}`
  try {
    const body = readFileSync(join(root, 'skills', 'ponytail', 'SKILL.md'), 'utf8')
    return `${header}\n\n${filterSkillBodyForMode(body, mode)}`
  } catch {
    return fallbackRuleset(mode, header)
  }
}

/** Compact inline ruleset — the upstream `getFallbackInstructions` shape. */
function fallbackRuleset(mode: RuntimeMode, header: string): string {
  return [
    header,
    '',
    'You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.',
    '',
    '## Persistence',
    '',
    'ACTIVE EVERY RESPONSE. No drift back to over-building. Still active if unsure. Off only: "stop ponytail" / "normal mode".',
    '',
    `Current level: **${mode}**. Switch: \`/ponytail lite|full|ultra\`.`,
    '',
    '## The ladder',
    '',
    'Before any code, stop at the first rung that holds (the ladder runs after you understand the problem, not instead of it — read the code it touches and trace the real flow first):',
    '1. Does this need to be built at all? (YAGNI)',
    '2. Does it already exist in this codebase? Reuse what is already here, do not re-write it.',
    '3. Does the standard library do this? Use it.',
    '4. Does a native platform feature cover it? Use it.',
    '5. Does an already-installed dependency solve it? Use it.',
    '6. Can this be one line? Make it one line.',
    '7. Only then: write the minimum code that works.',
    '',
    '## Rules',
    '',
    'No abstractions that were not requested. No avoidable dependencies. No boilerplate nobody asked for. Deletion over addition. Boring over clever. Fewest files possible. Ship the lazy version and question the complex request in the same response — never stall. Mark deliberate simplifications that cut a real corner with a known ceiling using a `ponytail:` comment that names the ceiling and upgrade path.',
    '',
    '## Output',
    '',
    'Code first. Then at most three short lines: what was skipped, when to add it. If the explanation is longer than the code, delete the explanation. Explanation the user explicitly asked for is not debt, give it in full.',
    '',
    '## When NOT to be lazy',
    '',
    'Never simplify away: understanding the problem, input validation at trust boundaries, error handling that prevents data loss, security measures, accessibility basics, anything the user explicitly asked to keep. Lazy code without its check is unfinished: non-trivial logic leaves ONE runnable check behind (assert-based demo/self-check or one small test file; no frameworks). Trivial one-liners need no test.',
    '',
    '## Boundaries',
    '',
    'Ponytail governs what you build, not how you talk. "stop ponytail" or "normal mode": revert. Level persists until changed or session end.',
  ].join('\n')
}

export function apply(ctx: Context, config: Config = {}): void {
  const defaultMode = resolveDefaultMode(config)

  // Skills: each directory under skills/ registers its SKILL.md.
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

  // Commands: each prompts/*.md becomes a slash command; {{args}} interpolates.
  const promptsDir = join(root, 'prompts')
  for (const entry of readdirSync(promptsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const prompt = parsePrompt(join(promptsDir, entry.name))
    ctx.commands.register({
      name: prompt.name,
      description: prompt.description,
      ...(prompt.input ? { input: prompt.input } : {}),
      handler: ({ agent, rawInput }) => {
        const args = rawInput.trim() === '' ? defaultMode : rawInput.trim()
        agent.followup(createUserMessage({
          content: [{
            type: 'text',
            text: prompt.content.replaceAll('{{args}}', args).replaceAll('{{defaultMode}}', defaultMode),
          }],
          source: { kind: 'user' },
        }))
        return { kind: 'success' }
      },
    })
  }

  // Always-on ruleset — analog of upstream's SessionStart activation hook.
  // Registered on the shared systemPrompt service, so the section reaches the
  // root agent AND every spawned subagent (a child's persona is a scoped
  // shadow over the global layer, never a replacement for it), which ports
  // upstream's SubagentStart propagation in the same mechanism. `off` keeps
  // the row mounted but starts the session inactive.
  if (config.alwaysOn !== false && defaultMode !== 'off') {
    const systemPrompt = ctx.get('systemPrompt')
    systemPrompt?.section({
      name: 'ponytail:always-on',
      order: PONYTAIL_SECTION_ORDER,
      text: ponytailRuleset(defaultMode),
    })
  }
}