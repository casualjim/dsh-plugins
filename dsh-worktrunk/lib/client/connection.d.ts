/**
 * The one wire adapter for the browser half. Every request rides the existing
 * DSH `/api` Connection; no second transport exists, and React never learns a
 * wire name.
 */
import type { PanelSnapshot, WorktrunkRemoteResult, HookSpec, WorktreeRow } from '../contract.js';
/** The one logical channel shared by the DSH Connection and Typert Gateway. */
export declare const WORKTRUNK_CHANNEL: '/api';
/** Canonical endpoints owned by this adapter. */
export declare const WORKTRUNK_ENDPOINTS: Readonly<{
    readonly readPanel: 'worktrunkManager/readPanel';
    readonly previewHooks: 'worktrunkManager/previewHooks';
    readonly createWorktree: 'worktrunkManager/createWorktree';
    readonly removeWorktree: 'worktrunkManager/removeWorktree';
    readonly mergeWorktree: 'worktrunkManager/mergeWorktree';
    readonly copyIgnored: 'worktrunkManager/copyIgnored';
    readonly openWorktree: 'worktrunkManager/openWorktree';
    readonly ensureWorktreePermission: 'worktrunkManager/ensureWorktreePermission';
}>;
/** Deliberately narrow transport seam: the adapter only needs `call`. */
export interface WorktrunkConnectionRpc {
    call(channel: string, endpoint: string, body: unknown, signal?: AbortSignal): Promise<unknown>;
}
export interface WorktrunkConnectionErrorOptions {
    readonly code: string;
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly retryable: boolean;
    readonly cause?: unknown;
}
/** Browser-safe error shared by transport, gateway, and domain failures. */
export declare class WorktrunkConnectionError extends Error {
    readonly code: string;
    readonly details: Readonly<Record<string, unknown>>;
    readonly retryable: boolean;
    constructor(options: WorktrunkConnectionErrorOptions);
}
export interface WorktrunkCreateInput {
    workspaceId: string;
    branch: string;
    base?: string;
    skipHooks?: boolean;
}
export interface WorktrunkRemoveInput {
    workspaceId: string;
    branch: string;
    force?: boolean;
    forceDeleteBranch?: boolean;
    keepBranch?: boolean;
    currentCwd?: string;
}
export interface WorktrunkMergeInput {
    workspaceId: string;
    branch: string;
    target?: string;
    keepCommit?: boolean;
    keepWorktree?: boolean;
    currentCwd?: string;
}
export interface WorktrunkCopyIgnoredInput {
    workspaceId: string;
    path?: string;
    force?: boolean;
    requireInclude?: boolean;
}
export interface WorktrunkOpenInput {
    workspaceId: string;
    path: string;
    branch: string;
}
export interface WorktrunkCreateResult {
    path: string;
    branch: string;
    hooksRan: boolean;
    registrationWarning?: string;
}
export interface WorktrunkPermissionResult {
    status: string;
    preset?: string;
}
/** Panel-facing connection surface. */
export interface WorktrunkConnection {
    readPanel(input: {
        workspaceId: string;
    }): Promise<PanelSnapshot>;
    previewHooks(input: {
        workspaceId: string;
    }): Promise<readonly HookSpec[]>;
    createWorktree(input: WorktrunkCreateInput): Promise<WorktrunkCreateResult>;
    removeWorktree(input: WorktrunkRemoveInput): Promise<void>;
    mergeWorktree(input: WorktrunkMergeInput): Promise<void>;
    copyIgnored(input: WorktrunkCopyIgnoredInput): Promise<void>;
    openWorktree(input: WorktrunkOpenInput): Promise<{
        workspaceId?: string;
    }>;
    ensureWorktreePermission(input: {
        sessionId: string;
    }): Promise<WorktrunkPermissionResult>;
    dispose(): void;
}
/** Adapt the shared DSH Connection RPC into the panel contract. */
export declare function createWorktrunkConnection(rpc: WorktrunkConnectionRpc): WorktrunkConnection;
export type { WorktreeRow, WorktrunkRemoteResult };
