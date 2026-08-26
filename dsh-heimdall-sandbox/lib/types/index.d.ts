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
import { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { ConfinedArgv, SandboxPolicy } from '@deepseek-ai/dsh-sandbox';
import { SandboxProvider } from '@deepseek-ai/dsh-sandbox';
/** Plugin config. All optional — `static Config` supplies the defaults. */
export interface Config {
    /**
     * Path to the heimdall-sandbox binary. Empty resolves the npm wrapper
     * (`@casualjim/heimdall-sandbox`), then `heimdall-sandbox` on PATH.
     */
    binaryPath?: string;
    /** Additional writable roots granted under `workspace-write`, beyond the session workspace. */
    extraWritableRoots?: string[];
    /**
     * Deny entries passed to heimdall verbatim: `~/secrets`, absolute paths,
     * ordered `!negations`. Denied beats writable.
     */
    deniedPaths?: string[];
}
/** Locate the heimdall-sandbox binary: config, then npm wrapper, then PATH. */
export declare function resolveBinaryPath(configured: string | undefined): string;
export declare class HeimdallSandboxProvider extends SandboxProvider {
    static Config: z<Config>;
    private readonly options;
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
