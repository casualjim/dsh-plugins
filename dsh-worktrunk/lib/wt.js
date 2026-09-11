/**
 * dsh-worktrunk core: worktrunk (`wt`) invocation + output normalization.
 *
 * Everything here goes through the harness subprocess service (`ctx.subprocess`),
 * never the agent bash tool, so worktree lifecycle commands run harness-side
 * regardless of the session's sandbox mode. The worktrees themselves live
 * outside the repository (worktrunk default: siblings of the repo); sessions
 * work inside one by opening it as their workspace, which puts it inside that
 * session's workspace-write boundary.
 *
 * Kept framework-light on purpose: only needs a `ctx` carrying
 * `ctx.subprocess` (see `WtRunner`), so the logic is testable without booting
 * a DSH profile.
 */
/** Collect caps for `wt` stdout/stderr (list JSON can be a few hundred KB). */
const WT_COLLECT_BYTES = 8 << 20;
/** Grace for the SIGTERM → SIGKILL escalation when a `wt` child is aborted. */
const WT_GRACE_MS = 60_000;
/** A stable, machine-readable failure; message is user-facing verbatim. */
export class WtError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.name = 'WtError';
        this.code = code;
    }
}
/** Run one `wt` command through the subprocess service. Never shell-interpreted. */
export async function runWt(ctx, argv, cwd, signal) {
    let handle;
    try {
        handle = ctx.subprocess.spawn({
            argv,
            cwd,
            stdio: {
                stdin: 'ignore',
                stdout: { maxBytes: WT_COLLECT_BYTES },
                stderr: { maxBytes: WT_COLLECT_BYTES },
            },
            graceMs: WT_GRACE_MS,
            signal,
        });
    }
    catch (error) {
        const bin = argv[0] ?? 'wt';
        throw new WtError('SPAWN_FAILED', `\`${bin}\` could not be started: ${error.message}. Is worktrunk installed (\`brew install worktrunk\`)?`, { cause: error });
    }
    const outcome = await handle.done;
    const stdout = handle.collected.stdout?.readFrom(0).text ?? '';
    const stderr = handle.collected.stderr?.readFrom(0).text ?? '';
    return { exitCode: outcome.exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
}
/** Require exit 0, mapping failures to a user-facing WtError. */
export async function runWtOk(ctx, argv, cwd, signal) {
    const outcome = await runWt(ctx, argv, cwd, signal);
    if (outcome.exitCode !== 0) {
        const detail = outcome.stderr || outcome.stdout || `exit code ${outcome.exitCode}`;
        throw new WtError('WT_FAILED', `\`${argv.join(' ')}\` failed: ${detail}`);
    }
    return outcome;
}
function numberOrZero(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
function stringOrNull(value) {
    return typeof value === 'string' ? value : null;
}
/** Schema-2 dirty flags; every field absent on schema 1 reads as clean. */
function normalizeChanges(worktree) {
    const raw = (worktree.changes ?? {});
    return {
        staged: raw.staged === true,
        modified: raw.modified === true,
        untracked: raw.untracked === true,
        renamed: raw.renamed === true,
        deleted: raw.deleted === true,
        conflicted: raw.conflicted === true,
    };
}
/** Schema-2 upstream tracking facts; `null` when the item reports none. */
function normalizeUpstream(item) {
    const raw = item.upstream;
    if (typeof raw !== 'object' || raw === null)
        return null;
    const record = raw;
    return { remote: stringOrNull(record.remote), branch: stringOrNull(record.branch), ahead: numberOrZero(record.ahead), behind: numberOrZero(record.behind) };
}
/**
 * Normalize one `wt list --format=json` item. Schema 2 nests facts under
 * `worktree`/`head`; schema 1 keeps them top-level (`path`, `commit`).
 */
export function normalizeEntry(item) {
    const branch = typeof item.branch === 'string' ? item.branch : null;
    if (branch === null)
        return null;
    const worktree = (item.worktree ?? {});
    const head = (item.head ?? item.commit ?? {});
    const path = typeof worktree.path === 'string' ? worktree.path : typeof item.path === 'string' ? item.path : null;
    if (path === null)
        return null;
    const sha = typeof head.sha === 'string' ? head.sha : null;
    const shortSha = typeof head.short_sha === 'string' ? head.short_sha : null;
    const subject = typeof head.subject === 'string' ? head.subject : null;
    return {
        branch,
        path,
        isMain: worktree.main === true || item.main === true,
        isCurrent: worktree.current === true || item.current === true,
        detached: worktree.detached === true,
        branchMismatch: worktree.branch_mismatch === true,
        duplicateBranch: worktree.duplicate_branch === true,
        head: sha === null ? null : { sha, shortSha: shortSha ?? sha.slice(0, 7), subject: subject ?? '', committedAt: stringOrNull(head.committed_at) },
        changes: normalizeChanges(worktree),
        upstream: normalizeUpstream(item),
        headSha: sha,
        headShortSha: shortSha,
        headSubject: subject,
    };
}
/** Read `wt list --format=json` once, returning repo facts and normalized entries. */
export async function listWorktreesFull(ctx, bin, cwd, signal) {
    const outcome = await runWtOk(ctx, [bin, 'list', '--format=json'], cwd, signal);
    let parsed;
    try {
        parsed = JSON.parse(outcome.stdout);
    }
    catch (error) {
        throw new WtError('WT_BAD_JSON', `\`wt list\` returned invalid JSON: ${error.message}`);
    }
    const record = (typeof parsed === 'object' && parsed !== null ? parsed : {});
    const items = Array.isArray(parsed) ? parsed : Array.isArray(record.items) ? record.items : [];
    const repoRaw = (record.repo ?? {});
    const forgeRaw = (repoRaw.forge ?? {});
    const repo = {
        root: cwd,
        defaultBranch: typeof repoRaw.default_branch === 'string' ? repoRaw.default_branch : 'main',
        forge: typeof forgeRaw.url === 'string' ? forgeRaw.url : null,
    };
    return {
        repo,
        entries: items.map(item => normalizeEntry(item)).filter((entry) => entry !== null),
    };
}
/** List worktrees of the repository containing `cwd` via `wt list --format=json`. */
export async function listWorktrees(ctx, bin, cwd, signal) {
    return (await listWorktreesFull(ctx, bin, cwd, signal)).entries;
}
/** Whether `candidate` is `base` itself or a descendant of `base`. */
export function isWithin(base, candidate) {
    return candidate === base || candidate.startsWith(base.endsWith('/') ? base : `${base}/`);
}
/** Refuse an operation that would delete the worktree this session runs inside. */
export function assertNotSessionWorktree(entry, cwd, action) {
    if (entry !== undefined && isWithin(entry.path, cwd)) {
        throw new WtError('SESSION_WORKTREE', `Refusing to ${action} the worktree at ${entry.path}: this session is running inside it. Start a session elsewhere first.`);
    }
}
/** argv for creating a branch + worktree (hooks run unless `hooks: false`). */
export function createArgs(bin, options) {
    return [
        bin,
        'switch',
        '--create',
        options.branch,
        ...(options.base === undefined ? [] : ['--base', options.base]),
        ...(options.hooks === false ? ['--no-hooks'] : []),
        '--yes',
    ];
}
/**
 * argv for removing a worktree. Branch deletion of an UNMERGED branch needs
 * the explicit `forceDeleteBranch` (`-D`); `force` alone only overrides the
 * dirty-worktree refusal — both gates stay delegated to `wt`.
 */
export function removeArgs(bin, options) {
    return [
        bin,
        'remove',
        ...(options.force === true ? ['--force'] : []),
        ...(options.forceDeleteBranch === true ? ['--force-delete'] : []),
        ...(options.keepBranch === true ? ['--no-delete-branch'] : []),
        '--foreground',
        '--yes',
        options.branch,
    ];
}
/**
 * argv for `wt merge`: squashes & rebases the current branch into `target`
 * (default branch when omitted), fast-forwards the target, removes the
 * worktree afterwards. Must run with cwd set to the branch's worktree path.
 */
export function mergeArgs(bin, options = {}) {
    return [
        bin,
        'merge',
        ...(options.target === undefined ? [] : [options.target]),
        ...(options.keepCommit === true ? ['--no-squash'] : []),
        ...(options.keepWorktree === true ? ['--no-remove'] : []),
        '--yes',
    ];
}
/** argv for copying gitignored files between the main worktree and here. */
export function copyIgnoredArgs(bin, options = {}) {
    return [
        bin,
        'step',
        'copy-ignored',
        ...(options.force === true ? ['--force'] : []),
        ...(options.requireInclude === true ? ['--require-include'] : []),
    ];
}
/** Shown when the `wt` binary cannot be started. */
export const WORKTRUNK_INSTALL_HINT = 'worktrunk is not installed or not on PATH. Install it with `brew install worktrunk` or `cargo install worktrunk`, then restart DSH.';
/** Normalize one `wt hook show --format=json` row. */
export function normalizeHookSpec(item) {
    const name = typeof item.name === 'string' ? item.name : null;
    const type = typeof item.type === 'string' ? item.type : null;
    const template = typeof item.template === 'string' ? item.template : null;
    if (name === null || type === null || template === null)
        return null;
    return {
        name,
        type,
        template,
        source: item.source === 'user' ? 'user' : 'project',
        needsApproval: item.needs_approval === true,
    };
}
/**
 * Read the hooks `wt` would run for this repository. `wt` owns hook discovery, so
 * this is one native call rather than a TOML parse; a missing project config is `[]`.
 */
export async function hookSpecs(ctx, bin, cwd, signal) {
    const outcome = await runWtOk(ctx, [bin, 'hook', 'show', '--format=json'], cwd, signal);
    let parsed;
    try {
        parsed = JSON.parse(outcome.stdout);
    }
    catch (error) {
        throw new WtError('WT_BAD_JSON', `\`wt hook show\` returned invalid JSON: ${error.message}`);
    }
    if (!Array.isArray(parsed))
        return [];
    return parsed
        .map(item => normalizeHookSpec(item))
        .filter((spec) => spec !== null);
}
