/**
 * DSH sandbox provider (`ctx.sandbox`) delegating confinement to the
 * heimdall-sandbox binary — `heimdall-sandbox exec --policy <file>`.
 *
 * One policy JSON file is written per `confine()` call into a fresh private
 * temp directory; the returned argv points the consumer's spawn at it. The
 * directories are removed when the provider stops (a crashed server leaks
 * small JSON files into the platform temp dir until OS cleanup). The child's
 * argv and cwd travel inside the document because heimdall rejects positional
 * commands combined with `--policy`; stdio passes through with `inherit`.
 *
 * Enforcement is reported as `full`: macOS runs Seatbelt, Linux bubblewrap,
 * both closed-by-default in heimdall-sandbox 0.1.45. Runner failures are the
 * binary's misconfiguration contract (exit 2 + `invalid policy: `) plus the
 * underlying runner dialects passing through.
 *
 * @module dsh-heimdall-sandbox
 */

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { ConfinedArgv, RunnerFailureRule, SandboxPolicy } from '@deepseek-ai/dsh-sandbox'
import { SandboxProvider } from '@deepseek-ai/dsh-sandbox'

import { buildPolicyDocument, type PolicyOptions } from './policy.ts'

/** Plugin config. All optional — `static Config` supplies the defaults. */
export interface Config {
  /**
   * Path to the heimdall-sandbox binary. Empty resolves the npm wrapper
   * (`@casualjim/heimdall-sandbox`), then `heimdall-sandbox` on PATH.
   */
  binaryPath?: string
  /** Additional writable roots granted under `workspace-write`, beyond the session workspace. */
  extraWritableRoots?: string[]
  /**
   * Deny entries passed to heimdall verbatim: `~/secrets`, absolute paths,
   * ordered `!negations`. Denied beats writable.
   */
  deniedPaths?: string[]
  /**
   * Per-workspace overrides keyed by an exact workspace root or a directory
   * prefix of it (longest key wins). Both lists append to the global ones;
   * denied beats writable, and `!` negations carve exceptions back out.
   * Kept in deployment config on purpose: a file inside the workspace could
   * be edited by the very code the sandbox confines.
   */
  projects?: Record<string, ProjectOverrides>
}

/** Per-project exception lists, appended to the deployment-wide ones. */
export interface ProjectOverrides {
  extraWritableRoots?: string[]
  deniedPaths?: string[]
}

/** The stderr dialect a kernel denial produces under the platform's backend. */
const DENIAL_SIGNATURES: Record<string, readonly string[]> = {
  darwin: ['operation not permitted'],
  linux: ['read-only file system', 'permission denied'],
}

/**
 * Runner-failure evidence: the command never ran. The binary's own
 * misconfiguration contract (exit 2) plus the underlying runner dialects
 * passing through unchanged.
 */
const RUNNER_FAILURE_RULES: readonly RunnerFailureRule[] = [
  { allowedExitCodes: [2], fatalSignatures: ['invalid policy: ', 'missing command'] },
  { fatalSignatures: ['sandbox-exec: '] },
  { fatalSignatures: ['bwrap: '] },
]

function isUsableBinary(path: string | undefined): path is string {
  if (!path) return false
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

/** Locate the heimdall-sandbox binary: config, then npm wrapper, then PATH. */
export function resolveBinaryPath(configured: string | undefined): string {
  if (isUsableBinary(configured)) return configured
  try {
    const candidate = fileURLToPath(import.meta.resolve('@casualjim/heimdall-sandbox/bin/heimdall-sandbox.js'))
    if (isUsableBinary(candidate)) return candidate
  } catch {
    // wrapper package not installed with this deployment
  }
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue
    const found = join(dir, 'heimdall-sandbox')
    if (isUsableBinary(found)) return found
  }
  throw new Error(
    'heimdall-sandbox binary not found: configure sandbox.binaryPath, install @casualjim/heimdall-sandbox, or put heimdall-sandbox on PATH',
  )
}

/**
 * The override entry whose key is the workspace root itself or a directory
 * prefix of it; the longest matching key wins.
 */
function matchProject(
  projects: Record<string, ProjectOverrides> | undefined,
  root: string,
): ProjectOverrides | undefined {
  if (!projects) return undefined
  let best: ProjectOverrides | undefined
  let bestLength = -1
  for (const [key, overrides] of Object.entries(projects)) {
    const prefix = key.endsWith('/') ? key : `${key}/`
    if ((root === key || root.startsWith(prefix)) && key.length > bestLength) {
      best = overrides
      bestLength = key.length
    }
  }
  return best
}

/**
 * Per-project grants from `<workspaceRoot>/.dsh/heimdall.json`; `undefined`
 * when the file is absent. The file IS the opt-in: committing it to a repo
 * lets that repo widen its own writables to any path not covered by the
 * global deny corpus (global `deniedPaths` still beat every writable).
 * Malformed content fails loudly — a silently ignored sandbox grant is a
 * misconfiguration, not a fallback.
 */
function readWorkspacePolicy(root: string): ProjectOverrides | undefined {
  const path = join(root, '.dsh', 'heimdall.json')
  let raw: string
  try {
    raw = readFileSync(path, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw new Error(`heimdall-sandbox: cannot read ${path}: ${(err as Error).message}`)
  }
  try {
    return JSON.parse(raw) as ProjectOverrides
  } catch {
    throw new Error(`heimdall-sandbox: invalid JSON in ${path}`)
  }
}

export class HeimdallSandboxProvider extends SandboxProvider {
  // Inline schema call: the config catalog walks `static Config` statically.
  static Config: z<Config> = z.object({
    binaryPath: z.string(),
    extraWritableRoots: z.array(z.string()),
    deniedPaths: z.array(z.string()),
    projects: z.dict(z.object({
      extraWritableRoots: z.array(z.string()),
      deniedPaths: z.array(z.string()),
    })),
  })

  private readonly options: PolicyOptions
  private readonly projects: Record<string, ProjectOverrides> | undefined
  private readonly binaryPath: string
  private readonly policyDirs = new Set<string>()
  /** Test seam + explicit teardown, mirroring the local provider's internals idiom. */
  readonly internals: { dispose: () => void }

  constructor(ctx: Context, config: Config) {
    super(ctx)
    if (process.platform !== 'darwin' && process.platform !== 'linux') {
      throw new Error(`heimdall-sandbox provider supports darwin and linux, not ${process.platform}`)
    }
    this.binaryPath = resolveBinaryPath((config.binaryPath as string) || undefined)
    this.options = {
      extraWritableRoots: config.extraWritableRoots as string[],
      deniedPaths: config.deniedPaths as string[],
    }
    this.projects = config.projects as Record<string, ProjectOverrides> | undefined
    const dispose = (): void => {
      for (const dir of this.policyDirs) {
        try {
          rmSync(dir, { recursive: true, force: true })
        } catch {
          // best-effort cleanup; OS temp sweeps cover residue
        }
      }
      this.policyDirs.clear()
    }
    this.internals = { dispose }
    // Policy temp files are reversible state: every directory created by
    // confine() is removed when the provider stops.
    ctx.effect(() => dispose)
  }

  confine(argv: readonly string[], policy: SandboxPolicy): ConfinedArgv {
    const override = matchProject(this.projects, policy.workspaceRoot)
    const workspace = readWorkspacePolicy(policy.workspaceRoot)
    const options: PolicyOptions = override || workspace
      ? {
          extraWritableRoots: [
            ...(this.options.extraWritableRoots ?? []),
            ...(override?.extraWritableRoots ?? []),
            ...(workspace?.extraWritableRoots ?? []),
          ],
          deniedPaths: [
            ...(this.options.deniedPaths ?? []),
            ...(override?.deniedPaths ?? []),
            ...(workspace?.deniedPaths ?? []),
          ],
        }
      : this.options
    const document = buildPolicyDocument(argv, policy, options)
    const dir = mkdtempSync(join(tmpdir(), 'dsh-heimdall-'))
    this.policyDirs.add(dir)
    const policyFile = join(dir, 'policy.json')
    writeFileSync(policyFile, `${JSON.stringify(document)}\n`)
    return {
      argv: [this.binaryPath, 'exec', '--policy', policyFile],
      enforcement: 'full',
      denialSignatures: DENIAL_SIGNATURES[process.platform] ?? [],
      runnerFailureRules: RUNNER_FAILURE_RULES,
    }
  }

  /** Probe the binary once so a broken install fails at composition time. */
  verify(): void {
    const probe = spawnSync(this.binaryPath, ['--version'], { timeout: 10_000 })
    if (probe.error !== undefined || probe.status !== 0) {
      throw new Error(`heimdall-sandbox binary at ${this.binaryPath} did not answer --version`)
    }
  }
}

export default HeimdallSandboxProvider
