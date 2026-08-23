import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(root, file), 'utf8')) as T
}

describe('dsh-ponytail package registration', () => {
  it('declares a dsh bundle manifest without upstream-agent metadata', async () => {
    const pkg = await readJson<{
      name: string
      main: string
      dsh?: { bundle?: { patch?: string } }
      'claude-plugin'?: unknown
      plugin?: unknown
    }>('package.json')

    expect(pkg.name).toBe('dsh-ponytail')
    expect(pkg.main).toBe('lib/index.js')
    expect(pkg.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(pkg['claude-plugin']).toBeUndefined()
    expect(pkg.plugin).toBeUndefined()
  })

  it('publishes built entrypoint, skills, prompts, README, license, and patch', async () => {
    const pkg = await readJson<{ files?: string[] }>('package.json')

    expect(pkg.files).toEqual(
      expect.arrayContaining(['lib/', 'skills/', 'prompts/', 'README.md', 'LICENSE', 'cordis.patch.yml']),
    )
  })

  it('declares the skill and command peer dependencies, never the subagent tool', async () => {
    const pkg = await readJson<{ peerDependencies?: Record<string, string> }>('package.json')

    expect(pkg.peerDependencies?.['@deepseek-ai/dsh-skill']).toBeDefined()
    expect(pkg.peerDependencies?.['@deepseek-ai/dsh-commands']).toBeDefined()
    expect(pkg.peerDependencies?.['@deepseek-ai/dsh-llm']).toBeDefined()
    // ponytail ships no delegation personas, unlike dsh-caveman
    expect(pkg.peerDependencies?.['@deepseek-ai/dsh-tool-subagent']).toBeUndefined()
  })

  it('inserts exactly the plugin row, no service publication', async () => {
    const patch = await readFile(path.join(root, 'cordis.patch.yml'), 'utf8')

    expect(patch).toContain('id: dsh-ponytail')
    expect(patch).toContain('name: dsh-ponytail')
    expect(patch).not.toContain('provide')
  })
})