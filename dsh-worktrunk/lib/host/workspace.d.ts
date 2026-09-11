/**
 * DSH workspaceRegistry seam. The plugin only ever registers worktree paths as
 * workspaces and refreshes/removes the registrations it created; it never reads
 * or writes DSH session data here.
 */
import type { Context } from '@deepseek-ai/cordis';
/** The workspace-registry service, when the profile provides one. */
export interface WorkspaceRegistry {
    get?(id: string): {
        id: string;
        path: string;
    } | undefined;
    list?(): readonly {
        id: string;
        path: string;
    }[];
    create(path: string, label: string): Promise<unknown>;
    resolveByPath(path: string): Promise<{
        id: string;
    } | undefined>;
    delete(id: string): Promise<unknown>;
}
/** Read the registry service out of a Cordis context. */
export declare function registryOf(ctx: Context): WorkspaceRegistry | undefined;
/** Resolve a workspace id to its path using whichever read face the profile installs. */
export declare function resolveWorkspacePath(ctx: Context, workspaceId: string): Promise<string | undefined>;
/**
 * Register (or refresh) the worktree's DSH workspace registration. Best effort:
 * a registry failure returns a warning string and never fails the wt operation.
 */
export declare function registerWorkspace(ctx: Context, path: string, branch: string, labelPrefix: string): Promise<string | undefined>;
/** Best-effort removal of a worktree's workspace registration. */
export declare function unregisterWorkspace(ctx: Context, path: string): Promise<void>;
