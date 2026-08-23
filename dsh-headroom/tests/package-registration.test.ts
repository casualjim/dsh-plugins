import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(root, file), 'utf8')) as T
}

describe('dsh-headroom package registration', () => {
  it('declares a dsh bundle manifest without pi metadata', async () => {
    const pkg = await readJson<{
      name: string
      dsh?: { bundle?: { patch?: string } }
      pi?: unknown
    }>('package.json')

    expect(pkg.name).toBe('dsh-headroom')
    expect(pkg.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(pkg.pi).toBeUndefined()
  })

  it('publishes built entrypoint, patch, README, and license', async () => {
    const pkg = await readJson<{ files?: string[] }>('package.json')
    expect(pkg.files).toEqual(
      expect.arrayContaining(['lib/', 'cordis.patch.yml', 'README.md', 'LICENSE']),
    )
  })

  it('does not define install-time mutation scripts', async () => {
    const pkg = await readJson<{ scripts?: Record<string, string> }>('package.json')
    expect(pkg.scripts?.postinstall).toBeUndefined()
    expect(pkg.scripts?.preinstall).toBeUndefined()
    expect(pkg.scripts?.install).toBeUndefined()
  })

  it('keeps headroom-ai as a runtime dependency and dsh packages as peers', async () => {
    const pkg = await readJson<{
      dependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }>('package.json')
    expect(pkg.dependencies).toHaveProperty('headroom-ai')
    expect(pkg.peerDependencies).toMatchObject({
      '@deepseek-ai/dsh-compaction': '*',
      '@deepseek-ai/dsh-session': '*',
      '@deepseek-ai/dsh-token-meter': '*',
      '@deepseek-ai/dsh-tools': '*',
      '@deepseek-ai/dsh-commands': '*',
    })
  })

  it('ships a patch inserting exactly one dsh-headroom row with degrade-safe config', async () => {
    const patch = await readFile(path.join(root, 'cordis.patch.yml'), 'utf8')
    expect(patch).toContain('- insert:')
    expect(patch).toContain('id: dsh-headroom')
    expect(patch).toContain('name: dsh-headroom')
    expect(patch).toContain('baseUrl:')
    expect(patch).not.toContain('autoStart')
  })
})
