/**
 * Wire vocabulary shared by the host service, the Typert remote, and the browser
 * panel. This module imports nothing: it is the one place both planes agree on.
 */

/** Working-tree state flags reported by `wt list --format=json` (schema 2). */
export interface WorktreeChanges {
	readonly staged: boolean
	readonly modified: boolean
	readonly untracked: boolean
	readonly renamed: boolean
	readonly deleted: boolean
	readonly conflicted: boolean
}

/** HEAD facts for one worktree. */
export interface WorktreeHead {
	readonly sha: string
	readonly shortSha: string
	readonly subject: string
	readonly committedAt: string | null
}

/** Upstream tracking facts; `null` when the branch has no upstream. */
export interface WorktreeUpstream {
	readonly remote: string | null
	readonly branch: string | null
	readonly ahead: number
	readonly behind: number
}

/** Host-owned session membership: identity plus the cwd that proves the grouping. */
export interface WorktreeSessionRef {
	readonly id: string
	readonly cwd: string
}

/** One worktree, as the panel renders it. */
export interface WorktreeRow {
	readonly path: string
	readonly branch: string
	readonly isMain: boolean
	readonly isCurrent: boolean
	readonly detached: boolean
	readonly branchMismatch: boolean
	readonly duplicateBranch: boolean
	readonly head: WorktreeHead | null
	readonly changes: WorktreeChanges
	readonly upstream: WorktreeUpstream | null
	readonly sessions: readonly WorktreeSessionRef[]
	/** True when the path is already registered as a DSH workspace. */
	readonly registered: boolean
}

/** One configured hook, as `wt hook show --format=json` reports it. */
export interface HookSpec {
	readonly name: string
	readonly type: string
	readonly template: string
	readonly source: 'project' | 'user'
	readonly needsApproval: boolean
}

/** Repository facts the panel header shows. */
export interface RepoFacts {
	readonly root: string
	readonly defaultBranch: string
	readonly forge: string | null
}

/** One complete panel read. */
export interface PanelSnapshot {
	readonly repo: RepoFacts
	readonly items: readonly WorktreeRow[]
	readonly hooks: readonly HookSpec[]
}

/** Outcome of a full-access request for one session. */
export type WorktreePermissionStatus =
	| 'applied'
	| 'already-full-access'
	| 'user-restricted'
	| 'unavailable'

/** Every stable failure the browser may branch on. */
export type WorktreeErrorCode =
	| 'WT_NOT_INSTALLED'
	| 'NOT_A_REPO'
	| 'NO_INITIAL_COMMIT'
	| 'NO_LOCAL_BRANCH'
	| 'WT_FAILED'
	| 'WT_BAD_JSON'
	| 'WT_BUSY'
	| 'SESSION_WORKTREE'
	| 'PRESET_UNAVAILABLE'
	| 'PERMISSION_UNVERIFIED'
	| 'HOOK_FAILED'
	| 'NOT_FOUND'

export const WORKTREE_ERROR_CODES: readonly WorktreeErrorCode[] = [
	'WT_NOT_INSTALLED',
	'NOT_A_REPO',
	'NO_INITIAL_COMMIT',
	'NO_LOCAL_BRANCH',
	'WT_FAILED',
	'WT_BAD_JSON',
	'WT_BUSY',
	'SESSION_WORKTREE',
	'PRESET_UNAVAILABLE',
	'PERMISSION_UNVERIFIED',
	'HOOK_FAILED',
	'NOT_FOUND',
] as const

/** JSON-safe failure value. */
export interface WorktrunkFailure {
	readonly code: WorktreeErrorCode
	readonly message: string
	readonly details: Readonly<Record<string, unknown>>
}

/** Every remote method resolves to this envelope. */
export type WorktrunkRemoteResult<Value> =
	| { readonly ok: true, readonly value: Value }
	| { readonly ok: false, readonly error: WorktrunkFailure }

/** Build a failure value. */
export function createWorktrunkFailure(
	code: WorktreeErrorCode,
	message: string,
	details: Readonly<Record<string, unknown>> = {},
): WorktrunkFailure {
	return { code, message, details }
}
