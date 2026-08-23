import { describe, expect, it } from 'vitest'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function text(file: string): Promise<string> {
  return readFile(path.join(root, file), 'utf8')
}

describe('Cavekit archive surface', () => {
  it('ships cavekit-archive skill and /ck:archive command', async () => {
    expect((await stat(path.join(root, 'skills/cavekit-archive/SKILL.md'))).isFile()).toBe(true)
    expect((await stat(path.join(root, 'prompts/ck:archive.md'))).isFile()).toBe(true)

    const skill = await text('skills/cavekit-archive/SKILL.md')
    const prompt = await text('prompts/ck:archive.md')
    const readme = await text('README.md')

    expect(skill).toContain('name: cavekit-archive')
    expect(skill).toContain('../../FORMAT.md')
    expect(prompt).toContain('Use the `cavekit-archive` skill workflow')
    expect(readme).toContain('/ck:archive')
    expect(readme).toContain('cavekit-archive')
  })
})

describe('Cavekit archive safety workflow', () => {
  it('documents no-write precheck for missing or small SPEC.md', async () => {
    const skill = await text('skills/cavekit-archive/SKILL.md')

    expect(skill).toContain('If missing')
    expect(skill).toContain('stop with no writes')
    expect(skill).toContain('≤500')
    expect(skill).toContain('Missing `SPEC.md` or `≤500` lines → no write')
  })

  it('requires dry-run preview and explicit approval before writes', async () => {
    const skill = await text('skills/cavekit-archive/SKILL.md')
    const prompt = await text('prompts/ck:archive.md')

    expect(skill).toContain('DRY-RUN PREVIEW — no writes')
    expect(skill).toContain('Do not create directories, archive files, or edit `SPEC.md` during preview')
    expect(skill).toContain('Ask approval with `ask_user_question` after preview')
    expect(skill).toContain('Do not use a prose-only `Proceed?` prompt')
    expect(skill).toContain('No writes before dry-run preview and explicit user OK')
    expect(prompt).toContain('write only after explicit user approval')
  })

  it('copies full SPEC.md before trimming working SPEC.md', async () => {
    const skill = await text('skills/cavekit-archive/SKILL.md')
    const format = await text('FORMAT.md')
    const readme = await text('README.md')

    expect(skill).toContain('Copy exact full pre-trim `SPEC.md`')
    expect(skill).toContain('Only after archive copy succeeds, edit working `SPEC.md`')
    expect(skill).toContain('Archive = exact full pre-trim copy. Content loss ⊥.')
    expect(format).toContain('Copy exact full SPEC.md')
    expect(readme).toContain('copies exact full pre-trim `SPEC.md`')
  })
})
