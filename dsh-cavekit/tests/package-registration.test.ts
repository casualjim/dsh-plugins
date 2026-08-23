import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(root, file), 'utf8')) as T
}

describe('dsh-cavekit package registration', () => {
  it('declares a dsh bundle manifest without pi metadata', async () => {
    const pkg = await readJson<{
      name: string
      dsh?: { bundle?: { patch?: string } }
      pi?: unknown
    }>('package.json')

    expect(pkg.name).toBe('dsh-cavekit')
    expect(pkg.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(pkg.pi).toBeUndefined()
  })

  it('publishes built entrypoint, skills, prompts, FORMAT.md, README, license, and patch', async () => {
    const pkg = await readJson<{ files?: string[] }>('package.json')

    expect(pkg.files).toEqual(
      expect.arrayContaining(['lib/', 'skills/', 'prompts/', 'FORMAT.md', 'README.md', 'LICENSE', 'cordis.patch.yml']),
    )
  })

  it('does not define install-time mutation scripts or pi-caveman dependency', async () => {
    const pkg = await readJson<{
      scripts?: Record<string, string>
      dependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }>('package.json')

    expect(pkg.scripts?.postinstall).toBeUndefined()
    expect(pkg.scripts?.preinstall).toBeUndefined()
    expect(pkg.scripts?.install).toBeUndefined()
    expect(pkg.dependencies ?? {}).not.toHaveProperty('@casualjim/pi-caveman')
    expect(pkg.peerDependencies ?? {}).not.toHaveProperty('@casualjim/pi-caveman')
  })
})
