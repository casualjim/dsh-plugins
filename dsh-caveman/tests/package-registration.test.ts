import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(root, file), 'utf8')) as T
}

describe('dsh-caveman package registration', () => {
  it('declares a dsh bundle manifest without upstream-agent metadata', async () => {
    const pkg = await readJson<{
      name: string
      main: string
      dsh?: { bundle?: { patch?: string } }
      'claude-plugin'?: unknown
    }>('package.json')

    expect(pkg.name).toBe('dsh-caveman')
    expect(pkg.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(pkg['claude-plugin']).toBeUndefined()
  })

  it('publishes built entrypoint, skills, agents, prompts, README, license, and patch', async () => {
    const pkg = await readJson<{ files?: string[] }>('package.json')

    expect(pkg.files).toEqual(
      expect.arrayContaining(['lib/', 'skills/', 'agents/', 'prompts/', 'README.md', 'LICENSE', 'cordis.patch.yml']),
    )
  })

  it('declares the tool-subagent peer dependency for cavecrew delegation', async () => {
    const pkg = await readJson<{ peerDependencies?: Record<string, string> }>('package.json')

    expect(pkg.peerDependencies?.['@deepseek-ai/dsh-tool-subagent']).toBeDefined()
    expect(pkg.peerDependencies?.['@deepseek-ai/dsh-skill']).toBeDefined()
    expect(pkg.peerDependencies?.['@deepseek-ai/dsh-commands']).toBeDefined()
  })

  it('inserts exactly the plugin row, no service publication', async () => {
    const patch = await readFile(path.join(root, 'cordis.patch.yml'), 'utf8')

    expect(patch).toContain('id: dsh-caveman')
    expect(patch).toContain('name: dsh-caveman')
    expect(patch).not.toContain('provide')
  })
})
