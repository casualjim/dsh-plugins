/**
 * Removal confirmation. `wt` owns the gates; this dialog only states them, so
 * its choices map one-to-one onto `--force`, `--force-delete`, and keeping the
 * branch. Both branch choices are always offered when a branch can be deleted —
 * the panel cannot know whether the branch is merged, and `wt remove` refuses an
 * unmerged branch without `--force-delete`.
 */
import { useState, type ReactElement } from 'react'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorktreeRow } from '../../contract.js'

/** What the dialog must tell the user, and which gates apply. */
export function removeDialogFacts(
	row: WorktreeRow,
	t: Translate,
): { lines: readonly string[], needsForce: boolean, canDeleteBranch: boolean } {
	const lines: string[] = []
	const dirty = Object.values(row.changes).some(Boolean)
	if (dirty) lines.push(t('remove.dirty'))
	if (row.detached) lines.push(t('remove.detached'))
	if (row.branchMismatch) lines.push(t('panel.branchMismatch'))
	if (row.sessions.length > 0) lines.push(t('panel.sessions'))
	return { lines, needsForce: dirty, canDeleteBranch: !row.detached }
}

/** Submit gate: a dirty worktree may only go once the force acknowledgement is ticked. */
export function removeDialogBlocked(needsForce: boolean, force: boolean): boolean {
	return needsForce && !force
}

/**
 * Handler body, exported so the gate is drivable without a DOM: a blocked attempt
 * never reaches `submit`.
 */
export function removeDialogSubmit(
	facts: { needsForce: boolean },
	choice: { force: boolean, forceDeleteBranch: boolean, keepBranch: boolean },
	submit: (input: { force: boolean, forceDeleteBranch: boolean, keepBranch: boolean }) => void,
): void {
	if (removeDialogBlocked(facts.needsForce, choice.force)) return
	submit(choice)
}

export interface RemoveDialogProps {
	readonly row: WorktreeRow
	readonly t: Translate
	readonly pending?: boolean
	readonly errorKey?: string
	readonly onCancel: () => void
	readonly onSubmit: (input: { force: boolean, forceDeleteBranch: boolean, keepBranch: boolean }) => void
}

/** Remove-worktree dialog. */
export function RemoveDialog(props: RemoveDialogProps): ReactElement {
	const { row, t } = props
	const facts = removeDialogFacts(row, t)
	const [force, setForce] = useState(false)
	const [forceDeleteBranch, setForceDeleteBranch] = useState(false)
	const [keepBranch, setKeepBranch] = useState(false)
	const blocked = removeDialogBlocked(facts.needsForce, force)

	return (
		<form
			className="wt-dialog wt-dialog-remove"
			onSubmit={(event) => {
				event.preventDefault()
				removeDialogSubmit(facts, { force, forceDeleteBranch, keepBranch }, props.onSubmit)
			}}
		>
			<h3>{t('remove.title')}</h3>
			<p>{t('remove.description', { branch: row.branch, path: row.path })}</p>
			{facts.lines.length === 0 ? null : <ul>{facts.lines.map(line => <li key={line}>{line}</li>)}</ul>}
			{facts.needsForce
				? (
					<label>
						<input type="checkbox" checked={force} onChange={event => setForce(event.target.checked)} />
						{t('remove.force')}
					</label>
				)
				: null}
			{/*
			 * `wt` is the gate: the panel snapshot does not carry the branch's merged state, so
			 * both branch choices are always offered and `wt remove` refuses an unmerged branch
			 * without `--force-delete`. The unmerged copy explains the force-delete option.
			 */}
			{facts.canDeleteBranch
				? (
					<label className="wt-dialog-choice">
						<input type="checkbox" checked={forceDeleteBranch} onChange={event => setForceDeleteBranch(event.target.checked)} />
						{t('remove.forceDeleteBranch')}
						<span className="wt-dialog-hint">{t('remove.branchUnmerged')}</span>
					</label>
				)
				: null}
			{facts.canDeleteBranch
				? (
					<label className="wt-dialog-choice">
						<input type="checkbox" checked={keepBranch} onChange={event => setKeepBranch(event.target.checked)} />
						{t('remove.keepBranch')}
					</label>
				)
				: null}
			{props.errorKey === undefined ? null : <p className="wt-dialog-error">{t(props.errorKey)}</p>}
			<footer>
				<button type="button" onClick={props.onCancel}>{t('remove.cancel')}</button>
				<button type="submit" disabled={blocked || props.pending === true}>{t('remove.submit')}</button>
			</footer>
		</form>
	)
}
