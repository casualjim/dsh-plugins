import { type WtContext } from '../wt.js';
import type { HookSpec, PanelSnapshot } from '../contract.js';
/** Cordis context plus the subprocess service `wt` runs through. */
export interface WorktrunkServiceContext extends WtContext {
    get(service: string): unknown;
}
/** Row config for the `dsh-worktrunk` patch entry. */
export interface WorktrunkServiceConfig {
    readonly bin: string;
    readonly labelPrefix: string;
}
/** Panel-facing service surface. */
export interface WorktrunkService {
    readPanel(input: {
        workspaceId: string;
    }, signal?: AbortSignal): Promise<PanelSnapshot>;
    previewHooks(input: {
        workspaceId: string;
    }, signal?: AbortSignal): Promise<readonly HookSpec[]>;
    createWorktree(input: {
        workspaceId: string;
        branch: string;
        base?: string;
        skipHooks?: boolean;
    }, signal?: AbortSignal): Promise<{
        path: string;
        branch: string;
        hooksRan: boolean;
        registrationWarning?: string;
    }>;
    removeWorktree(input: {
        workspaceId: string;
        branch: string;
        force?: boolean;
        forceDeleteBranch?: boolean;
        keepBranch?: boolean;
        currentCwd?: string;
    }, signal?: AbortSignal): Promise<{
        removed: true;
    }>;
    mergeWorktree(input: {
        workspaceId: string;
        branch: string;
        target?: string;
        keepCommit?: boolean;
        keepWorktree?: boolean;
        currentCwd?: string;
    }, signal?: AbortSignal): Promise<{
        merged: true;
    }>;
    copyIgnored(input: {
        workspaceId: string;
        path?: string;
        force?: boolean;
        requireInclude?: boolean;
    }, signal?: AbortSignal): Promise<{
        ok: true;
    }>;
    openWorktree(input: {
        workspaceId: string;
        path: string;
        branch: string;
    }): Promise<{
        workspaceId?: string;
    }>;
    ensureWorktreePermission(input: {
        sessionId: string;
    }): Promise<{
        status: string;
        preset?: string;
    }>;
}
/** Build the panel-facing service over one Cordis context. */
export declare function createWorktrunkService(ctx: WorktrunkServiceContext, config: WorktrunkServiceConfig): WorktrunkService;
