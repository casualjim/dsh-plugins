/**
 * Plain-JSON projection of the host service. Stable domain failures cross the
 * wire as values; anything unrecognized is rethrown so the DSH Gateway reports
 * a transport failure instead of dressing infrastructure faults as refusals.
 */
import { type HookSpec, type PanelSnapshot, type WorktrunkFailure, type WorktrunkRemoteResult } from '../contract.js';
import type { WorktrunkService } from './service.js';
/** Map a thrown value to a wire failure, or rethrow when it is not a domain error. */
export declare function toWorktrunkFailure(error: unknown): WorktrunkFailure;
/**
 * The method surface the Typert descriptors expose. Every value type is named
 * and JSON-safe on purpose: the generator rejects `unknown`, bare `any`, and
 * optionality expressed as `string | undefined` at a Remote boundary.
 */
export interface WorktrunkRemoteManager {
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
/** Wrap the service in the wire contract. */
export declare function createWorktrunkRemoteProjection(service: WorktrunkService): WorktrunkRemoteManager;
