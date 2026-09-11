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

import type { RepoFacts, WorktreeChanges, WorktreeHead, WorktreeUpstream } from './contract.js'

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
	detached: boolean
	branchMismatch: boolean
	duplicateBranch: boolean
	head: WorktreeHead | null
	changes: WorktreeChanges
	upstream: WorktreeUpstream | null
	headSha: string | null
	headShortSha: string | null
	headSubject: string | null
}

function numberOrZero(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function stringOrNull(value: unknown): string | null {
	return typeof value === 'string' ? value : null
}

/** Schema-2 dirty flags; every field absent on schema 1 reads as clean. */
function normalizeChanges(worktree: Record<string, unknown>): WorktreeChanges {
	const raw = (worktree.changes ?? {}) as Record<string, unknown>
	return {
		staged: raw.staged === true,
		modified: raw.modified === true,
		untracked: raw.untracked === true,
		renamed: raw.renamed === true,
		deleted: raw.deleted === true,
		conflicted: raw.conflicted === true,
	}
}

/** Schema-2 upstream tracking facts; `null` when the item reports none. */
function normalizeUpstream(item: Record<string, unknown>): WorktreeUpstream | null {
	const raw = item.upstream
	if (typeof raw !== 'object' || raw === null) return null
	const record = raw as Record<string, unknown>
	return { remote: stringOrNull(record.remote), branch: stringOrNull(record.branch), ahead: numberOrZero(record.ahead), behind: numberOrZero(record.behind) }
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
	const sha = typeof head.sha === 'string' ? head.sha : null
	const shortSha = typeof head.short_sha === 'string' ? head.short_sha : null
	const subject = typeof head.subject === 'string' ? head.subject : null
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
	}
}

/** Read `wt list --format=json` once, returning repo facts and normalized entries. */
export async function listWorktreesFull(ctx: WtContext, bin: string, cwd: string, signal?: AbortSignal): Promise<{ repo: RepoFacts, entries: WtEntry[] }> {
	const outcome = await runWtOk(ctx, [bin, 'list', '--format=json'], cwd, signal)
	let parsed: unknown
	try {
		parsed = JSON.parse(outcome.stdout)
	} catch (error) {
		throw new WtError('WT_BAD_JSON', `\`wt list\` returned invalid JSON: ${(error as Error).message}`)
	}
	const record = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<string, unknown>
	const items = Array.isArray(parsed) ? parsed : Array.isArray(record.items) ? record.items : []
	const repoRaw = (record.repo ?? {}) as Record<string, unknown>
	const forgeRaw = (repoRaw.forge ?? {}) as Record<string, unknown>
	const repo: RepoFacts = {
		root: cwd,
		defaultBranch: typeof repoRaw.default_branch === 'string' ? repoRaw.default_branch : 'main',
		forge: typeof forgeRaw.url === 'string' ? forgeRaw.url : null,
	}
	return {
		repo,
		entries: items.map(item => normalizeEntry(item as Record<string, unknown>)).filter((entry): entry is WtEntry => entry !== null),
	}
}

/** List worktrees of the repository containing `cwd` via `wt list --format=json`. */
export async function listWorktrees(ctx: WtContext, bin: string, cwd: string, signal?: AbortSignal): Promise<WtEntry[]> {
	return (await listWorktreesFull(ctx, bin, cwd, signal)).entries
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
