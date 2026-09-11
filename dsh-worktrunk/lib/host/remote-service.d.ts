import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { HookSpec, PanelSnapshot, WorktrunkRemoteResult } from '../contract.js';
import { type WorktrunkServiceConfig } from './service.js';
/**
 * Composition root for the browser half. Cordis constructs it, which registers
 * the `worktrunkManager` Typert namespace and binds the service to this fiber's
 * lifetime. The decorated methods stay deliberately thin: projection and error
 * normalization live in `createWorktrunkRemoteProjection`.
 */
export declare class WorktrunkRemoteService extends TypertRemoteService {
    static inject: string[];
    private readonly remote;
    constructor(ctx: Context, config: WorktrunkServiceConfig);
    readPanel(input: {
        workspaceId: string;
    }): Promise<WorktrunkRemoteResult<PanelSnapshot>>;
    previewHooks(input: {
        workspaceId: string;
    }): Promise<WorktrunkRemoteResult<readonly HookSpec[]>>;
    createWorktree(input: {
        workspaceId: string;
        branch: string;
        base?: string;
        skipHooks?: boolean;
    }): Promise<WorktrunkRemoteResult<{
        path: string;
        branch: string;
        hooksRan: boolean;
        registrationWarning?: string;
    }>>;
    removeWorktree(input: {
        workspaceId: string;
        branch: string;
        force?: boolean;
        forceDeleteBranch?: boolean;
        keepBranch?: boolean;
        currentCwd?: string;
    }): Promise<WorktrunkRemoteResult<null>>;
    mergeWorktree(input: {
        workspaceId: string;
        branch: string;
        target?: string;
        keepCommit?: boolean;
        keepWorktree?: boolean;
        currentCwd?: string;
    }): Promise<WorktrunkRemoteResult<null>>;
    copyIgnored(input: {
        workspaceId: string;
        path?: string;
        force?: boolean;
        requireInclude?: boolean;
    }): Promise<WorktrunkRemoteResult<null>>;
    openWorktree(input: {
        workspaceId: string;
        path: string;
        branch: string;
    }): Promise<WorktrunkRemoteResult<{
        workspaceId?: string;
    }>>;
    ensureWorktreePermission(input: {
        sessionId: string;
    }): Promise<WorktrunkRemoteResult<{
        status: string;
        preset?: string;
    }>>;
}
