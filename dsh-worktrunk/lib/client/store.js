import { WorktrunkConnectionError } from './connection.js';
const EMPTY = { workspaceId: undefined, repo: undefined, rows: [], hooks: [], loading: false, error: undefined, selection: undefined };
/** Map a failure to the locale key the panel shows. */
export function worktreeErrorMessageKey(error) {
    const candidate = error instanceof WorktrunkConnectionError
        ? error.code
        : error?.code;
    const code = typeof candidate === 'string' ? candidate : undefined;
    switch (code) {
        case 'WT_NOT_INSTALLED': return 'error.wtNotInstalled';
        case 'NOT_A_REPO': return 'error.notARepo';
        case 'NO_INITIAL_COMMIT': return 'error.noInitialCommit';
        case 'NO_LOCAL_BRANCH': return 'error.noLocalBranch';
        case 'WT_FAILED': return 'error.wtFailed';
        case 'WT_BUSY': return 'error.busy';
        case 'SESSION_WORKTREE': return 'error.sessionWorktree';
        case 'NOT_FOUND': return 'error.notFound';
        case 'HOOK_FAILED': return 'error.hookFailed';
        case 'PRESET_UNAVAILABLE': return 'error.presetUnavailable';
        default: return 'error.unknown';
    }
}
/** Create the panel store over one connection. */
export function createPanelStore(connection) {
    let state = EMPTY;
    let disposed = false;
    const generations = new Map();
    const listeners = new Set();
    const publish = (next) => {
        state = { ...state, ...next };
        for (const listener of listeners)
            listener();
    };
    return {
        getSnapshot: () => state,
        subscribe(listener) {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        async load(workspaceId) {
            if (disposed)
                return;
            const generation = (generations.get(workspaceId) ?? 0) + 1;
            generations.set(workspaceId, generation);
            // A different workspace id is a first read: the previous workspace's rows
            // must never render under the new id.
            const firstRead = state.workspaceId !== workspaceId || state.repo === undefined;
            publish(firstRead
                ? { workspaceId, repo: undefined, rows: [], hooks: [], loading: true, error: undefined }
                : { workspaceId, loading: false, error: undefined });
            try {
                const snapshot = await connection.readPanel({ workspaceId });
                if (disposed || generations.get(workspaceId) !== generation || state.workspaceId !== workspaceId)
                    return;
                publish({ workspaceId, repo: snapshot.repo, rows: snapshot.items, hooks: snapshot.hooks, loading: false, error: undefined });
            }
            catch (error) {
                if (disposed || generations.get(workspaceId) !== generation || state.workspaceId !== workspaceId)
                    return;
                publish({
                    loading: false,
                    error: {
                        code: error instanceof WorktrunkConnectionError ? error.code : 'UNKNOWN',
                        retryable: error instanceof WorktrunkConnectionError ? error.retryable : true,
                        message: error instanceof Error ? error.message : String(error),
                    },
                });
            }
        },
        setSelection(worktreePath) {
            // Selection rides in the snapshot: a plain listener notification is invisible
            // to `useSyncExternalStore`, which repaints only when the snapshot identity
            // changes. An unchanged value publishes nothing, so no pointless re-render.
            if (state.selection === worktreePath)
                return;
            publish({ selection: worktreePath });
        },
        getSelection: () => state.selection,
        dispose() { disposed = true; listeners.clear(); },
    };
}
