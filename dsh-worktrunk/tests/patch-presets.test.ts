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
    // Bounded to the preset's own block: slicing to EOF would let an `approval: ask` on a later
    // row satisfy this assertion vacuously.
    const start = patch.indexOf('worktree-full-access:')
    const end = patch.indexOf('\n- ', start)
    const preset = patch.slice(start, end === -1 ? undefined : end)
    expect(preset).toContain('sandbox: danger-full-access')
    expect(preset).toContain('approval: ask')
    expect(preset).not.toContain('insert:')
  })

  it('still inserts the plugin row with its config', () => {
    expect(patch).toContain('id: dsh-worktrunk')
    expect(patch).toContain('name: dsh-worktrunk')
    expect(patch).toContain('labelPrefix:')
  })
})
