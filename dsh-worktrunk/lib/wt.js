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
    return {
        branch,
        path,
        isMain: worktree.main === true || item.main === true,
        isCurrent: worktree.current === true || item.current === true,
        headSha: typeof head.sha === 'string' ? head.sha : null,
        headShortSha: typeof head.short_sha === 'string' ? head.short_sha : null,
        headSubject: typeof head.subject === 'string' ? head.subject : null,
    };
}
/** List worktrees of the repository containing `cwd` via `wt list --format=json`. */
export async function listWorktrees(ctx, bin, cwd, signal) {
    const outcome = await runWtOk(ctx, [bin, 'list', '--format=json'], cwd, signal);
    let parsed;
    try {
        parsed = JSON.parse(outcome.stdout);
    }
    catch (error) {
        throw new WtError('BAD_JSON', `\`wt list\` returned invalid JSON: ${error.message}`);
    }
    const items = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.items)
            ? parsed.items
            : [];
    return items.map(item => normalizeEntry(item)).filter((entry) => entry !== null);
}
/** Whether `candidate` is `base` itself or a descendant of `base`. */
export function isWithin(base, candidate) {
    return candidate === base || candidate.startsWith(base.endsWith('/') ? base : `${base}/`);
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
