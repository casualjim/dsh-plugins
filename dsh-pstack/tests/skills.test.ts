import { describe, expect, it } from 'vitest'
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSkill } from '../src/index.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Upstream pstack skills that must survive the port. */
const UPSTREAM_SKILLS = [
  'architect', 'arena', 'automate-me', 'blast-radius', 'bro',
  'create-verification-skill', 'figure-it-out', 'how', 'interrogate',
  'maintain-verification-skill', 'no-comments', 'poteto-mode',
  'principle-boundary-discipline', 'principle-build-the-lever',
  'principle-encode-lessons-in-structure', 'principle-exhaust-the-design-space',
  'principle-experience-first', 'principle-fix-root-causes',
  'principle-foundational-thinking', 'principle-guard-the-context-window',
  'principle-laziness-protocol', 'principle-make-operations-idempotent',
  'principle-migrate-callers-then-delete-legacy-apis', 'principle-minimize-reader-load',
  'principle-model-the-domain', 'principle-never-block-on-the-human',
  'principle-outcome-oriented-execution', 'principle-prove-it-works',
  'principle-redesign-from-first-principles', 'principle-separate-before-serializing-shared-state',
  'principle-sequence-verifiable-units', 'principle-subtract-before-you-add',
  'principle-type-system-discipline', 'recall', 'reflect', 'setup-pstack',
  'show-me-your-work', 'swarm', 'tdd', 'teach', 'technical-writing',
  'typescript-best-practices', 'unslop', 'why',
]

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await walk(full))
    else files.push(full)
  }
  return files
}

describe('dsh-pstack skills', () => {
  it('registers every upstream skill directory with valid frontmatter', async () => {
    const skillsDir = path.join(root, 'skills')
    const dirs = (await readdir(skillsDir, { withFileTypes: true }))
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
    expect(dirs.sort()).toEqual([...UPSTREAM_SKILLS].sort())

    for (const dir of dirs) {
      const file = path.join(skillsDir, dir, 'SKILL.md')
      const skill = parseSkill(file)
      expect(skill.name).toBe(dir)
      expect(skill.description.length).toBeGreaterThan(0)
      expect(skill.content.length).toBeGreaterThan(0)
    }
  })

  it('carries no cursor, claude, or pi residue in any bundled file', async () => {
    const offenders: string[] = []
    const patterns = [
      /\bcursor/i,
      /\bclaude\b/i,
      /anthropic/i,
      /\.pi\/|~\/\.pi/,
      /pstack_config|pstack_todo|pstack_sessions/,
      /\/skill:/,
      /inherit-parent|models\.json/,
      /pi-subagents/i,
      /\$PI_SESSION_FILE/,
      /\bGraphite\b|gt submit|gt merge|gt sync|gt restack|gt track|merge-when-ready/,
      /cloud-agent|cloud sleeper/,
    ]
    for (const file of await walk(path.join(root, 'skills'))) {
      const text = await readFile(file, 'utf8')
      for (const pattern of patterns) {
        if (pattern.test(text)) offenders.push(`${file}: ${pattern}`)
      }
    }
    for (const file of await walk(path.join(root, 'agents'))) {
      const text = await readFile(file, 'utf8')
      for (const pattern of patterns) {
        if (pattern.test(text)) offenders.push(`${file}: ${pattern}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('ships resource references that resolve inside each skill directory', async () => {
    // Skills reference files via relative paths resolved against their
    // registered resourceBase directory; spot-check the ones that inline
    // `references/...` or `playbooks/...` paths.
    const spotChecks: Array<[string, string[]]> = [
      ['how', ['references/explorer-prompt.md', 'references/explainer-prompt.md', 'references/critic-prompt.md']],
      ['why', ['references/investigator-prompt.md', 'references/synthesizer-prompt.md']],
      ['reflect', ['references/judgment-reviewer.md', 'references/synthesizer.md']],
      ['poteto-mode', ['playbooks/babysit.md', 'playbooks/shipping.md', 'references/plan.md']],
      ['architect', ['references/runner-prompt.md', 'references/rationale-template.md']],
    ]
    for (const [dir, refs] of spotChecks) {
      for (const ref of refs) {
        const full = path.join(root, 'skills', dir, ref)
        const info = await stat(full)
        expect(info.isFile()).toBe(true)
      }
    }
  })
})
