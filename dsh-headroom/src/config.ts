/**
 * Configuration resolution: cordis row config wins, environment next,
 * defaults last. Ported from noheadroom's `config.ts` with DSH naming.
 */

import { deepFreeze } from '@deepseek-ai/dsh-llm'
import type {
  HeadroomConfig,
  HeadroomMode,
  ResolvedHeadroomConfig,
} from './types.js'

export const DEFAULTS: ResolvedHeadroomConfig = deepFreeze({
  enabled: true,
  baseUrl: null,
  mode: 'normal',
  minContextTokens: 20_000,
  minMessageChars: 2_000,
  timeoutMs: 30_000,
  throttleMs: 3_000,
  allowRemote: false,
  renameToolCalls: true,
  maxSeenFingerprints: 512,
})

const CONFIG_KEYS: ReadonlySet<string> = new Set([
  'enabled',
  'baseUrl',
  'mode',
  'minContextTokens',
  'minMessageChars',
  'timeoutMs',
  'throttleMs',
  'allowRemote',
  'renameToolCalls',
  'maxSeenFingerprints',
])

const HEADROOM_MODES: readonly HeadroomMode[] = ['normal', 'quiet', 'silent']

/** Normalize a configured or environment-provided URL; empty → null (degrade). */
export function normalizeBaseUrl(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  const trimmed = raw.trim().replace(/\/+$/, '')
  return trimmed.length === 0 ? null : trimmed
}

/** Whether the URL names the loopback host. */
export function isLocalHeadroomUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)
  } catch {
    return false
  }
}

/** Remote URLs are refused unless the user explicitly allowed them. */
export function isRemoteBlocked(
  config: Pick<ResolvedHeadroomConfig, 'baseUrl' | 'allowRemote'>,
): boolean {
  return config.baseUrl !== null
    && !config.allowRemote
    && !isLocalHeadroomUrl(config.baseUrl)
}

function parseBoolean(raw: unknown, fallback: boolean): boolean {
  if (raw === undefined) return fallback
  if (typeof raw === 'boolean') return raw
  if (typeof raw !== 'string') return fallback
  const normalized = raw.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function parseInteger(raw: unknown, fallback: number, min: number): number {
  if (raw === undefined) return fallback
  const parsed = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN
  if (!Number.isFinite(parsed) || parsed < min) return fallback
  return Math.trunc(parsed)
}

function parseMode(raw: unknown, envRaw: string | undefined, fallback: HeadroomMode): HeadroomMode {
  const normalize = (value: unknown): HeadroomMode | null => {
    if (typeof value !== 'string') return null
    const trimmed = value.trim().toLowerCase() as HeadroomMode
    return HEADROOM_MODES.includes(trimmed) ? trimmed : null
  }
  return normalize(raw) ?? normalize(envRaw) ?? fallback
}

/**
 * Resolve and validate the merged configuration. The cordis row `config`
 * wins over environment, environment over defaults. `baseUrl` resolves to
 * `null` when neither names a proxy — the degraded mode, never a hard error.
 */
export function resolveConfig(
  config: HeadroomConfig = {},
  env: NodeJS.ProcessEnv = process.env,
): ResolvedHeadroomConfig {
  for (const key of Object.keys(config)) {
    if (!CONFIG_KEYS.has(key)) {
      throw new Error(
        `HeadroomConfig: unknown key "${key}" `
        + `(allowed: ${[...CONFIG_KEYS].join(', ')})`,
      )
    }
  }

  const envBaseUrl = normalizeBaseUrl(
    env.DSH_HEADROOM_URL ?? env.HEADROOM_URL ?? env.HEADROOM_BASE_URL,
  )
  const baseUrl = normalizeBaseUrl(config.baseUrl === undefined ? envBaseUrl : config.baseUrl)

  const resolved: ResolvedHeadroomConfig = {
    enabled: parseBoolean(config.enabled, parseBoolean(env.DSH_HEADROOM_ENABLED, DEFAULTS.enabled)),
    baseUrl,
    mode: parseMode(config.mode, env.DSH_HEADROOM_MODE, DEFAULTS.mode),
    minContextTokens: parseInteger(
      config.minContextTokens,
      parseInteger(env.DSH_HEADROOM_MIN_CONTEXT_TOKENS, DEFAULTS.minContextTokens, 0),
      0,
    ),
    minMessageChars: parseInteger(
      config.minMessageChars,
      parseInteger(env.DSH_HEADROOM_MIN_MESSAGE_CHARS, DEFAULTS.minMessageChars, 1),
      1,
    ),
    timeoutMs: parseInteger(
      config.timeoutMs,
      parseInteger(env.DSH_HEADROOM_TIMEOUT_MS, DEFAULTS.timeoutMs, 100),
      100,
    ),
    throttleMs: parseInteger(
      config.throttleMs,
      parseInteger(env.DSH_HEADROOM_THROTTLE_MS, DEFAULTS.throttleMs, 0),
      0,
    ),
    allowRemote: parseBoolean(
      config.allowRemote,
      parseBoolean(env.DSH_HEADROOM_ALLOW_REMOTE, DEFAULTS.allowRemote),
    ),
    renameToolCalls: parseBoolean(
      config.renameToolCalls,
      parseBoolean(env.DSH_HEADROOM_RENAME_TOOL_CALLS, DEFAULTS.renameToolCalls),
    ),
    maxSeenFingerprints: parseInteger(
      config.maxSeenFingerprints,
      parseInteger(env.DSH_HEADROOM_MAX_SEEN_FINGERPRINTS, DEFAULTS.maxSeenFingerprints, 16),
      16,
    ),
  }
  return deepFreeze(structuredClone(resolved))
}
