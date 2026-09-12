import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const files = (dir: string): string[] => readdirSync(dir).flatMap(name => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? files(path) : path.endsWith('.ts') || path.endsWith('.tsx') ? [path] : []
})

const source = (path: string) => readFileSync(path, 'utf8')
const clientFiles = files('src/client')
const hostFiles = files('src/host')

/**
 * Every relative module specifier a file mentions. The brief's literal
 * `from '../host.js'` pattern only caught the barrel file, so a client file
 * importing `../../host/service.js` (or `../wt.js` from a nested directory)
 * slipped through; resolving each specifier to its module path closes that.
 */
const importsOf = (path: string): string[] =>
  [...source(path).matchAll(/(?:from|import|require)\s*\(?\s*['"](\.[^'"]*)['"]/g)].map(match => match[1] as string)

/** A path as a module id: absolute, extension stripped, so `.js` specifiers match `.ts` sources. */
const moduleId = (path: string): string => resolve(path).replace(/\.[cm]?[jt]sx?$/, '')

/** True when `from` imports any module under (or equal to) `forbidden`. */
const importsInto = (from: string, forbidden: string): boolean => {
  const target = moduleId(forbidden)
  return importsOf(from).some((specifier) => {
    const resolved = moduleId(join(dirname(from), specifier))
    return resolved === target || resolved.startsWith(`${target}${sep}`)
  })
}

describe('module boundaries', () => {
  it('keeps contract.ts free of imports', () => {
    expect(source('src/contract.ts')).not.toMatch(/^import /m)
  })

  it('keeps the browser half out of host and wt code', () => {
    for (const path of clientFiles) {
      expect(importsInto(path, 'src/host'), `${path} imports src/host/**`).toBe(false)
      expect(importsInto(path, 'src/wt.ts'), `${path} imports src/wt.ts`).toBe(false)
    }
  })

  it('keeps the host half out of the browser half', () => {
    for (const path of hostFiles) {
      expect(importsInto(path, 'src/client'), `${path} imports src/client/**`).toBe(false)
    }
  })

  it('never spawns a process or calls git from the browser half', () => {
    for (const path of clientFiles) {
      const text = source(path)
      expect(text, path).not.toMatch(/\bchild_process\b/)
      expect(text, path).not.toMatch(/['"`]git['"`]/)
    }
  })
})
