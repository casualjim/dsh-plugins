/**
 * DSH workspaceRegistry seam. The plugin only ever registers worktree paths as
 * workspaces and refreshes/removes the registrations it created; it never reads
 * or writes DSH session data here.
 */
import type { Context } from '@deepseek-ai/cordis'

/** The workspace-registry service, when the profile provides one. */
export interface WorkspaceRegistry {
	get?(id: string): { id: string, path: string } | undefined
	list?(): readonly { id: string, path: string }[]
	create(path: string, label: string): Promise<unknown>
	resolveByPath(path: string): Promise<{ id: string } | undefined>
	delete(id: string): Promise<unknown>
}

/** Read the registry service out of a Cordis context. */
export function registryOf(ctx: Context): WorkspaceRegistry | undefined {
	return (ctx as unknown as { get(service: string): unknown }).get('workspaceRegistry') as WorkspaceRegistry | undefined
}

/** Resolve a workspace id to its path using whichever read face the profile installs. */
export async function resolveWorkspacePath(ctx: Context, workspaceId: string): Promise<string | undefined> {
	const registry = registryOf(ctx)
	if (registry === undefined) return undefined
	const direct = registry.get?.(workspaceId)
	if (direct !== undefined) return direct.path
	return registry.list?.().find(workspace => workspace.id === workspaceId)?.path
}

/**
 * Register (or refresh) the worktree's DSH workspace registration. Best effort:
 * a registry failure returns a warning string and never fails the wt operation.
 */
export async function registerWorkspace(ctx: Context, path: string, branch: string, labelPrefix: string): Promise<string | undefined> {
	const registry = registryOf(ctx)
	if (registry === undefined) return undefined
	try {
		const existing = await registry.resolveByPath(path)
		if (existing === undefined) await registry.create(path, `${labelPrefix} ${branch}`)
		return undefined
	} catch (error) {
		return `workspace registration skipped: ${(error as Error).message}`
	}
}

/** Best-effort removal of a worktree's workspace registration. */
export async function unregisterWorkspace(ctx: Context, path: string): Promise<void> {
	const registry = registryOf(ctx)
	if (registry === undefined) return
	try {
		const workspace = await registry.resolveByPath(path)
		if (workspace !== undefined) await registry.delete(workspace.id)
	} catch {
		// Stale registration is harmless; the worktree itself is already gone.
	}
}
