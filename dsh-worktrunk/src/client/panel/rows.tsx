/** Presentational rows: one worktree, its chips, and its sessions. */
import type { ReactElement } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorktreeRow } from '../../contract.js'

/** Status chips for one row, in a stable order: dirty, detached, branch, ahead/behind. */
export function rowChips(row: WorktreeRow, t: Translate): string[] {
	const chips: string[] = []
	if (Object.values(row.changes).some(Boolean)) chips.push(t('panel.dirty'))
	if (row.detached) chips.push(t('panel.detached'))
	if (row.branchMismatch) chips.push(t('panel.branchMismatch'))
	if (row.duplicateBranch) chips.push(t('panel.duplicateBranch'))
	if (row.upstream !== null && row.upstream.ahead > 0) chips.push(t('panel.ahead', { n: row.upstream.ahead }))
	if (row.upstream !== null && row.upstream.behind > 0) chips.push(t('panel.behind', { n: row.upstream.behind }))
	return chips
}

export interface WorktreeRowViewProps {
	readonly row: WorktreeRow
	readonly t: Translate
	readonly expanded: boolean
	readonly selected: boolean
	readonly isCurrentSession: boolean
	readonly sessionLabel: (sessionId: SessionId) => string
	readonly onToggle: () => void
	readonly onSelect: () => void
	readonly onOpenSession: (sessionId: SessionId) => void
	readonly onNewSession: () => void
	readonly onCopyPath: () => void
	readonly onSyncIgnored: () => void
	readonly onMerge: () => void
	readonly onRemove: () => void
}

/** One worktree row with `[current]`, HEAD, chips, and its session list. */
export function WorktreeRowView(props: WorktreeRowViewProps): ReactElement {
	const { row, t } = props
	const label = row.isMain ? t('panel.local') : row.branch
	return (
		<div className="wt-row" data-current={props.isCurrentSession ? 'true' : undefined} data-selected={props.selected ? 'true' : undefined}>
			<button type="button" className="wt-row-main" onClick={props.onSelect} aria-expanded={props.expanded}>
				<span className="wt-row-label">{label}</span>
				{props.isCurrentSession ? <span className="wt-row-mark">{t('panel.current')}</span> : null}
				{row.head === null ? null : <span className="wt-row-head">{`${row.head.shortSha} ${row.head.subject}`}</span>}
			</button>
			<button type="button" className="wt-row-toggle" aria-label={t('panel.sessions')} onClick={props.onToggle}>
				{`${t('panel.sessions')} (${row.sessions.length})`}
			</button>
			<div className="wt-row-chips">
				{rowChips(row, t).map(chip => <span className="wt-chip" key={chip}>{chip}</span>)}
			</div>
			<div className="wt-row-actions">
				<button type="button" onClick={props.onNewSession}>{t('panel.newSession')}</button>
				<button type="button" onClick={props.onCopyPath}>{t('panel.copyPath')}</button>
				<button type="button" onClick={props.onSyncIgnored}>{t('panel.syncIgnored')}</button>
				{row.detached ? null : <button type="button" onClick={props.onMerge}>{t('panel.merge')}</button>}
				{row.isMain ? null : <button type="button" onClick={props.onRemove}>{t('panel.remove')}</button>}
			</div>
			{props.expanded
				? (
					<ul className="wt-sessions">
						{row.sessions.length === 0 ? <li className="wt-session-empty">{t('panel.noSessions')}</li> : null}
						{row.sessions.map(session => (
							<li key={session.id}>
								<button type="button" onClick={() => props.onOpenSession(session.id as SessionId)}>{props.sessionLabel(session.id as SessionId)}</button>
							</li>
						))}
					</ul>
				)
				: null}
		</div>
	)
}
