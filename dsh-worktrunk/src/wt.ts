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
	readonly code: string

	constructor(code: string, message: string, options?: ErrorOptions) {
		super(message, options)
		this.name = 'WtError'
		this.code = code
	}
}

/** Minimal structural type of the harness subprocess service this module relies on. */
export interface WtSubprocess {
	spawn(options: {
		argv: string[]
		cwd: string
		stdio: {
			stdin: 'ignore'
			stdout: { maxBytes: number }
			stderr: { maxBytes: number }
		}
		graceMs: number
		signal?: AbortSignal
	}): { done: Promise<{ exitCode: number | null, signal: string | null }>, collected: {
		stdout: { readFrom(position: number): { text: string } } | undefined
		stderr: { readFrom(position: number): { text: string } } | undefined
	} }
}

/** Runner context: only the subprocess service is required. */
export interface WtContext {
	subprocess: WtSubprocess
}

/** One `wt` invocation outcome. */
export interface WtOutcome {
	exitCode: number | null
	stdout: string
	stderr: string
}

/** Run one `wt` command through the subprocess service. Never shell-interpreted. */
export async function runWt(ctx: WtContext, argv: string[], cwd: string, signal?: AbortSignal): Promise<WtOutcome> {
	let handle
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
		})
	} catch (error) {
		const bin = argv[0] ?? 'wt'
		throw new WtError('SPAWN_FAILED', `\`${bin}\` could not be started: ${(error as Error).message}. Is worktrunk installed (\`brew install worktrunk\`)?`, { cause: error })
	}
	const outcome = await handle.done
	const stdout = handle.collected.stdout?.readFrom(0).text ?? ''
	const stderr = handle.collected.stderr?.readFrom(0).text ?? ''
	return { exitCode: outcome.exitCode, stdout: stdout.trim(), stderr: stderr.trim() }
}

/** Require exit 0, mapping failures to a user-facing WtError. */
export async function runWtOk(ctx: WtContext, argv: string[], cwd: string, signal?: AbortSignal): Promise<WtOutcome> {
	const outcome = await runWt(ctx, argv, cwd, signal)
	if (outcome.exitCode !== 0) {
		const detail = outcome.stderr || outcome.stdout || `exit code ${outcome.exitCode}`
		throw new WtError('WT_FAILED', `\`${argv.join(' ')}\` failed: ${detail}`)
	}
	return outcome
}

/** Live facts for one worktree, normalized across `wt list` JSON schemas. */
export interface WtEntry {
	branch: string
	path: string
	isMain: boolean
	isCurrent: boolean
	headSha: string | null
	headShortSha: string | null
	headSubject: string | null
}

/**
 * Normalize one `wt list --format=json` item. Schema 2 nests facts under
 * `worktree`/`head`; schema 1 keeps them top-level (`path`, `commit`).
 */
export function normalizeEntry(item: Record<string, unknown>): WtEntry | null {
	const branch = typeof item.branch === 'string' ? item.branch : null
	if (branch === null) return null
	const worktree = (item.worktree ?? {}) as Record<string, unknown>
	const head = (item.head ?? item.commit ?? {}) as Record<string, unknown>
	const path = typeof worktree.path === 'string' ? worktree.path : typeof item.path === 'string' ? item.path : null
	if (path === null) return null
	return {
		branch,
		path,
		isMain: worktree.main === true || item.main === true,
		isCurrent: worktree.current === true || item.current === true,
		headSha: typeof head.sha === 'string' ? head.sha : null,
		headShortSha: typeof head.short_sha === 'string' ? head.short_sha : null,
		headSubject: typeof head.subject === 'string' ? head.subject : null,
	}
}

/** List worktrees of the repository containing `cwd` via `wt list --format=json`. */
export async function listWorktrees(ctx: WtContext, bin: string, cwd: string, signal?: AbortSignal): Promise<WtEntry[]> {
	const outcome = await runWtOk(ctx, [bin, 'list', '--format=json'], cwd, signal)
	let parsed: unknown
	try {
		parsed = JSON.parse(outcome.stdout)
	} catch (error) {
		throw new WtError('BAD_JSON', `\`wt list\` returned invalid JSON: ${(error as Error).message}`)
	}
	const items = Array.isArray(parsed)
		? parsed
		: Array.isArray((parsed as Record<string, unknown>)?.items)
			? (parsed as { items: unknown[] }).items
			: []
	return items.map(item => normalizeEntry(item as Record<string, unknown>)).filter((entry): entry is WtEntry => entry !== null)
}

/** Whether `candidate` is `base` itself or a descendant of `base`. */
export function isWithin(base: string, candidate: string): boolean {
	return candidate === base || candidate.startsWith(base.endsWith('/') ? base : `${base}/`)
}

/** argv for creating a branch + worktree (hooks run unless `hooks: false`). */
export function createArgs(bin: string, options: { branch: string, base?: string, hooks?: boolean }): string[] {
	return [
		bin,
		'switch',
		'--create',
		options.branch,
		...(options.base === undefined ? [] : ['--base', options.base]),
		...(options.hooks === false ? ['--no-hooks'] : []),
		'--yes',
	]
}

/**
 * argv for removing a worktree. Branch deletion of an UNMERGED branch needs
 * the explicit `forceDeleteBranch` (`-D`); `force` alone only overrides the
 * dirty-worktree refusal — both gates stay delegated to `wt`.
 */
export function removeArgs(bin: string, options: { branch: string, force?: boolean, forceDeleteBranch?: boolean, keepBranch?: boolean }): string[] {
	return [
		bin,
		'remove',
		...(options.force === true ? ['--force'] : []),
		...(options.forceDeleteBranch === true ? ['--force-delete'] : []),
		...(options.keepBranch === true ? ['--no-delete-branch'] : []),
		'--foreground',
		'--yes',
		options.branch,
	]
}

/**
 * argv for `wt merge`: squashes & rebases the current branch into `target`
 * (default branch when omitted), fast-forwards the target, removes the
 * worktree afterwards. Must run with cwd set to the branch's worktree path.
 */
export function mergeArgs(bin: string, options: { target?: string, keepCommit?: boolean, keepWorktree?: boolean } = {}): string[] {
	return [
		bin,
		'merge',
		...(options.target === undefined ? [] : [options.target]),
		...(options.keepCommit === true ? ['--no-squash'] : []),
		...(options.keepWorktree === true ? ['--no-remove'] : []),
		'--yes',
	]
}

/** argv for copying gitignored files between the main worktree and here. */
export function copyIgnoredArgs(bin: string, options: { force?: boolean, requireInclude?: boolean } = {}): string[] {
	return [
		bin,
		'step',
		'copy-ignored',
		...(options.force === true ? ['--force'] : []),
		...(options.requireInclude === true ? ['--require-include'] : []),
	]
}
