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
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
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
/**
 * The override entry whose key is the workspace root itself or a directory
 * prefix of it; the longest matching key wins.
 */
function matchProject(projects, root) {
    if (!projects)
        return undefined;
    let best;
    let bestLength = -1;
    for (const [key, overrides] of Object.entries(projects)) {
        const prefix = key.endsWith('/') ? key : `${key}/`;
        if ((root === key || root.startsWith(prefix)) && key.length > bestLength) {
            best = overrides;
            bestLength = key.length;
        }
    }
    return best;
}
/**
 * The `sandbox` section of the multi-plugin `<workspaceRoot>/.dsh/heimdall.json`
 * (pi-heimdall {@link PolicyOptions} fragment, plain JSON); `undefined` when
 * the file or the section is absent. The file IS the opt-in: committing it to
 * a repo lets that repo widen its own writables to any path not covered by
 * the global deny corpus (global deny still beats every writable). Malformed
 * content fails loudly — a silently ignored sandbox grant is a
 * misconfiguration, not a fallback.
 */
function readWorkspacePolicy(root) {
    const path = join(root, '.dsh', 'heimdall.json');
    let raw;
    try {
        raw = readFileSync(path, 'utf-8');
    }
    catch (err) {
        if (err.code === 'ENOENT')
            return undefined;
        throw new Error(`heimdall-sandbox: cannot read ${path}: ${err.message}`);
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new Error(`heimdall-sandbox: invalid JSON in ${path}`);
    }
    if (parsed.sandbox === undefined)
        return undefined;
    if (typeof parsed.sandbox !== 'object' || parsed.sandbox === null || Array.isArray(parsed.sandbox)) {
        throw new Error(`heimdall-sandbox: ${path}: "sandbox" section must be a policy fragment object`);
    }
    return parsed.sandbox;
}
/**
 * Fold policy layers most-general first: lists concatenate, virtual mounts
 * merge by key, scalars (`network`, `proc`, agent flags, env lists) take
 * the most specific layer that defines them. Absent fields stay absent —
 * the binary decides their defaults.
 */
export function mergeOptions(...layers) {
    const merged = {};
    for (const layer of layers) {
        if (!layer)
            continue;
        if (layer.filesystem?.deny?.length) {
            merged.filesystem = {
                ...merged.filesystem,
                deny: [...(merged.filesystem?.deny ?? []), ...layer.filesystem.deny],
            };
        }
        if (layer.filesystem?.writable?.length) {
            merged.filesystem = {
                ...merged.filesystem,
                writable: [...(merged.filesystem?.writable ?? []), ...layer.filesystem.writable],
            };
        }
        if (layer.filesystem?.virtual && Object.keys(layer.filesystem.virtual).length) {
            merged.filesystem = {
                ...merged.filesystem,
                virtual: { ...merged.filesystem?.virtual, ...layer.filesystem.virtual },
            };
        }
        const allow = [...(merged.env?.allow ?? []), ...(layer.env?.allow ?? [])];
        const deny = [...(merged.env?.deny ?? []), ...(layer.env?.deny ?? [])];
        if (allow.length || deny.length) {
            merged.env = { ...(allow.length && { allow }), ...(deny.length && { deny }) };
        }
        if (layer.network !== undefined)
            merged.network = layer.network;
        if (layer.proc !== undefined)
            merged.proc = layer.proc;
        if (layer.sshAgent !== undefined)
            merged.sshAgent = layer.sshAgent;
        if (layer.gpgAgent !== undefined)
            merged.gpgAgent = layer.gpgAgent;
        if (layer.ageAgent !== undefined)
            merged.ageAgent = layer.ageAgent;
    }
    return merged;
}
export class HeimdallSandboxProvider extends SandboxProvider {
    // Inline schema call: the config catalog walks `static Config` statically.
    static Config = z.object({
        binaryPath: z.string(),
        filesystem: z.object({
            deny: z.array(z.string()),
            writable: z.array(z.string()),
            virtual: z.dict(z.string()),
        }),
        network: z.string(),
        proc: z.string(),
        env: z.object({
            allow: z.array(z.string()),
            deny: z.array(z.string()),
        }),
        sshAgent: z.boolean(),
        gpgAgent: z.boolean(),
        ageAgent: z.boolean(),
        projects: z.dict(z.object({
            filesystem: z.object({
                deny: z.array(z.string()),
                writable: z.array(z.string()),
                virtual: z.dict(z.string()),
            }),
            network: z.string(),
            proc: z.string(),
            env: z.object({
                allow: z.array(z.string()),
                deny: z.array(z.string()),
            }),
            sshAgent: z.boolean(),
            gpgAgent: z.boolean(),
            ageAgent: z.boolean(),
        })),
    });
    options;
    projects;
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
        const { binaryPath: _b, projects: _p, ...fragment } = config;
        this.options = fragment;
        this.projects = config.projects;
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
        const override = matchProject(this.projects, policy.workspaceRoot);
        const workspace = readWorkspacePolicy(policy.workspaceRoot);
        const options = mergeOptions(this.options, override, workspace);
        const document = buildPolicyDocument(argv, policy, options);
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
