/**
 * Build one heimdall-sandbox policy document from a resolved DSH
 * {@link SandboxPolicy} plus the provider's configured policy fragment
 * (deployment-wide, per-project, and per-workspace layers merged upstream).
 *
 * Mode mapping (heimdall >= 0.1.45, deny semantics >= 0.2.0):
 * - `read-only`: a DECLARED but empty `filesystem` block confines read-only.
 *   The profile keeps cwd/HOME/platform reads and grants its platform temp
 *   areas — slightly wider than DSH's read-only promise; deployments that
 *   want the DSH-exact shape add those dirs to `filesystem.deny`.
 * - `workspace-write`: explicit writable list = workspace root + configured
 *   extra roots. Platform temps come from heimdall's profile defaults,
 *   matching DSH's `writableRoots` promise without restating them.
 * - Denied reads FAIL (EPERM) instead of masking; deny paths pass through
 *   verbatim in heimdall's own syntax (tilde expansion and ordered `!`
 *   negations included) — no reinterpretation.
 *
 * The remaining heimdall policy surface (network, proc, env, agent sockets,
 * virtual path mounts) passes through verbatim when configured and is simply
 * absent — binary defaults — when not.
 *
 * @module dsh-heimdall-sandbox/policy
 */
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox';
/** Filesystem rules of a heimdall-sandbox policy document. */
export interface HeimdallFilesystem {
    /** Paths denied for reads AND writes; supports `~` and ordered `!` negations. */
    deny?: string[];
    /** The only writable subtrees; omitted/empty under read-only intent. */
    writable?: string[];
    /** In-sandbox path -> host path mounts; usable under every mode. */
    virtual?: Record<string, string>;
}
/** Parent-environment filter of a heimdall-sandbox policy document. */
export interface HeimdallEnvPolicy {
    /** Parent env vars preserved in the child; absent = binary default set. */
    allow?: readonly string[];
    /** Parent env vars removed (blocklist mode); denied env beats allow. */
    deny?: readonly string[];
}
/** The JSON document accepted by `heimdall-sandbox exec --policy`. */
export interface HeimdallPolicyDocument {
    cwd: string;
    command: string[];
    stdio: 'inherit';
    /** `host` (default) or `none`; unknown values are the binary's contract. */
    network?: string;
    /** `default` or `none` (`--no-proc`); unknown values are the binary's contract. */
    proc?: string;
    env?: HeimdallEnvPolicy;
    filesystem: HeimdallFilesystem;
    /** Mount the SSH agent socket under Linux isolation. */
    sshAgent?: boolean;
    /** Mount GnuPG agent, keyboxd, and dirmngr sockets under Linux isolation. */
    gpgAgent?: boolean;
    /** Mount age-compatible agent sockets under Linux isolation. */
    ageAgent?: boolean;
}
/**
 * One configured layer of the pi-heimdall policy fragment — the
 * cross-harness config format, verbatim, no renamed aliases. Shared by the
 * deployment-wide config, `projects` entries, and the `sandbox` section of
 * the workspace `.dsh/heimdall.json` file (a multi-plugin file shared with
 * dsh-heimdall's `commandPolicies`). Lists append across layers; scalars
 * take the most specific layer that defines them; absent fields mean binary
 * defaults.
 */
export interface PolicyOptions {
    /** Filesystem rules in pi-heimdall shape. */
    filesystem?: HeimdallFilesystem;
    /** Parent-environment filter (mutable lists — layers append into them). */
    env?: {
        allow?: string[];
        deny?: string[];
    };
    /** `host` (default) or `none`; unknown values are the binary's contract. */
    network?: string;
    /** `default` or `none` (`--no-proc`); unknown values are the binary's contract. */
    proc?: string;
    /** Mount the SSH agent socket under Linux isolation. */
    sshAgent?: boolean;
    /** Mount GnuPG agent, keyboxd, and dirmngr sockets under Linux isolation. */
    gpgAgent?: boolean;
    /** Mount age-compatible agent sockets under Linux isolation. */
    ageAgent?: boolean;
}
/**
 * Map one confined call onto its heimdall-sandbox policy document.
 * @param argv - the exact caller argv (program plus arguments).
 * @param policy - the resolved per-call file-effect policy.
 * @param options - the merged policy fragment from all configured layers.
 * @returns the policy document to serialize for `exec --policy`.
 */
export declare function buildPolicyDocument(argv: readonly string[], policy: SandboxExecutionPolicy, options?: PolicyOptions): HeimdallPolicyDocument;
