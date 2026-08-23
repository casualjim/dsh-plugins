import { describe, expect, it } from 'vitest'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePrompt } from '../src/index.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const promptsRoot = path.join(root, 'prompts')

const requiredCommands = [
  'ponytail',
  'ponytail-review',
  'ponytail-audit',
  'ponytail-debt',
  'ponytail-gain',
  'ponytail-help',
]

describe('Ponytail command prompts', () => {
  it('includes the ported command surface', async () => {
    const files = (await readdir(promptsRoot)).filter(file => file.endsWith('.md'))
    expect(files.sort()).toEqual(requiredCommands.map(command => `${command}.md`).sort())
  })

  it('parses every prompt with a description and non-empty body', async () => {
    for (const file of await readdir(promptsRoot)) {
      if (!file.endsWith('.md')) continue
      const prompt = parsePrompt(path.join(promptsRoot, file))

      expect(prompt.name, `${file} command name`).toBe(file.replace(/\.md$/, ''))
      expect(prompt.description?.length, `${file} description`).toBeGreaterThan(5)
      expect(prompt.content.trim().length, `${file} body`).toBeGreaterThan(10)
    }
  })

  it('ponytail mode switch carries the level hint and both placeholders', async () => {
    const prompt = parsePrompt(path.join(promptsRoot, 'ponytail.md'))

    expect(prompt.input?.hint).toContain('ultra')
    expect(prompt.content).toContain('{{args}}')
    expect(prompt.content).toContain('{{defaultMode}}')
  })

  it('self-contained prompts match the upstream command stubs', async () => {
    const review = parsePrompt(path.join(promptsRoot, 'ponytail-review.md'))
    expect(review.content).toContain('Lean already. Ship.')

    const audit = parsePrompt(path.join(promptsRoot, 'ponytail-audit.md'))
    expect(audit.content).toContain('deps possible')

    const debt = parsePrompt(path.join(promptsRoot, 'ponytail-debt.md'))
    expect(debt.content).toContain('no-trigger')

    const gain = parsePrompt(path.join(promptsRoot, 'ponytail-gain.md'))
    expect(gain.content).toContain('3–6× faster')
  })
})