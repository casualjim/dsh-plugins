import { describe, expect, it } from 'vitest'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillsRoot = path.join(root, 'skills')

const requiredSkills = [
  'ponytail',
  'ponytail-review',
  'ponytail-audit',
  'ponytail-debt',
  'ponytail-gain',
  'ponytail-help',
]

function parseFrontmatter(markdown: string): Record<string, string> {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}

  const result: Record<string, string> = {}
  const lines = match[1].split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const simple = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/)
    if (!simple) continue

    const [, key, rawValue] = simple
    if (rawValue === '>' || rawValue === '|') {
      const block: string[] = []
      for (let j = i + 1; j < lines.length; j += 1) {
        if (/^[a-zA-Z0-9_-]+:\s*/.test(lines[j])) break
        block.push(lines[j].trim())
        i = j
      }
      result[key] = block.join(' ').trim()
    } else {
      result[key] = rawValue.replace(/^['"]|['"]$/g, '').trim()
    }
  }
  return result
}

describe('Ponytail skill files', () => {
  it('includes the ported skill surface', async () => {
    for (const skill of requiredSkills) {
      const skillPath = path.join(skillsRoot, skill, 'SKILL.md')
      expect((await stat(skillPath)).isFile(), `${skill} exists`).toBe(true)
    }
  })

  it('uses valid unique frontmatter names with descriptions', async () => {
    const names = new Set<string>()

    for (const dir of await readdir(skillsRoot)) {
      const skillPath = path.join(skillsRoot, dir, 'SKILL.md')
      const meta = parseFrontmatter(await readFile(skillPath, 'utf8'))

      expect(meta.name, `${dir} names itself`).toBe(dir)
      expect(meta.description?.length, `${dir} has a description`).toBeGreaterThan(10)
      expect(names.has(meta.name!), `${dir} name unique`).toBe(false)
      names.add(meta.name!)
    }

    expect(names.size).toBe(requiredSkills.length)
  })

  it('references dsh command names, never colon-prefixed upstream commands', async () => {
    for (const dir of await readdir(skillsRoot)) {
      const text = await readFile(path.join(skillsRoot, dir, 'SKILL.md'), 'utf8')
      expect(text.match(/\/ponytail[a-z-]*:/), `${dir} has no colon command`).toBeNull()
    }
  })

  it('the help skill routes to dsh row config, not Claude-Code plugin machinery', async () => {
    const text = await readFile(path.join(skillsRoot, 'ponytail-help', 'SKILL.md'), 'utf8')

    expect(text).toContain('config.defaultMode')
    expect(text).toContain('alwaysOn')
    // the env var is a supported fallback in the dsh port, so it stays
    expect(text).toContain('PONYTAIL_DEFAULT_MODE')
    // upstream Claude-Code-only update/plugin-marketplace machinery must not survive
    expect(text).not.toContain('/plugin marketplace')
    expect(text).not.toContain('Enable auto-update')
  })

  it('the main skill keeps the ladder and the safety carve-out verbatim', async () => {
    const text = await readFile(path.join(skillsRoot, 'ponytail', 'SKILL.md'), 'utf8')

    expect(text).toContain('Does this need to exist at all?')
    expect(text).toContain('Stdlib does it?')
    expect(text).toContain('Native platform feature covers it?')
    expect(text).toContain('Never simplify away')
    expect(text).toContain('ponytail:')
  })
})