import { describe, expect, it } from 'vitest'
import {
  decodeHeadroomSection,
  EMPTY_HEADROOM_SECTION,
} from '../src/client/section-model.js'

describe('decodeHeadroomSection', () => {
  it('accepts a well-formed section', () => {
    expect(decodeHeadroomSection({ enabled: false, baseUrl: 'http://127.0.0.1:8788', mode: 'silent' }))
      .toEqual({ enabled: false, baseUrl: 'http://127.0.0.1:8788', mode: 'silent' })
  })

  it('defaults missing or malformed fields', () => {
    expect(decodeHeadroomSection({})).toEqual(EMPTY_HEADROOM_SECTION)
    expect(decodeHeadroomSection({ enabled: false, baseUrl: 42, mode: 'loud' }))
      .toEqual({ enabled: false, baseUrl: null, mode: 'normal' })
  })

  it('normalizes whitespace-only URLs to null (degraded)', () => {
    expect(decodeHeadroomSection({ baseUrl: '   ' })).toMatchObject({ baseUrl: null })
  })

  it('rejects non-object sections', () => {
    expect(decodeHeadroomSection('nope')).toBeUndefined()
    expect(decodeHeadroomSection(null)).toBeUndefined()
    expect(decodeHeadroomSection(['x'])).toBeUndefined()
  })
})
