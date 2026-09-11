import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')

describe('bundle patch', () => {
  it('keeps the upstream presets and adds worktree-full-access', () => {
    for (const name of ['read-only', 'workspace-write', 'danger-full-access', 'worktree-full-access']) {
      expect(patch).toContain(`${name}:`)
    }
  })

  it('states the worktree preset keeps approval prompts on', () => {
    const preset = patch.slice(patch.indexOf('worktree-full-access:'))
    expect(preset).toContain('sandbox: danger-full-access')
    expect(preset).toContain('approval: ask')
  })

  it('still inserts the plugin row with its config', () => {
    expect(patch).toContain('id: dsh-worktrunk')
    expect(patch).toContain('name: dsh-worktrunk')
    expect(patch).toContain('labelPrefix:')
  })
})
