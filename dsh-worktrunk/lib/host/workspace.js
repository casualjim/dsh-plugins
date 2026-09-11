/** Read the registry service out of a Cordis context. */
export function registryOf(ctx) {
    return ctx.get('workspaceRegistry');
}
/** Resolve a workspace id to its path using whichever read face the profile installs. */
export async function resolveWorkspacePath(ctx, workspaceId) {
    const registry = registryOf(ctx);
    if (registry === undefined)
        return undefined;
    const direct = registry.get?.(workspaceId);
    if (direct !== undefined)
        return direct.path;
    return registry.list?.().find(workspace => workspace.id === workspaceId)?.path;
}
/**
 * Register (or refresh) the worktree's DSH workspace registration. Best effort:
 * a registry failure returns a warning string and never fails the wt operation.
 */
export async function registerWorkspace(ctx, path, branch, labelPrefix) {
    const registry = registryOf(ctx);
    if (registry === undefined)
        return undefined;
    try {
        const existing = await registry.resolveByPath(path);
        if (existing === undefined)
            await registry.create(path, `${labelPrefix} ${branch}`);
        return undefined;
    }
    catch (error) {
        return `workspace registration skipped: ${error.message}`;
    }
}
/** Best-effort removal of a worktree's workspace registration. */
export async function unregisterWorkspace(ctx, path) {
    const registry = registryOf(ctx);
    if (registry === undefined)
        return;
    try {
        const workspace = await registry.resolveByPath(path);
        if (workspace !== undefined)
            await registry.delete(workspace.id);
    }
    catch {
        // Stale registration is harmless; the worktree itself is already gone.
    }
}
