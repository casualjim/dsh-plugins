/**
 * The only place the plugin executes `wt` on behalf of the browser panel. Reads
 * reuse the same runner and normalization the agent tools use; nothing here
 * writes plugin state, and nothing here calls git.
 */
import type { Context } from '@deepseek-ai/cordis'
import { hookSpecs, listWorktreesFull, WtError, type WtContext, type WtEntry } from '../wt.js'
import type { HookSpec, PanelSnapshot, RepoFacts, WorktreeRow, WorktreeSessionRef } from '../contract.js'
import { readSessionHeaders, sessionsForWorktree, type SessionSources } from './sessions.js'
import { registryOf, resolveWorkspacePath, type WorkspaceRegistry } from './workspace.js'

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
	openWorktree(input: { workspaceId: string, path: string, branch: string }): Promise<{ workspaceId: string | undefined }>
	ensureWorktreePermission(input: { sessionId: string }): Promise<{ status: string, preset?: string }>
}

async function workspacePath(ctx: WorktrunkServiceContext, workspaceId: string): Promise<string> {
	const path = await resolveWorkspacePath(ctx as unknown as Context, workspaceId)
	if (path === undefined) throw new WtError('NOT_FOUND', `workspace ${JSON.stringify(workspaceId)} is not registered`)
	return path
}

/** Whether the registry already knows this path; either registry face counts. */
async function isRegistered(registry: WorkspaceRegistry | undefined, path: string): Promise<boolean> {
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

/** Build the panel-facing service over one Cordis context. */
export function createWorktrunkService(ctx: WorktrunkServiceContext, config: WorktrunkServiceConfig): WorktrunkService {
	const registry = registryOf(ctx as unknown as Context)

	async function readRows(root: string, signal?: AbortSignal): Promise<{ repo: RepoFacts, items: WorktreeRow[] }> {
		const [full, refs] = await Promise.all([
			listWorktreesFull(ctx, config.bin, root, signal),
			readSessionHeaders(sessionSources(ctx)),
		])
		const items: WorktreeRow[] = []
		for (const entry of full.entries) {
			items.push(rowOf(entry, sessionsForWorktree(refs, entry.path), await isRegistered(registry, entry.path)))
		}
		// One panel read = one `wt list`: that listing reports repo facts (root =
		// the workspace path it ran in) alongside every worktree of the repo, so a
		// second listing in the main worktree would only repeat them.
		return { repo: full.repo, items }
	}

	return {
		async readPanel(input: { workspaceId: string }, signal?: AbortSignal) {
			const root = await workspacePath(ctx, input.workspaceId)
			const rows = await readRows(root, signal)
			let hooks: readonly HookSpec[] = []
			try {
				hooks = await hookSpecs(ctx, config.bin, root, signal)
			} catch {
				// Hook discovery is presentation data: a failure shows no hooks, it
				// never fails the panel read.
			}
			return { repo: rows.repo, items: rows.items, hooks }
		},
		async previewHooks(input: { workspaceId: string }, signal?: AbortSignal) {
			return hookSpecs(ctx, config.bin, await workspacePath(ctx, input.workspaceId), signal)
		},
		// Mutation methods are added in Task 8.
	} as unknown as WorktrunkService
}
