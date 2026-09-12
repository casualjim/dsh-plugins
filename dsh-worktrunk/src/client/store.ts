/**
 * Panel state. One read at a time per workspace, one generation per workspace,
 * and a stale response may never write: that is what keeps ready rows visible
 * while a replacement read is in flight or fails.
 */
import type { PanelSnapshot, WorktreeRow } from '../contract.js'
import { WorktrunkConnectionError, type WorktrunkConnection } from './connection.js'
import type { WorktrunkLocaleKey } from './locale.js'

/** What the panel renders. */
export interface PanelState {
	readonly workspaceId: string | undefined
	readonly repo: PanelSnapshot['repo'] | undefined
	readonly rows: readonly WorktreeRow[]
	readonly hooks: PanelSnapshot['hooks']
	readonly loading: boolean
	readonly error: { code: string, retryable: boolean, message: string } | undefined
}

/** Store surface: read, subscribe, and the two browser-local selections. */
export interface PanelStore {
	getSnapshot(): PanelState
	subscribe(listener: () => void): () => void
	load(workspaceId: string): Promise<void>
	setSelection(worktreePath: string | undefined): void
	getSelection(): string | undefined
	dispose(): void
}

const EMPTY: PanelState = { workspaceId: undefined, repo: undefined, rows: [], hooks: [], loading: false, error: undefined }

/** Map a failure to the locale key the panel shows. */
export function worktreeErrorMessageKey(error: unknown): WorktrunkLocaleKey {
	const candidate = error instanceof WorktrunkConnectionError
		? error.code
		: (error as { code?: unknown } | undefined)?.code
	const code = typeof candidate === 'string' ? candidate : undefined
	switch (code) {
		case 'WT_NOT_INSTALLED': return 'error.wtNotInstalled'
		case 'NOT_A_REPO': return 'error.notARepo'
		case 'NO_INITIAL_COMMIT': return 'error.noInitialCommit'
		case 'NO_LOCAL_BRANCH': return 'error.noLocalBranch'
		case 'WT_FAILED': return 'error.wtFailed'
		case 'WT_BUSY': return 'error.busy'
		case 'SESSION_WORKTREE': return 'error.sessionWorktree'
		case 'NOT_FOUND': return 'error.notFound'
		case 'HOOK_FAILED': return 'error.hookFailed'
		case 'PRESET_UNAVAILABLE': return 'error.presetUnavailable'
		default: return 'error.unknown'
	}
}

/** Create the panel store over one connection. */
export function createPanelStore(connection: WorktrunkConnection): PanelStore {
	let state: PanelState = EMPTY
	let selection: string | undefined
	let disposed = false
	const generations = new Map<string, number>()
	const listeners = new Set<() => void>()

	const publish = (next: Partial<PanelState>): void => {
		state = { ...state, ...next }
		for (const listener of listeners) listener()
	}

	return {
		getSnapshot: () => state,
		subscribe(listener) {
			listeners.add(listener)
			return () => { listeners.delete(listener) }
		},
		async load(workspaceId) {
			if (disposed) return
			const generation = (generations.get(workspaceId) ?? 0) + 1
			generations.set(workspaceId, generation)
			// A different workspace id is a first read: the previous workspace's rows
			// must never render under the new id.
			const firstRead = state.workspaceId !== workspaceId || state.repo === undefined
			publish(firstRead
				? { workspaceId, repo: undefined, rows: [], hooks: [], loading: true, error: undefined }
				: { workspaceId, loading: false, error: undefined })
			try {
				const snapshot = await connection.readPanel({ workspaceId })
				if (disposed || generations.get(workspaceId) !== generation || state.workspaceId !== workspaceId) return
				publish({ workspaceId, repo: snapshot.repo, rows: snapshot.items, hooks: snapshot.hooks, loading: false, error: undefined })
			} catch (error) {
				if (disposed || generations.get(workspaceId) !== generation || state.workspaceId !== workspaceId) return
				publish({
					loading: false,
					error: {
						code: error instanceof WorktrunkConnectionError ? error.code : 'UNKNOWN',
						retryable: error instanceof WorktrunkConnectionError ? error.retryable : true,
						message: error instanceof Error ? error.message : String(error),
					},
				})
			}
		},
		setSelection(worktreePath) { selection = worktreePath },
		getSelection: () => selection,
		dispose() { disposed = true; listeners.clear() },
	}
}
