/**
 * Panel state. One read at a time per workspace, one generation per workspace,
 * and a stale response may never write: that is what keeps ready rows visible
 * while a replacement read is in flight or fails.
 */
import type { PanelSnapshot, WorktreeRow } from '../contract.js';
import { type WorktrunkConnection } from './connection.js';
import type { WorktrunkLocaleKey } from './locale.js';
/** What the panel renders. */
export interface PanelState {
    readonly workspaceId: string | undefined;
    readonly repo: PanelSnapshot['repo'] | undefined;
    readonly rows: readonly WorktreeRow[];
    readonly hooks: PanelSnapshot['hooks'];
    readonly loading: boolean;
    readonly error: {
        code: string;
        retryable: boolean;
        message: string;
    } | undefined;
    /** The selected worktree path, or `undefined`. Part of the snapshot on purpose:
     * React only repaints when the snapshot identity changes. */
    readonly selection: string | undefined;
}
/** Store surface: read, subscribe, and the two browser-local selections. */
export interface PanelStore {
    getSnapshot(): PanelState;
    subscribe(listener: () => void): () => void;
    load(workspaceId: string): Promise<void>;
    setSelection(worktreePath: string | undefined): void;
    getSelection(): string | undefined;
    dispose(): void;
}
/** Map a failure to the locale key the panel shows. */
export declare function worktreeErrorMessageKey(error: unknown): WorktrunkLocaleKey;
/** Create the panel store over one connection. */
export declare function createPanelStore(connection: WorktrunkConnection): PanelStore;
