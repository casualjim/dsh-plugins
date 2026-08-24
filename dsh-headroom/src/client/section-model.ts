/**
 * The `headroom` settings section value and its wire decoder. Pure, React-free
 * so the node test suite can validate the decode contract.
 */

export type HeadroomModeValue = 'normal' | 'quiet' | 'silent'

/** The settings section as the UI reads it. */
export interface HeadroomSectionValue {
  readonly enabled: boolean
  /** Proxy URL; `null` = unset (degraded no-op). */
  readonly baseUrl: string | null
  readonly mode: HeadroomModeValue
}

export const EMPTY_HEADROOM_SECTION: HeadroomSectionValue = Object.freeze({
  enabled: true,
  baseUrl: null,
  mode: 'normal',
})

const MODES: readonly HeadroomModeValue[] = ['normal', 'quiet', 'silent']

/**
 * Narrow one wire section. A malformed durable value reads as the empty
 * section so the UI never locks on a rejected shape; the Host schema is the
 * real validator for writes.
 */
export function decodeHeadroomSection(section: unknown): HeadroomSectionValue | undefined {
  if (typeof section !== 'object' || section === null || Array.isArray(section)) return undefined
  const value = section as Record<string, unknown>
  const mode: HeadroomModeValue = MODES.includes(value.mode as HeadroomModeValue)
    ? value.mode as HeadroomModeValue
    : EMPTY_HEADROOM_SECTION.mode
  return {
    enabled: value.enabled !== false,
    baseUrl: typeof value.baseUrl === 'string' && value.baseUrl.trim() !== ''
      ? value.baseUrl.trim()
      : null,
    mode,
  }
}
