/**
 * Merge form. `wt merge` runs with the worktree as cwd, squashes and rebases,
 * fast-forwards the target, and removes the worktree unless told to keep it.
 */
import { useState, type ReactElement } from 'react'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type { HookSpec, WorktreeRow } from '../../contract.js'

/** One line per pre-merge hook. */
export function mergeHooks(hooks: readonly HookSpec[], t: Translate): readonly string[] {
	return hooks.filter(hook => hook.type === 'pre-merge').map(hook => `${hook.type} ${hook.name}: ${hook.template}`)
}

export interface MergeDialogProps {
	readonly row: WorktreeRow
	readonly defaultBranch: string
	readonly hooks: readonly HookSpec[]
	readonly isCurrentSessionWorktree: boolean
	readonly t: Translate
	readonly pending?: boolean
	readonly errorKey?: string
	readonly onCancel: () => void
	readonly onSubmit: (input: { target: string, keepCommit: boolean, keepWorktree: boolean }) => void
}

/** Merge-worktree dialog. */
export function MergeDialog(props: MergeDialogProps): ReactElement {
	const { row, t } = props
	const lines = mergeHooks(props.hooks, t)
	const [target, setTarget] = useState(props.defaultBranch)
	const [keepCommit, setKeepCommit] = useState(false)
	const [keepWorktree, setKeepWorktree] = useState(props.isCurrentSessionWorktree)

	return (
		<form
			className="wt-dialog wt-dialog-merge"
			onSubmit={(event) => {
				event.preventDefault()
				props.onSubmit({ target: target.trim() === '' ? props.defaultBranch : target.trim(), keepCommit, keepWorktree })
			}}
		>
			<h3>{t('merge.title')}</h3>
			<p>{t('merge.description', { branch: row.branch, target })}</p>
			<label>
				{t('merge.target')}
				<input value={target} onChange={event => setTarget(event.target.value)} />
			</label>
			<label>
				<input type="checkbox" checked={keepCommit} onChange={event => setKeepCommit(event.target.checked)} />
				{t('merge.keepCommit')}
			</label>
			<label>
				<input type="checkbox" checked={keepWorktree} onChange={event => setKeepWorktree(event.target.checked)} />
				{t('merge.keepWorktree')}
			</label>
			{lines.length === 0 ? null : (
				<section className="wt-hooks">
					<h4>{t('merge.hooks')}</h4>
					<ul>{lines.map(line => <li key={line}><code>{line}</code></li>)}</ul>
				</section>
			)}
			{props.errorKey === undefined ? null : <p className="wt-dialog-error">{t(props.errorKey)}</p>}
			<footer>
				<button type="button" onClick={props.onCancel}>{t('merge.cancel')}</button>
				<button type="submit" disabled={props.pending === true}>{t('merge.submit')}</button>
			</footer>
		</form>
	)
}
