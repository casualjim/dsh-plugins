import { describe, expect, it } from 'vitest'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skillsRoot = path.join(root, 'skills')
const promptsRoot = path.join(root, 'prompts')

const verbs = ['grill', 'research', 'review', 'deepen'] as const

async function text(file: string): Promise<string> {
  return readFile(path.join(root, file), 'utf8')
}

describe('Cavekit v4.1 reach-for verbs', () => {
  it('ships a skill and command for each new verb', async () => {
    for (const verb of verbs) {
      const skillPath = path.join(skillsRoot, `cavekit-${verb}`, 'SKILL.md')
      const promptPath = path.join(promptsRoot, `ck:${verb}.md`)
      const skill = await readFile(skillPath, 'utf8')
      const prompt = await readFile(promptPath, 'utf8')

      expect(skill).toContain(`name: cavekit-${verb}`)
      expect(skill).toContain('../../FORMAT.md')
      expect(skill.length).toBeGreaterThan(0)
      expect(prompt).toContain(`Use the \`cavekit-${verb}\` skill workflow`)
    }
  })

  it('keeps skill descriptions within the frontmatter length budget', async () => {
    for (const dir of await readdir(skillsRoot)) {
      const markdown = await readFile(path.join(skillsRoot, dir, 'SKILL.md'), 'utf8')
      const match = markdown.match(/^---\n([\s\S]*?)\n---/)
      if (!match) continue
      const lines = match[1].split('\n')
      const descLine = lines.find((l) => l.startsWith('description:'))
      if (!descLine) continue
      const idx = lines.findIndex((l) => l.startsWith('description:'))
      let value = descLine.replace(/^description:\s*/, '')
      if (value === '') {
        const block: string[] = []
        for (let j = idx + 1; j < lines.length; j += 1) {
          if (/^[a-zA-Z0-9_-]+:\s*/.test(lines[j])) break
          block.push(lines[j].trim())
        }
        value = block.join(' ')
      }
      expect(value.length, `${dir} description length`).toBeLessThanOrEqual(1024)
    }
  })

  it('does not leak upstream skills/<verb>/SKILL.md paths (V36)', async () => {
    const dirs = await readdir(skillsRoot)
    for (const dir of dirs) {
      const markdown = await readFile(path.join(skillsRoot, dir, 'SKILL.md'), 'utf8')
      for (const verb of ['grill', 'research', 'review', 'deepen', 'spec', 'build', 'check', 'backprop']) {
        expect(markdown, `${dir} references upstream skills/${verb}/SKILL.md`).not.toContain(`skills/${verb}/SKILL.md`)
      }
    }
    for (const verb of verbs) {
      const prompt = await readFile(path.join(promptsRoot, `ck:${verb}.md`), 'utf8')
      expect(prompt, `ck:${verb} leaks upstream spec path`).not.toContain('skills/spec/SKILL.md')
    }
  })

  it('routes reach-for verb handoffs through cavekit-spec, never writes SPEC.md directly (V37)', async () => {
    for (const verb of verbs) {
      const skill = await readFile(path.join(skillsRoot, `cavekit-${verb}`, 'SKILL.md'), 'utf8')
      expect(skill).toContain('cavekit-spec')
      expect(skill.toLowerCase()).toContain('⊥ write `spec.md`')
    }
  })

  it('mirrors §R + sectioned ownership + right-size in bundled FORMAT.md (V38)', async () => {
    const format = await text('FORMAT.md')
    expect(format).toContain('## §R RESEARCH')
    expect(format).toContain('id|topic|finding|src')
    expect(format).toContain('## WRITES — SECTIONED OWNERSHIP')
  })
})
