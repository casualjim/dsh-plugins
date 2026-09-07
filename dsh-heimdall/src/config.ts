/**
 * Heimdall config loading for DSH — the one parser and one representation
 * for every heimdall config consumer in this repo.
 *
 * Config resolves from fixed universal locations. Agent-owned legacy paths
 * (`.pi/`, `.omp/`, `.dsh/` heimdall files) are MIGRATED on load — merged,
 * written to the universal location, deleted — and never read as a fallback:
 *
 *   - Row config:  the `dsh-heimdall` patch entry (deployment layer)
 *   - User level:  ~/.config/heimdall/config.jsonc (fallback: config.json)
 *   - Project:     `<workspaceRoot>/.config/heimdall.json` (fallback: .json)
 *
 * The row config is the base; each file layer overrides scalars and appends
 * arrays on top, matching pi-heimdall's merge semantics. Every field of the
 * file schema (guards + `sandbox`) merges by per-field schema rules.
 *
 * `dsh-heimdall-sandbox` imports {@link loadSandboxSections} and
 * {@link mergeSandboxOptions} from here via the `dsh-heimdall/config`
 * subpath — it owns no parser and no merge of its own.
 *
 * @module dsh-heimdall/config
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse, type ParseError } from 'jsonc-parser'

export interface CommandPolicy {
  name: string
  blocked: string[]
  message: string
  /** When true, block matched command only if its shell segment is not bare (has pipe or redirect). Absent → unconditional block. */
  bare?: boolean
}

export interface SandboxOptions {
  /**
   * Pi-local integration fields. NOT part of the native heimdall-sandbox
   * policy; carried so the universal file round-trips through both harnesses.
   */
  enabled?: boolean
  binaryPath?: string
  useDefaultFilesystemDeny?: boolean
  filesystem?: {
    /** Paths denied for reads AND writes; supports `~` and ordered `!` negations. */
    deny?: string[]
    /** The only writable subtrees; omitted/empty under read-only intent. */
    writable?: string[]
    /** In-sandbox path -> host path mounts; usable under every mode. */
    virtual?: Record<string, string>
  }
  env?: {
    /** Parent env vars preserved in the child; absent = binary default set. */
    allow?: string[]
    /** Parent env vars removed (blocklist mode); denied env beats allow. */
    deny?: string[]
  }
  /** `host` (default) or `none`; unknown values are the binary's contract. */
  network?: string
  /** `default` or `none` (`--no-proc`); unknown values are the binary's contract. */
  proc?: string
  /** Mount the SSH agent socket under Linux isolation. */
  sshAgent?: boolean
  /** Mount GnuPG agent, keyboxd, and dirmngr sockets under Linux isolation. */
  gpgAgent?: boolean
  /** Mount age-compatible agent sockets under Linux isolation. */
  ageAgent?: boolean
}

export interface Config {
  /** Opt-out guard ids. */
  disabled?: string[]
  /** Repo command policies; also loadable from `.config/heimdall.json`. */
  commandPolicies?: CommandPolicy[]
  /** Path (relative to the workspace root) of the secret-key manifest. Default `.env.json`. */
  dotenv?: string
  /** Native-sandbox policy fragment; consumed by dsh-heimdall-sandbox. */
  sandbox?: SandboxOptions
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
  /** Problems found during migration (unparseable legacy files kept in place). */
  migrationErrors: string[]
}

function parseConfigText(raw: string): Config | null {
  const errors: ParseError[] = []
  const parsed: unknown = parse(raw, errors, { allowTrailingComma: true })
  if (errors.length === 0 && parsed && typeof parsed === 'object') return parsed as Config
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

/** Order-preserving string-list union: later entries append, duplicates drop. */
/** Plain layer-order concat: deny/writable are ordered last-match-wins
 *  negation lists — later layers may repeat entries to re-assert over
 *  intervening `!` negations, so never dedupe here. */
function mergeStringLists(base: readonly string[] | undefined, overrides: readonly string[] | undefined): string[] | undefined {
  if (!base?.length && !overrides?.length) return undefined
  return [...(base ?? []), ...(overrides ?? [])]
}

/** Nullable string-list merge: explicit `null` clears the list. */
function mergeNullableStringList(base: readonly string[] | null | undefined, overrides: readonly string[] | null | undefined): string[] | null | undefined {
  if (overrides === null) return null
  if (overrides === undefined) return base == null ? undefined : [...base]
  return mergeStringLists(base ?? [], overrides)
}

/** Pi parity: scalars take the later layer that defines them; absent stays absent. */
function overrideScalar<T>(base: T | undefined, overrides: T | undefined): T | undefined {
  return overrides !== undefined ? overrides : base
}

/**
 * The `sandbox` section merge with per-field schema rules: string lists
 * append value-deduped (deny order matters — `!` negations), `virtual`
 * mounts merge by key, env lists are nullable, scalars later-wins. Pi-local
 * integration fields (`enabled`, `binaryPath`, `useDefaultFilesystemDeny`)
 * ride along as scalars.
 */
export function mergeSandboxOptions(...layers: (SandboxOptions | undefined)[]): SandboxOptions {
  // Schema-normalized configs carry `env: {allow: [], deny: []}` and
  // `filesystem: {deny: [], writable: [], virtual: {}}` defaults even when
  // nothing was configured — an empty list means "not configured", not
  // "block everything", so empty values are ignored at fold time.
  const empty = (list?: string[]): boolean => list === undefined || list.length === 0
  const defined = (layer: SandboxOptions): SandboxOptions => {
    const filesystem = layer.filesystem === undefined ? undefined : {
      ...(layer.filesystem.deny?.length && { deny: layer.filesystem.deny }),
      ...(layer.filesystem.writable?.length && { writable: layer.filesystem.writable }),
      ...(layer.filesystem.virtual && Object.keys(layer.filesystem.virtual).length && { virtual: layer.filesystem.virtual }),
    }
    const env = layer.env === undefined ? undefined : {
      ...(!empty(layer.env.allow) && { allow: layer.env.allow }),
      ...(!empty(layer.env.deny) && { deny: layer.env.deny }),
    }
    const { filesystem: _fs, env: _env, ...scalars } = layer
    return {
      ...scalars,
      ...(filesystem && Object.keys(filesystem).length && { filesystem }),
      ...(env && Object.keys(env).length && { env }),
    }
  }
  let merged: SandboxOptions | undefined
  for (const layer of layers) {
    if (!layer) continue
    const next = defined(layer)
    if (merged === undefined) {
      merged = next
      continue
    }
    const deny = mergeStringLists(merged.filesystem?.deny, next.filesystem?.deny)
    const writable = mergeStringLists(merged.filesystem?.writable, next.filesystem?.writable)
    const virtual = { ...merged.filesystem?.virtual, ...next.filesystem?.virtual }
    const filesystem: SandboxOptions['filesystem'] = {
      ...(deny?.length && { deny }),
      ...(writable?.length && { writable }),
      ...(Object.keys(virtual).length && { virtual }),
    }
    // env stays ABSENT when no layer defines it — an empty allow/deny block
    // would flip the binary into its blocklist mode with nothing allowed.
    const allow = mergeNullableStringList(merged.env?.allow, next.env?.allow)
    const denyEnv = mergeNullableStringList(merged.env?.deny, next.env?.deny)
    const env: SandboxOptions['env'] = {
      ...(allow?.length && { allow }),
      ...(denyEnv?.length && { deny: denyEnv }),
    }
    merged = {
      ...merged,
      enabled: overrideScalar(merged.enabled, next.enabled),
      binaryPath: overrideScalar(merged.binaryPath, next.binaryPath),
      useDefaultFilesystemDeny: overrideScalar(merged.useDefaultFilesystemDeny, next.useDefaultFilesystemDeny),
      network: overrideScalar(merged.network, next.network),
      proc: overrideScalar(merged.proc, next.proc),
      sshAgent: overrideScalar(merged.sshAgent, next.sshAgent),
      gpgAgent: overrideScalar(merged.gpgAgent, next.gpgAgent),
      ageAgent: overrideScalar(merged.ageAgent, next.ageAgent),
    }
    if (Object.keys(env).length) merged.env = env
    if (Object.keys(filesystem).length) merged.filesystem = filesystem
  }
  return merged ?? {}
}

/** pi parity: later levels override earlier values and append arrays. */
export function deepMerge(base: Config, overrides: Config): Config {
  const result: Config = { ...base }
  for (const key of Object.keys(overrides) as (keyof Config)[]) {
    const ov = overrides[key]
    if (ov === undefined) continue
    switch (key) {
      case 'disabled': {
        result.disabled = [...(result.disabled ?? []), ...(overrides.disabled ?? [])]
        break
      }
      case 'commandPolicies': {
        result.commandPolicies = [...(result.commandPolicies ?? []), ...(overrides.commandPolicies ?? [])]
        break
      }
      case 'sandbox': {
        result.sandbox = mergeSandboxOptions(result.sandbox, overrides.sandbox)
        break
      }
      default: {
        if (key === 'dotenv') result.dotenv = overrides.dotenv
      }
    }
  }
  return result
}

/** The universal user-level config dir (fixed: `~/.config/heimdall`). */
function heimdallConfigDir(): string {
  return join(homedir(), '.config', 'heimdall')
}

/**
 * Load both spellings of one config level, merging when both exist:
 * `basename.json` is the base, `basename.jsonc` overrides it.
 */
function loadConfigLevel(dir: string, basename: string): { path: string | undefined; config: Config | null } {
  const jsonPath = join(dir, `${basename}.json`)
  const jsoncPath = join(dir, `${basename}.jsonc`)
  const jsonConfig = loadConfigFile(existsSync(jsonPath) ? jsonPath : undefined)
  const jsoncConfig = loadConfigFile(existsSync(jsoncPath) ? jsoncPath : undefined)
  // path echoes an EXISTING file even when both spellings failed to parse —
  // the strict consumer ({@link loadSandboxSections}) distinguishes "no
  // file" (path undefined) from "file exists but unparseable" (config null).
  if (!jsonConfig && !jsoncConfig) {
    return { path: existsSync(jsoncPath) || existsSync(jsonPath) ? (existsSync(jsoncPath) ? jsoncPath : jsonPath) : undefined, config: null }
  }
  return {
    path: existsSync(jsoncPath) ? jsoncPath : jsonPath,
    config: jsoncConfig ? deepMerge(jsonConfig ?? {}, jsoncConfig) : jsonConfig,
  }
}

/** Legacy user-level config files across all runtimes (pi, omp, dsh). */
function legacyUserConfigFiles(): string[] {
  const home = homedir()
  const files: string[] = []
  for (const dir of [join(home, '.pi', 'agent'), join(home, '.omp', 'agent')]) {
    for (const name of ['heimdall.json', 'heimdall.jsonc']) {
      const p = join(dir, name)
      if (existsSync(p)) files.push(p)
    }
  }
  // DSH's user-global file lives directly under its home dir.
  for (const name of ['heimdall.json', 'heimdall.jsonc']) {
    const p = join(home, '.dsh', name)
    if (existsSync(p)) files.push(p)
  }
  return files
}

/** Legacy project-level config files across all runtimes. */
function legacyProjectConfigFiles(workspaceRoot: string): string[] {
  const files: string[] = []
  for (const dir of ['.pi', '.omp', '.dsh']) {
    for (const name of ['heimdall.json', 'heimdall.jsonc']) {
      const p = join(workspaceRoot, dir, name)
      if (existsSync(p)) files.push(p)
    }
  }
  return files
}

/**
 * Mandatory one-way migration. When the universal target exists, the legacy
 * files are dead weight and simply deleted. When it does not and legacy
 * files exist, they are merged (dir order `.pi` → `.omp` → `.dsh`; per dir,
 * JSON is the base and JSONC overrides it), written to the universal
 * location, and the legacy files are deleted. There is no fallback read —
 * after this function returns, only universal locations are consulted.
 *
 * Unparseable legacy files may hold fixable content — never merged or
 * deleted; the caller classifies and reports them.
 */
function migrate(legacyFiles: string[], targetDir: string, targetBasename: string): string | undefined {
  if (legacyFiles.length === 0) return undefined
  const unparseable = legacyFiles.filter((file) => loadConfigFile(file) === null)
  const parseable = legacyFiles.filter((file) => !unparseable.includes(file))
  if (parseable.length === 0) return undefined // nothing to migrate
  let merged: Config | null = null
  for (const file of parseable) {
    merged = deepMerge(merged ?? {}, loadConfigFile(file) ?? {})
  }
  mkdirSync(targetDir, { recursive: true })
  const targetPath = join(targetDir, `${targetBasename}.json`)
  writeFileSync(targetPath, `${JSON.stringify(merged ?? {}, null, '\t')}\n`)
  for (const file of parseable) {
    try {
      rmSync(file, { force: true })
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`dsh-heimdall: failed to remove migrated config ${file}: ${(err as Error).message}`)
      }
    }
  }
  return targetPath
}

/** Migrate the user-level config; returns the target path when written. */
export function migrateUserConfig(configDir: string = heimdallConfigDir(), migrationErrors: string[] = []): string | undefined {
  const files = legacyUserConfigFiles()
  const unparseable = files.filter((file) => loadConfigFile(file) === null)
  if (unparseable.length > 0) {
    migrationErrors.push(`unparseable legacy user config kept in place, fix or remove: ${unparseable.join(', ')}`)
  }
  const target = loadConfigLevel(configDir, 'config')
  if (target.path) {
    // Universal config exists — parseable legacy files are dead weight.
    for (const file of files) {
      if (!unparseable.includes(file)) rmSync(file, { force: true })
    }
    return undefined
  }
  return migrate(files, configDir, 'config')
}

/** Migrate the workspace config; returns the target path when written. */
export function migrateWorkspaceConfig(workspaceRoot: string, migrationErrors: string[] = []): string | undefined {
  const files = legacyProjectConfigFiles(workspaceRoot)
  const unparseable = files.filter((file) => loadConfigFile(file) === null)
  if (unparseable.length > 0) {
    migrationErrors.push(`unparseable legacy project config kept in place, fix or remove: ${unparseable.join(', ')}`)
  }
  const targetDir = join(workspaceRoot, '.config')
  const target = loadConfigLevel(targetDir, 'heimdall')
  if (target.path) {
    // Universal config exists — parseable legacy files are dead weight.
    for (const file of files) {
      if (!unparseable.includes(file)) rmSync(file, { force: true })
    }
    return undefined
  }
  return migrate(files, targetDir, 'heimdall')
}
/**
 * Merge the row config with the universal user level
 * (`~/.config/heimdall/config.json(c)`) and the universal workspace file
 * (`<workspaceRoot>/.config/heimdall.json(c)`). Legacy
 * `{.pi,.omp,.dsh}/heimdall.json(c)` files — user and workspace level — are
 * migrated (merged, written, deleted) before the universal levels load; they
 * are never read as a fallback. Fold the `disabled` array into a set for
 * per-call checks.
 */
export function loadConfig(workspaceRoot: string | undefined, rowConfig: Config): LoadedConfig {
  const migrationErrors: string[] = []
  let config: Config = { ...rowConfig }
  migrateUserConfig(heimdallConfigDir(), migrationErrors)
  config = deepMerge(config, loadConfigLevel(heimdallConfigDir(), 'config').config ?? {})
  if (workspaceRoot) {
    migrateWorkspaceConfig(workspaceRoot, migrationErrors)
    const project = loadConfigLevel(join(workspaceRoot, '.config'), 'heimdall').config
    if (project) config = deepMerge(config, project)
  }
  const disabled = new Set(config.disabled ?? [])
  for (const message of migrationErrors) console.warn(`dsh-heimdall: ${message}`)
  return { config, disabled, migrationErrors }
}

/** Where the secret-key manifest lives for one workspace root. */
export function dotenvPath(workspaceRoot: string | undefined, config: Config): string | undefined {
  if (!workspaceRoot) return undefined
  return join(workspaceRoot, config.dotenv ?? '.env.json')
}

/** pi parity: the private-path deny corpus shared across harnesses. */
export const DEFAULT_PRIVATE_PATHS: readonly string[] = [
  '~/Private', '~/.ssh', '~/.config', '~/.aws', '~/.azure', '~/.gcloud', '~/.oci', '~/.kube', '~/.docker',
  '~/.gnupg', '~/.sops', '~/.age', '~/.password-store', '~/.terraform.d', '~/.vault-token', '~/.netrc', '~/.npmrc',
  '~/.pypirc', '~/.cargo/credentials', '~/.cargo/credentials.toml',
  // AI coding tools (CLI agents, AI-native IDEs) — API keys commonly stored here.
  '~/.claude', '~/.codex', '~/.forge', '~/.cursor', '~/.windsurf', '~/.antigravity', '~/.kiro', '~/.augment',
  '~/.zed', '~/.aider', '~/.gemini', '~/.continue', '~/.codeium', '~/.openai', '~/.anthropic',
  // Editor / IDE configs (may contain stored auth tokens)
  '~/.vscode', '~/.vscode-server', '~/.code', '~/.config/JetBrains', '~/.local/share/JetBrains',
  '~/.config/nvim', '~/.local/share/nvim', '~/.vim', '~/.viminfo',
]

/**
 * The generated-defaults template — byte-identical to pi-heimdall's
 * `defaultConfigText()` so both harnesses regenerate the same bytes and the
 * shared file never flaps. The corpus is owned by the generated file; user
 * config owns overrides.
 */
export function defaultConfigText(): string {
  const denyList = DEFAULT_PRIVATE_PATHS.map((path) => `\t\t\t\t${JSON.stringify(path)}`).join(',\n')
  return `// Generated by pi-heimdall for transparency.\n// This file may be overwritten when Heimdall starts.\n// Put local changes in config.jsonc or a project .config/heimdall.json file.\n{\n\t"sandbox": {\n\t\t"enabled": false,\n\t\t"useDefaultFilesystemDeny": true,\n\t\t"sshAgent": false,\n\t\t"gpgAgent": false,\n\t\t"ageAgent": false,\n\t\t"filesystem": {\n\t\t\t"deny": [\n${denyList}\n\t\t\t],\n\t\t\t"writable": [\n\t\t\t\t"~/.pi"\n\t\t\t]\n\t\t}\n\t}\n}\n`
}

/** Regenerate `default.jsonc` on every load; user config is never touched. */
function ensureGeneratedDefaultConfig(): string {
  mkdirSync(heimdallConfigDir(), { recursive: true })
  const defaultPath = join(heimdallConfigDir(), 'default.jsonc')
  writeFileSync(defaultPath, defaultConfigText())
  return defaultPath
}

/**
 * The `sandbox` layers for consumers that only speak the native-sandbox
 * policy fragment (dsh-heimdall-sandbox): generated defaults (deny corpus),
 * the user level, and the workspace level — all universal locations. Runs
 * the same mandatory migration as {@link loadConfig} first; regenerates
 * `default.jsonc` (the corpus owner) on every load. Strict: a universal
 * file that exists but is unparseable, or carries a non-object `sandbox`
 * section, throws — a silently ignored sandbox grant is a misconfiguration,
 * not a fallback. `useDefaultFilesystemDeny: false` in user/workspace
 * config strips the GENERATED deny list (explicit entries stay).
 */
export function loadSandboxSections(workspaceRoot: string | undefined): {
  defaults: SandboxOptions | undefined
  user: SandboxOptions | undefined
  workspace: SandboxOptions | undefined
} {
  migrateUserConfig(heimdallConfigDir())
  ensureGeneratedDefaultConfig()
  if (workspaceRoot) migrateWorkspaceConfig(workspaceRoot)

  const sectionOf = (dir: string, basename: string): SandboxOptions | undefined => {
    const level = loadConfigLevel(dir, basename)
    if (level.path !== undefined && level.config === null) {
      throw new Error(`dsh-heimdall: invalid JSON in ${level.path}`)
    }
    const section = level.config?.sandbox
    if (section === undefined) return undefined
    if (typeof section !== 'object' || Array.isArray(section) || section === null) {
      throw new Error(`dsh-heimdall: ${level.path}: "sandbox" section must be a policy fragment object`)
    }
    return section as SandboxOptions
  }

  const defaults = sectionOf(heimdallConfigDir(), 'default')
  const user = sectionOf(heimdallConfigDir(), 'config')
  const workspace = workspaceRoot ? sectionOf(join(workspaceRoot, '.config'), 'heimdall') : undefined

  let effectiveDefaults = defaults
  if (defaults && defaults.filesystem?.deny?.length) {
    const flag = mergeSandboxOptions(defaults, user, workspace).useDefaultFilesystemDeny
    if (flag === false) {
      effectiveDefaults = {
        ...defaults,
        filesystem: { ...defaults.filesystem, deny: undefined },
      }
    }
  }

  return { defaults: effectiveDefaults, user, workspace }
}