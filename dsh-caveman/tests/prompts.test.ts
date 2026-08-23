import { describe, expect, it } from 'vitest'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePrompt } from '../src/index.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const promptsRoot = path.join(root, 'prompts')

const requiredCommands = [
  'caveman',
  'caveman-commit',
  'caveman-review',
  'caveman-help',
  'caveman-compress',
]

describe('Caveman command prompts', () => {
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

  it('caveman mode switch carries the level hint and both placeholders', async () => {
    const prompt = parsePrompt(path.join(promptsRoot, 'caveman.md'))

    expect(prompt.input?.hint).toContain('wenyan-ultra')
    expect(prompt.content).toContain('{{args}}')
    expect(prompt.content).toContain('{{defaultMode}}')
  })

  it('argument-taking commands interpolate raw input', async () => {
    const prompt = parsePrompt(path.join(promptsRoot, 'caveman-compress.md'))

    expect(prompt.input?.hint).toContain('filepath')
    expect(prompt.content).toContain('{{args}}')
    expect(prompt.content).toContain('`caveman-compress` skill')
  })

  it('self-contained prompts match the upstream command stubs', async () => {
    const commit = parsePrompt(path.join(promptsRoot, 'caveman-commit.md'))
    expect(commit.content).toContain('Conventional Commits format')

    const review = parsePrompt(path.join(promptsRoot, 'caveman-review.md'))
    expect(review.content).toContain('LGTM')
  })
})
