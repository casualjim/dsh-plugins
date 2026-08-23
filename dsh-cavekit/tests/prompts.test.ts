import { describe, expect, it } from 'vitest'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePrompt } from '../src/index.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const promptsRoot = path.join(root, 'prompts')

const requiredPrompts = [
  'ck:spec.md',
  'ck:build.md',
  'ck:check.md',
  'ck:archive.md',
  'ck:grill.md',
  'ck:research.md',
  'ck:review.md',
  'ck:deepen.md',
]

describe('Cavekit command templates', () => {
  it('preserves /ck:* command names through colon filenames', async () => {
    const files = await readdir(promptsRoot)
    expect(files.sort()).toEqual([...requiredPrompts].sort())
  })

  it('includes autocomplete metadata and routes to Cavekit skills', async () => {
    for (const prompt of requiredPrompts) {
      const markdown = await readFile(path.join(promptsRoot, prompt), 'utf8')
      const parsed = parsePrompt(path.join(promptsRoot, prompt))
      const expectedSkill = prompt.replace(/^ck:/, 'cavekit-').replace(/\.md$/, '')

      expect(parsed.description, `${prompt} description`).toBeTruthy()
      expect(parsed.input?.hint, `${prompt} argument hint`).toBeTruthy()
      expect(parsed.name, `${prompt} command name`).toBe(prompt.replace(/^ck:/, 'ck-').replace(/\.md$/, ''))
      expect(markdown, `${prompt} routes to ${expectedSkill}`).toContain(expectedSkill)
    }
  })

  it('tells /ck:build to share the plan before asking a concise decision question', async () => {
    const markdown = await readFile(path.join(promptsRoot, 'ck:build.md'), 'utf8')

    expect(markdown).toContain('Before asking for approval, share the full plan in normal assistant text')
    expect(markdown).toContain('selected tasks, cited §V/§I, files to edit/create, tests, verification commands')
    expect(markdown).toContain('Then invoke `ask_user_question` separately')
    expect(markdown).toContain('Do not put the plan in the question field, option descriptions, or previews')
  })

  it('keeps /ck:spec question guidance focused on spec context and diffs', async () => {
    const markdown = await readFile(path.join(promptsRoot, 'ck:spec.md'), 'utf8')

    expect(markdown).toContain('first share relevant context, proposed SPEC.md text or diff, tradeoffs, and recommendation')
    expect(markdown).toContain('Then invoke `ask_user_question` separately')
    expect(markdown).toContain('Do not put context or diff details in the question field, option descriptions, or previews')
  })
})
