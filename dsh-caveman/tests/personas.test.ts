import { describe, expect, it } from 'vitest'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePersona } from '../src/index.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const agentsRoot = path.join(root, 'agents')

/** Global dsh tool names a cavecrew persona may allowlist. */
const knownTools = ['read', 'edit', 'write', 'grep', 'glob', 'bash', 'read_image']

const expectedPersonas = new Map([
  ['cavecrew-investigator', ['read', 'grep', 'glob', 'bash']],
  ['cavecrew-builder', ['read', 'edit', 'write', 'grep', 'glob']],
  ['cavecrew-reviewer', ['read', 'grep', 'glob', 'bash']],
])

describe('Cavecrew persona files', () => {
  it('includes exactly the three cavecrew personas', async () => {
    const files = (await readdir(agentsRoot))
      .filter(file => file.startsWith('cavecrew-') && file.endsWith('.md'))
      .sort()
    expect(files).toEqual([...expectedPersonas.keys()].map(name => `${name}.md`).sort())
  })

  it('parses each persona into a delegation tool with an allowlist', async () => {
    for (const [name, tools] of expectedPersonas) {
      const persona = parsePersona(path.join(agentsRoot, `${name}.md`))

      expect(persona.toolName, `${name} tool name`).toBe(name.replace(/-/g, '_'))
      expect([...persona.tools].sort()).toEqual([...tools].sort())
      expect(persona.persona.length, `${name} persona body`).toBeGreaterThan(200)
      expect(persona.description.length, `${name} description`).toBeGreaterThan(20)
    }
  })

  it('allowlists only known global tool names', async () => {
    for (const name of expectedPersonas.keys()) {
      const persona = parsePersona(path.join(agentsRoot, `${name}.md`))
      for (const tool of persona.tools) {
        expect(knownTools, `${name} tool "${tool}" is a dsh tool name`).toContain(tool)
      }
    }
  })

  it('persona bodies carry no template interpolation hazard and no upstream tool names', async () => {
    for (const name of expectedPersonas.keys()) {
      const persona = parsePersona(path.join(agentsRoot, `${name}.md`))

      // persona text is strictly {{…}}-interpolated at child start
      expect(persona.persona.includes('{{'), `${name} has no {{`).toBe(false)
      // upstream tool references are backticked (`Read`, `Bash`); sentence-initial
      // verbs like "Edit existing only" are legitimate prose
      expect(persona.persona.match(/`(Read|Grep|Glob|Edit|Write|Bash)`/), `${name} no Claude tool refs`).toBeNull()
    }
  })

  it('builder persona stays shell-free to match its allowlist', async () => {
    const persona = parsePersona(path.join(agentsRoot, 'cavecrew-builder.md'))

    expect(persona.tools).not.toContain('bash')
    expect(persona.persona).toContain('No `bash` available')
  })

  it('investigator refuses fixes and names the builder tool', async () => {
    const persona = parsePersona(path.join(agentsRoot, 'cavecrew-investigator.md'))

    expect(persona.persona).toContain('Read-only')
    expect(persona.persona).toContain('cavecrew_builder')
  })
})
