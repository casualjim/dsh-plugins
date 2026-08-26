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
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import z from '@deepseek-ai/schemastery';
import { SandboxProvider } from '@deepseek-ai/dsh-sandbox';
import { buildPolicyDocument } from "./policy.js";
/** The stderr dialect a kernel denial produces under the platform's backend. */
const DENIAL_SIGNATURES = {
    darwin: ['operation not permitted'],
    linux: ['read-only file system', 'permission denied'],
};
/**
 * Runner-failure evidence: the command never ran. The binary's own
 * misconfiguration contract (exit 2) plus the underlying runner dialects
 * passing through unchanged.
 */
const RUNNER_FAILURE_RULES = [
    { allowedExitCodes: [2], fatalSignatures: ['invalid policy: ', 'missing command'] },
    { fatalSignatures: ['sandbox-exec: '] },
    { fatalSignatures: ['bwrap: '] },
];
function isUsableBinary(path) {
    if (!path)
        return false;
    try {
        return statSync(path).isFile();
    }
    catch {
        return false;
    }
}
/** Locate the heimdall-sandbox binary: config, then npm wrapper, then PATH. */
export function resolveBinaryPath(configured) {
    if (isUsableBinary(configured))
        return configured;
    try {
        const candidate = fileURLToPath(import.meta.resolve('@casualjim/heimdall-sandbox/bin/heimdall-sandbox.js'));
        if (isUsableBinary(candidate))
            return candidate;
    }
    catch {
        // wrapper package not installed with this deployment
    }
    for (const dir of (process.env.PATH ?? '').split(delimiter)) {
        if (!dir)
            continue;
        const found = join(dir, 'heimdall-sandbox');
        if (isUsableBinary(found))
            return found;
    }
    throw new Error('heimdall-sandbox binary not found: configure sandbox.binaryPath, install @casualjim/heimdall-sandbox, or put heimdall-sandbox on PATH');
}
export class HeimdallSandboxProvider extends SandboxProvider {
    // Inline schema call: the config catalog walks `static Config` statically.
    static Config = z.object({
        binaryPath: z.string(),
        extraWritableRoots: z.array(z.string()),
        deniedPaths: z.array(z.string()),
    });
    options;
    binaryPath;
    policyDirs = new Set();
    /** Test seam + explicit teardown, mirroring the local provider's internals idiom. */
    internals;
    constructor(ctx, config) {
        super(ctx);
        if (process.platform !== 'darwin' && process.platform !== 'linux') {
            throw new Error(`heimdall-sandbox provider supports darwin and linux, not ${process.platform}`);
        }
        this.binaryPath = resolveBinaryPath(config.binaryPath || undefined);
        this.options = {
            extraWritableRoots: config.extraWritableRoots,
            deniedPaths: config.deniedPaths,
        };
        const dispose = () => {
            for (const dir of this.policyDirs) {
                try {
                    rmSync(dir, { recursive: true, force: true });
                }
                catch {
                    // best-effort cleanup; OS temp sweeps cover residue
                }
            }
            this.policyDirs.clear();
        };
        this.internals = { dispose };
        // Policy temp files are reversible state: every directory created by
        // confine() is removed when the provider stops.
        ctx.effect(() => dispose);
    }
    confine(argv, policy) {
        const document = buildPolicyDocument(argv, policy, this.options);
        const dir = mkdtempSync(join(tmpdir(), 'dsh-heimdall-'));
        this.policyDirs.add(dir);
        const policyFile = join(dir, 'policy.json');
        writeFileSync(policyFile, `${JSON.stringify(document)}\n`);
        return {
            argv: [this.binaryPath, 'exec', '--policy', policyFile],
            enforcement: 'full',
            denialSignatures: DENIAL_SIGNATURES[process.platform] ?? [],
            runnerFailureRules: RUNNER_FAILURE_RULES,
        };
    }
    /** Probe the binary once so a broken install fails at composition time. */
    verify() {
        const probe = spawnSync(this.binaryPath, ['--version'], { timeout: 10_000 });
        if (probe.error !== undefined || probe.status !== 0) {
            throw new Error(`heimdall-sandbox binary at ${this.binaryPath} did not answer --version`);
        }
    }
}
export default HeimdallSandboxProvider;
