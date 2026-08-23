import { describe, expect, it } from 'vitest'
import {
  DEFAULTS,
  isLocalHeadroomUrl,
  isRemoteBlocked,
  normalizeBaseUrl,
  resolveConfig,
} from '../src/config.js'
import type { HeadroomConfig, ResolvedHeadroomConfig } from '../src/types.js'

const EMPTY_ENV = {} as NodeJS.ProcessEnv

describe('resolveConfig', () => {
  it('resolves defaults with no config and no env', () => {
    expect(resolveConfig({}, EMPTY_ENV)).toEqual(DEFAULTS)
  })

  it('prefers row config over env over defaults', () => {
    const env = { DSH_HEADROOM_URL: 'http://127.0.0.1:9000', DSH_HEADROOM_ENABLED: 'off' } as NodeJS.ProcessEnv
    expect(resolveConfig({}, env)).toMatchObject({
      baseUrl: 'http://127.0.0.1:9000',
      enabled: false,
    })
    expect(resolveConfig({ baseUrl: 'http://localhost:8787', enabled: true }, env)).toMatchObject({
      baseUrl: 'http://localhost:8787',
      enabled: true,
    })
  })

  it('degrades to null baseUrl when nothing is configured', () => {
    expect(resolveConfig({}, EMPTY_ENV).baseUrl).toBeNull()
    expect(resolveConfig({ baseUrl: '' }, EMPTY_ENV).baseUrl).toBeNull()
    expect(resolveConfig({ baseUrl: '  ' }, EMPTY_ENV).baseUrl).toBeNull()
  })

  it('normalizes trailing slashes', () => {
    expect(normalizeBaseUrl('http://127.0.0.1:8788///')).toBe('http://127.0.0.1:8788')
    expect(normalizeBaseUrl(null)).toBeNull()
    expect(normalizeBaseUrl(undefined)).toBeNull()
  })

  it('rejects unknown keys', () => {
    expect(() => resolveConfig({ autoStart: true } as unknown as HeadroomConfig)).toThrow(/unknown key "autoStart"/)
  })

  it('enforces integer floors', () => {
    expect(resolveConfig({ minMessageChars: 0 }, EMPTY_ENV).minMessageChars).toBe(DEFAULTS.minMessageChars)
    expect(resolveConfig({ timeoutMs: 50 }, EMPTY_ENV).timeoutMs).toBe(DEFAULTS.timeoutMs)
  })

  it('validates the mode', () => {
    expect(resolveConfig({ mode: 'silent' }, EMPTY_ENV).mode).toBe('silent')
    expect(resolveConfig({}, { DSH_HEADROOM_MODE: 'loud' } as NodeJS.ProcessEnv).mode).toBe('normal')
  })

  it('freezes the resolved configuration', () => {
    expect(Object.isFrozen(resolveConfig({}))).toBe(true)
  })
})

describe('remote blocking', () => {
  const local: Pick<ResolvedHeadroomConfig, 'baseUrl' | 'allowRemote'> = {
    baseUrl: 'http://127.0.0.1:8788',
    allowRemote: false,
  }

  it('allows loopback hosts', () => {
    expect(isLocalHeadroomUrl('http://localhost:8788')).toBe(true)
    expect(isLocalHeadroomUrl('http://127.0.0.1:9000')).toBe(true)
    expect(isLocalHeadroomUrl('http://[::1]:8788')).toBe(true)
    expect(isLocalHeadroomUrl('not a url')).toBe(false)
  })

  it('blocks remote URLs unless allowed', () => {
    expect(isRemoteBlocked(local)).toBe(false)
    expect(isRemoteBlocked({ baseUrl: 'https://headroom.example.com', allowRemote: false })).toBe(true)
    expect(isRemoteBlocked({ baseUrl: 'https://headroom.example.com', allowRemote: true })).toBe(false)
    expect(isRemoteBlocked({ baseUrl: null, allowRemote: false })).toBe(false)
  })
})
