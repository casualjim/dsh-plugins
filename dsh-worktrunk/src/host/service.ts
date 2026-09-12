/**
 * The only place the plugin executes `wt` on behalf of the browser panel. Reads
 * reuse the same runner and normalization the agent tools use; nothing here
 * writes plugin state, and nothing here calls git.
 */
import type { Context } from '@deepseek-ai/cordis'
import {
	assertNotSessionWorktree,
	copyIgnoredArgs,
	createArgs,
	hookSpecs,
	listWorktreesFull,
	mergeArgs,
	removeArgs,
	runWtOk,
	WORKTRUNK_INSTALL_HINT,
	WtError,
	type WtContext,
	type WtEntry,
} from '../wt.js'
import type { HookSpec, PanelSnapshot, RepoFacts, WorktreeRow, WorktreeSessionRef } from '../contract.js'
import { ensureWorktreeFullAccess, type PermissionPresetService } from './permission.js'
import { readSessionHeaders, sessionsForWorktree, type SessionSources } from './sessions.js'
import { registerWorkspace, registryOf, resolveWorkspacePath, unregisterWorkspace, type WorkspaceRegistry } from './workspace.js'

/** Cordis context plus the subprocess service `wt` runs through. */
export interface WorktrunkServiceContext extends WtContext {
	get(service: string): unknown
}

/** Row config for the `dsh-worktrunk` patch entry. */
export interface WorktrunkServiceConfig {
	readonly bin: string
	readonly labelPrefix: string
}

/** Panel-facing service surface. */
export interface WorktrunkService {
	readPanel(input: { workspaceId: string }, signal?: AbortSignal): Promise<PanelSnapshot>
	previewHooks(input: { workspaceId: string }, signal?: AbortSignal): Promise<readonly HookSpec[]>
	createWorktree(input: { workspaceId: string, branch: string, base?: string, skipHooks?: boolean }, signal?: AbortSignal): Promise<{ path: string, branch: string, hooksRan: boolean, registrationWarning?: string }>
	removeWorktree(input: { workspaceId: string, branch: string, force?: boolean, forceDeleteBranch?: boolean, keepBranch?: boolean, currentCwd?: string }, signal?: AbortSignal): Promise<{ removed: true }>
	mergeWorktree(input: { workspaceId: string, branch: string, target?: string, keepCommit?: boolean, keepWorktree?: boolean, currentCwd?: string }, signal?: AbortSignal): Promise<{ merged: true }>
	copyIgnored(input: { workspaceId: string, path?: string, force?: boolean, requireInclude?: boolean }, signal?: AbortSignal): Promise<{ ok: true }>
	openWorktree(input: { workspaceId: string, path: string, branch: string }): Promise<{ workspaceId?: string }>
	ensureWorktreePermission(input: { sessionId: string }): Promise<{ status: string, preset?: string }>
}

async function workspacePath(ctx: WorktrunkServiceContext, workspaceId: string): Promise<string> {
	const path = await resolveWorkspacePath(ctx as unknown as Context, workspaceId)
	if (path === undefined) throw new WtError('NOT_FOUND', `workspace ${JSON.stringify(workspaceId)} is not registered`)
	return path
}

/** Whether the registry already knows this path; either registry face counts. */
async function isRegistered(ctx: WorktrunkServiceContext, path: string): Promise<boolean> {
	// Resolved per call, like the rest of `workspace.ts`: the registry service may
	// appear on the context after this service is constructed.
	const registry = registryOf(ctx as unknown as Context) as WorkspaceRegistry | undefined
	if (registry === undefined) return false
	if (registry.resolveByPath !== undefined && (await registry.resolveByPath(path)) !== undefined) return true
	return (registry.list?.() ?? []).some(workspace => workspace.path === path)
}

function rowOf(entry: WtEntry, sessions: readonly WorktreeSessionRef[], registered: boolean): WorktreeRow {
	return {
		path: entry.path,
		branch: entry.branch,
		isMain: entry.isMain,
		isCurrent: entry.isCurrent,
		detached: entry.detached,
		branchMismatch: entry.branchMismatch,
		duplicateBranch: entry.duplicateBranch,
		head: entry.head,
		changes: entry.changes,
		upstream: entry.upstream,
		sessions,
		registered,
	}
}

function sessionSources(ctx: WorktrunkServiceContext): SessionSources {
	return {
		sessions: ctx.get('sessions') as SessionSources['sessions'],
		sessionPersistence: ctx.get('sessionPersistence') as SessionSources['sessionPersistence'],
	}
}

/**
 * A missing `wt` binary is a workspace-scoped setup state, not an infrastructure
 * fault: reclassify the runner's `SPAWN_FAILED` here, on the service path only.
 * The agent tools keep that code and message untouched, and every other throw
 * (any other `WtError` code, or a non-`WtError`) passes through as-is.
 */
async function wtInstalled<Value>(operation: () => Promise<Value>): Promise<Value> {
	try {
		return await operation()
	} catch (error) {
		if (error instanceof WtError && error.code === 'SPAWN_FAILED') throw new WtError('WT_NOT_INSTALLED', WORKTRUNK_INSTALL_HINT, { cause: error })
		throw error
	}
}

/** Build the panel-facing service over one Cordis context. */
export function createWorktrunkService(ctx: WorktrunkServiceContext, config: WorktrunkServiceConfig): WorktrunkService {
	// Every service shell-out goes through these three, so a missing binary is
	// classified wherever `wt` is first needed — the first panel load included.
	const wtOk = (argv: string[], cwd: string, signal?: AbortSignal) => wtInstalled(() => runWtOk(ctx, argv, cwd, signal))
	const readFull = (root: string, signal?: AbortSignal) => wtInstalled(() => listWorktreesFull(ctx, config.bin, root, signal))
	const readHooks = (root: string, signal?: AbortSignal) => wtInstalled(() => hookSpecs(ctx, config.bin, root, signal))

	async function readRows(root: string, signal?: AbortSignal): Promise<{ repo: RepoFacts, items: WorktreeRow[] }> {
		const [full, refs] = await Promise.all([
			readFull(root, signal),
			readSessionHeaders(sessionSources(ctx)),
		])
		const items: WorktreeRow[] = []
		for (const entry of full.entries) {
			items.push(rowOf(entry, sessionsForWorktree(refs, entry.path), await isRegistered(ctx, entry.path)))
		}
		// One panel read = one `wt list`: that listing reports repo facts (root =
		// the workspace path it ran in) alongside every worktree of the repo, so a
		// second listing in the main worktree would only repeat them.
		return { repo: full.repo, items }
	}

	async function findEntry(root: string, branch: string, signal?: AbortSignal): Promise<WtEntry> {
		const entries = (await readFull(root, signal)).entries
		const entry = entries.find(candidate => candidate.branch === branch)
		if (entry === undefined) throw new WtError('NOT_FOUND', `no worktree for branch ${JSON.stringify(branch)} — check \`worktrunk_list\`.`)
		return entry
	}

	return {
		async readPanel(input: { workspaceId: string }, signal?: AbortSignal) {
			const root = await workspacePath(ctx, input.workspaceId)
			const rows = await readRows(root, signal)
			let hooks: readonly HookSpec[] = []
			try {
				hooks = await readHooks(root, signal)
			} catch {
				// Hook discovery is presentation data: a failure shows no hooks, it
				// never fails the panel read.
			}
			return { repo: rows.repo, items: rows.items, hooks }
		},
		async previewHooks(input: { workspaceId: string }, signal?: AbortSignal) {
			return readHooks(await workspacePath(ctx, input.workspaceId), signal)
		},
		async createWorktree(input, signal) {
			const root = await workspacePath(ctx, input.workspaceId)
			await wtOk(createArgs(config.bin, { branch: input.branch, base: input.base, hooks: input.skipHooks === true ? false : undefined }), root, signal)
			const entry = await findEntry(root, input.branch, signal)
			const registrationWarning = await registerWorkspace(ctx as unknown as Context, entry.path, input.branch, config.labelPrefix)
			return {
				path: entry.path,
				branch: input.branch,
				hooksRan: input.skipHooks !== true,
				...(registrationWarning === undefined ? {} : { registrationWarning }),
			}
		},
		async removeWorktree(input, signal) {
			const root = await workspacePath(ctx, input.workspaceId)
			const entry = await findEntry(root, input.branch, signal)
			// No supplied session cwd means "not running inside one": the guard is a no-op then.
			if (input.currentCwd !== undefined) assertNotSessionWorktree(entry, input.currentCwd, 'remove')
			await wtOk(removeArgs(config.bin, { branch: input.branch, force: input.force, forceDeleteBranch: input.forceDeleteBranch, keepBranch: input.keepBranch }), root, signal)
			await unregisterWorkspace(ctx as unknown as Context, entry.path)
			return { removed: true as const }
		},
		async mergeWorktree(input, signal) {
			const root = await workspacePath(ctx, input.workspaceId)
			const entry = await findEntry(root, input.branch, signal)
			if (input.keepWorktree !== true && input.currentCwd !== undefined) {
				assertNotSessionWorktree(entry, input.currentCwd, 'merge (it removes the worktree)')
			}
			await wtOk(mergeArgs(config.bin, { target: input.target, keepCommit: input.keepCommit, keepWorktree: input.keepWorktree }), entry.path, signal)
			if (input.keepWorktree !== true) await unregisterWorkspace(ctx as unknown as Context, entry.path)
			return { merged: true as const }
		},
		async copyIgnored(input, signal) {
			const cwd = input.path ?? (await workspacePath(ctx, input.workspaceId))
			await wtOk(copyIgnoredArgs(config.bin, { force: input.force, requireInclude: input.requireInclude }), cwd, signal)
			return { ok: true as const }
		},
		async openWorktree(input) {
			const warning = await registerWorkspace(ctx as unknown as Context, input.path, input.branch, config.labelPrefix)
			if (warning !== undefined) return { workspaceId: undefined }
			const registered = await (registryOf(ctx as unknown as Context)?.resolveByPath(input.path) ?? Promise.resolve(undefined))
			return { workspaceId: registered?.id }
		},
		async ensureWorktreePermission(input) {
			return ensureWorktreeFullAccess({
				sessions: { get: sessionId => (ctx.get('sessions') as { get(id: string): unknown } | undefined)?.get(sessionId) },
				permissionPresets: ctx.get('permissionPresets') as PermissionPresetService | undefined,
			}, input.sessionId)
		},
	}
}
