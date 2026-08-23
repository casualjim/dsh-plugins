/**
 * Heimdall config loading for DSH: row config (from the `dsh-heimdall` patch
 * entry) deep-merged over a project-level `.pi/heimdall.jsonc` at the session
 * workspace root. Ported from pi-heimdall's heimdall-config.ts.
 *
 * @module dsh-heimdall/config
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse, type ParseError } from 'jsonc-parser'

export interface CommandPolicy {
  name: string
  blocked: string[]
  message: string
  /** When true, block matched command only if its shell segment is not bare (has pipe or redirect). Absent → unconditional block. */
  bare?: boolean
}

export interface Config {
  /** Opt-out guard ids. */
  disabled?: string[]
  /** Repo command policies; also loadable from `.pi/heimdall.jsonc`. */
  commandPolicies?: CommandPolicy[]
  /** Path (relative to the workspace root) of the secret-key manifest. Default `.env.json`. */
  dotenv?: string
}

export const OPT_OUT_GUARD_IDS = [
  'secret-guard',
  'command-policy-guard',
  'env-protect',
  'kubectl-secret-guard',
  'sops-secret-guard',
] as const

export interface LoadedConfig {
  config: Config
  disabled: ReadonlySet<string>
}

function parseConfigText(raw: string): Config | null {
  try {
    const errors: ParseError[] = []
    const parsed = parse(raw, errors, { allowTrailingComma: true })
    if (errors.length === 0 && parsed && typeof parsed === 'object') return parsed as Config
  } catch {
    // Parse error — fall through.
  }
  return null
}

function loadConfigFile(path: string | undefined): Config | null {
  if (!path || !existsSync(path)) return null
  try {
    return parseConfigText(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/** pi parity: later levels override earlier values and append arrays. */
export function deepMerge(base: Config, overrides: Config): Config {
  const result: Record<string, unknown> = { ...base }
  for (const key of Object.keys(overrides) as (keyof Config)[]) {
    const ov = overrides[key]
    if (ov === undefined) continue
    const bv = base[key]
    if (
      typeof ov === 'object' && ov !== null && !Array.isArray(ov) &&
      typeof bv === 'object' && bv !== null && !Array.isArray(bv)
    ) {
      result[key] = deepMerge(bv as Config, ov as Config)
    } else if (Array.isArray(ov) && Array.isArray(bv)) {
      result[key] = [...bv, ...ov]
    } else {
      result[key] = ov
    }
  }
  return result as Config
}

function projectConfigPath(workspaceRoot: string): string | undefined {
  const dir = join(workspaceRoot, '.pi')
  const jsonc = join(dir, 'heimdall.jsonc')
  if (existsSync(jsonc)) return jsonc
  const json = join(dir, 'heimdall.json')
  if (existsSync(json)) return json
  return undefined
}

/**
 * Merge the row config with the project-level config at `workspaceRoot` and
 * fold the `disabled` array into a set for per-call checks.
 */
export function loadConfig(workspaceRoot: string | undefined, rowConfig: Config): LoadedConfig {
  let config: Config = { ...rowConfig }
  if (workspaceRoot) {
    const project = loadConfigFile(projectConfigPath(workspaceRoot))
    if (project) config = deepMerge(config, project)
  }
  const disabled = new Set(config.disabled ?? [])
  return { config, disabled }
}

/** Where the secret-key manifest lives for one workspace root. */
export function dotenvPath(workspaceRoot: string | undefined, config: Config): string | undefined {
  if (!workspaceRoot) return undefined
  return join(workspaceRoot, config.dotenv ?? '.env.json')
}
