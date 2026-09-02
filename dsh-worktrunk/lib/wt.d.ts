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
/** A stable, machine-readable failure; message is user-facing verbatim. */
export declare class WtError extends Error {
    readonly code: string;
    constructor(code: string, message: string, options?: ErrorOptions);
}
/** Minimal structural type of the harness subprocess service this module relies on. */
export interface WtSubprocess {
    spawn(options: {
        argv: string[];
        cwd: string;
        stdio: {
            stdin: 'ignore';
            stdout: {
                maxBytes: number;
            };
            stderr: {
                maxBytes: number;
            };
        };
        graceMs: number;
        signal?: AbortSignal;
    }): {
        done: Promise<{
            exitCode: number | null;
            signal: string | null;
        }>;
        collected: {
            stdout: {
                readFrom(position: number): {
                    text: string;
                };
            } | undefined;
            stderr: {
                readFrom(position: number): {
                    text: string;
                };
            } | undefined;
        };
    };
}
/** Runner context: only the subprocess service is required. */
export interface WtContext {
    subprocess: WtSubprocess;
}
/** One `wt` invocation outcome. */
export interface WtOutcome {
    exitCode: number | null;
    stdout: string;
    stderr: string;
}
/** Run one `wt` command through the subprocess service. Never shell-interpreted. */
export declare function runWt(ctx: WtContext, argv: string[], cwd: string, signal?: AbortSignal): Promise<WtOutcome>;
/** Require exit 0, mapping failures to a user-facing WtError. */
export declare function runWtOk(ctx: WtContext, argv: string[], cwd: string, signal?: AbortSignal): Promise<WtOutcome>;
/** Live facts for one worktree, normalized across `wt list` JSON schemas. */
export interface WtEntry {
    branch: string;
    path: string;
    isMain: boolean;
    isCurrent: boolean;
    headSha: string | null;
    headShortSha: string | null;
    headSubject: string | null;
}
/**
 * Normalize one `wt list --format=json` item. Schema 2 nests facts under
 * `worktree`/`head`; schema 1 keeps them top-level (`path`, `commit`).
 */
export declare function normalizeEntry(item: Record<string, unknown>): WtEntry | null;
/** List worktrees of the repository containing `cwd` via `wt list --format=json`. */
export declare function listWorktrees(ctx: WtContext, bin: string, cwd: string, signal?: AbortSignal): Promise<WtEntry[]>;
/** Whether `candidate` is `base` itself or a descendant of `base`. */
export declare function isWithin(base: string, candidate: string): boolean;
/** argv for creating a branch + worktree (hooks run unless `hooks: false`). */
export declare function createArgs(bin: string, options: {
    branch: string;
    base?: string;
    hooks?: boolean;
}): string[];
/**
 * argv for removing a worktree. Branch deletion of an UNMERGED branch needs
 * the explicit `forceDeleteBranch` (`-D`); `force` alone only overrides the
 * dirty-worktree refusal — both gates stay delegated to `wt`.
 */
export declare function removeArgs(bin: string, options: {
    branch: string;
    force?: boolean;
    forceDeleteBranch?: boolean;
    keepBranch?: boolean;
}): string[];
/**
 * argv for `wt merge`: squashes & rebases the current branch into `target`
 * (default branch when omitted), fast-forwards the target, removes the
 * worktree afterwards. Must run with cwd set to the branch's worktree path.
 */
export declare function mergeArgs(bin: string, options?: {
    target?: string;
    keepCommit?: boolean;
    keepWorktree?: boolean;
}): string[];
/** argv for copying gitignored files between the main worktree and here. */
export declare function copyIgnoredArgs(bin: string, options?: {
    force?: boolean;
    requireInclude?: boolean;
}): string[];
