/**
 * Panel body: header, worktree list, and the empty/loading/error states. Dialogs
 * are owned by the routing component in `entry.ts`; this file renders rows.
 */
import { useState, useSyncExternalStore, type ReactElement } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorktrunkConnection } from '../connection.js'
import { worktreeErrorMessageKey, type PanelStore } from '../store.js'
import { WorktreeRowView } from './rows.js'

export interface WorktreePanelProps {
	readonly store: PanelStore
	readonly connection: WorktrunkConnection
	readonly t: Translate
	readonly currentSessionCwd?: string
	readonly sessionLabel?: (sessionId: SessionId) => string
	readonly openSession: (sessionId: SessionId) => void
	readonly onCreate: () => void
	readonly onMerge?: (row: unknown) => void
	readonly onRemove?: (row: unknown) => void
	readonly onNewSession?: (row: unknown) => void
	readonly onSyncIgnored?: (row: unknown) => void
}

/** Panel body. */
export function WorktreePanel(props: WorktreePanelProps): ReactElement {
	const state = useSyncExternalStore(props.store.subscribe, props.store.getSnapshot, props.store.getSnapshot)
	const [expanded, setExpanded] = useState<readonly string[]>([])
	const workspaceId = state.workspaceId

	if (state.loading && state.repo === undefined) return <div className="wt-panel-loading">{props.t('panel.loading')}</div>
	if (state.error !== undefined && state.rows.length === 0) {
		const error = state.error
		return (
			<div className="wt-panel-error">
				<p>{props.t(worktreeErrorMessageKey(error), { reason: error.message })}</p>
				{error.retryable && workspaceId !== undefined
					? <button type="button" onClick={() => { void props.store.load(workspaceId) }}>{props.t('panel.retry')}</button>
					: null}
			</div>
		)
	}

	return (
		<div className="wt-panel">
			<header className="wt-panel-header">
				<h2>{props.t('panel.title')}</h2>
				<span className="wt-panel-repo">{state.repo?.forge ?? state.repo?.root ?? ''}</span>
				<span className="wt-panel-default">{state.repo?.defaultBranch ?? ''}</span>
				{workspaceId === undefined ? null : (
					<button type="button" onClick={() => { void props.store.load(workspaceId) }}>{props.t('panel.refresh')}</button>
				)}
				<button type="button" onClick={props.onCreate}>{props.t('panel.create')}</button>
			</header>
			{state.error !== undefined && state.rows.length > 0
				? <p className="wt-panel-stale">{props.t(worktreeErrorMessageKey(state.error), { reason: state.error.message })}</p>
				: null}
			{state.rows.length === 0
				? <p className="wt-panel-empty">{props.t('panel.empty')}</p>
				: null}
			<ul className="wt-rows">
				{state.rows.map(row => (
					<li key={row.path}>
						<WorktreeRowView
							row={row}
							t={props.t}
							expanded={expanded.includes(row.path)}
							selected={props.store.getSelection() === row.path}
							isCurrentSession={props.currentSessionCwd !== undefined && (props.currentSessionCwd === row.path || props.currentSessionCwd.startsWith(`${row.path}/`))}
							sessionLabel={props.sessionLabel ?? (sessionId => String(sessionId))}
							onToggle={() => setExpanded(current => (current.includes(row.path) ? current.filter(path => path !== row.path) : [...current, row.path]))}
							onSelect={() => props.store.setSelection(row.path)}
							onOpenSession={props.openSession}
							onNewSession={() => props.onNewSession?.(row)}
							onCopyPath={() => { void navigator.clipboard?.writeText(row.path) }}
							onSyncIgnored={() => props.onSyncIgnored?.(row)}
							onMerge={() => props.onMerge?.(row)}
							onRemove={() => props.onRemove?.(row)}
						/>
					</li>
				))}
			</ul>
		</div>
	)
}
