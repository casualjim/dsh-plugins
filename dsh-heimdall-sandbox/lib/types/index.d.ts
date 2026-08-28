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
 * The full pi-heimdall policy fragment (network, proc, env, filesystem
 * deny/writable/virtual, SSH/GnuPG/age agent sockets) is the config format,
 * verbatim — no renamed aliases. It merges from the deployment config, the
 * `projects` map, and the `sandbox` section of the per-workspace
 * `.dsh/heimdall.json` file (a multi-plugin file shared with dsh-heimdall's
 * `commandPolicies`) — lists append, scalars take the most specific layer
 * that defines them, absent fields stay at binary defaults.
 *
 * Enforcement is reported as `full`: macOS runs Seatbelt, Linux bubblewrap,
 * both closed-by-default. Since 0.2.0 denied reads FAIL (EPERM) instead of
 * masking. Runner failures are the binary's misconfiguration contract
 * (exit 2 + `invalid policy: `) plus the underlying runner dialects.
 *
 * @module dsh-heimdall-sandbox
 */
import { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { ConfinedArgv, SandboxPolicy } from '@deepseek-ai/dsh-sandbox';
import { SandboxProvider } from '@deepseek-ai/dsh-sandbox';
import { type PolicyOptions } from './policy.ts';
/**
 * Plugin config. All optional — `static Config` supplies the defaults.
 * Every policy-fragment field below is also valid inside a `projects`
 * entry and inside the `sandbox` section of the workspace
 * `.dsh/heimdall.json` file.
 */
export interface Config extends PolicyOptions {
    /**
     * Path to the heimdall-sandbox binary. Empty resolves the npm wrapper
     * (`@casualjim/heimdall-sandbox`), then `heimdall-sandbox` on PATH.
     */
    binaryPath?: string;
    /**
     * Per-workspace overrides keyed by an exact workspace root or a directory
     * prefix of it (longest key wins). Lists append to the global ones; denied
     * beats writable, and `!` negations carve exceptions back out. Kept in
     * deployment config on purpose: a file inside the workspace could be
     * edited by the very code the sandbox confines.
     */
    projects?: Record<string, PolicyOptions>;
}
/**
 * Alias for {@link PolicyOptions} — the per-project layer shape. Exactly one
 * shape everywhere: deployment config, project entries, workspace file.
 */
export type ProjectOverrides = PolicyOptions;
/** Locate the heimdall-sandbox binary: config, then npm wrapper, then PATH. */
export declare function resolveBinaryPath(configured: string | undefined): string;
/**
 * Fold policy layers most-general first: lists concatenate, virtual mounts
 * merge by key, scalars (`network`, `proc`, agent flags, env lists) take
 * the most specific layer that defines them. Absent fields stay absent —
 * the binary decides their defaults.
 */
export declare function mergeOptions(...layers: (PolicyOptions | undefined)[]): PolicyOptions;
export declare class HeimdallSandboxProvider extends SandboxProvider {
    static Config: z<Config>;
    private readonly options;
    private readonly projects;
    private readonly binaryPath;
    private readonly policyDirs;
    /** Test seam + explicit teardown, mirroring the local provider's internals idiom. */
    readonly internals: {
        dispose: () => void;
    };
    constructor(ctx: Context, config: Config);
    confine(argv: readonly string[], policy: SandboxPolicy): ConfinedArgv;
    /** Probe the binary once so a broken install fails at composition time. */
    verify(): void;
}
export default HeimdallSandboxProvider;
