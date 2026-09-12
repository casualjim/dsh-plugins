/**
 * Create form. The hook list is the approval step `wt` would otherwise prompt
 * for, because creation runs with `--yes`; the toggle maps to `--no-hooks`.
 */
import { useState, type ReactElement } from 'react'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type { HookSpec, RepoFacts } from '../../contract.js'

/** Hook preview summary: one line per hook, plus whether creation will block. */
export function createDialogSummary(
	hooks: readonly HookSpec[],
	t: Translate,
): { title: string, lines: readonly string[], blocking: boolean } {
	return {
		title: hooks.length === 0 ? t('create.noHooks') : t('create.hooks'),
		lines: hooks.map(hook => `${hook.type} ${hook.name}: ${hook.template}`),
		blocking: hooks.some(hook => hook.type === 'pre-start'),
	}
}

export interface CreateDialogProps {
	readonly repo: RepoFacts
	readonly hooks: readonly HookSpec[]
	readonly defaultBranch: string
	readonly currentBranch?: string
	readonly t: Translate
	readonly pending?: boolean
	readonly errorKey?: string
	readonly onCancel: () => void
	readonly onSubmit: (input: { branch: string, base?: string, skipHooks: boolean }) => void
}

/** Create-worktree dialog. */
export function CreateDialog(props: CreateDialogProps): ReactElement {
	const { t, hooks } = props
	const [branch, setBranch] = useState('')
	const [base, setBase] = useState(props.defaultBranch)
	const [skipHooks, setSkipHooks] = useState(false)
	const summary = createDialogSummary(hooks, t)
	const canSubmit = branch.trim() !== '' && props.pending !== true

	return (
		<form
			className="wt-dialog wt-dialog-create"
			onSubmit={(event) => {
				event.preventDefault()
				if (!canSubmit) return
				const base2 = base.trim()
				props.onSubmit({ branch: branch.trim(), ...(base2 === '' ? {} : { base: base2 }), skipHooks })
			}}
		>
			<h3>{t('create.title')}</h3>
			<p>{t('create.description', { repo: props.repo.forge ?? props.repo.root })}</p>
			<label>
				{t('create.branch')}
				<input value={branch} onChange={event => setBranch(event.target.value)} placeholder="feature/next" autoFocus />
			</label>
			<label>
				{t('create.base')}
				<select value={base} onChange={event => setBase(event.target.value)}>
					{props.currentBranch === undefined ? null : <option value={props.currentBranch}>{t('create.baseCurrent', { branch: props.currentBranch })}</option>}
					<option value={props.defaultBranch}>{props.defaultBranch}</option>
				</select>
			</label>
			<section className="wt-hooks">
				<h4>{summary.title}</h4>
				{summary.lines.length === 0 ? null : (
					<ul>{summary.lines.map(line => <li key={line}><code>{line}</code></li>)}</ul>
				)}
				{summary.blocking ? <p className="wt-hooks-blocking">{t('create.blocking')}</p> : null}
				{hooks.length === 0 ? null : (
					<label className="wt-hooks-skip">
						<input type="checkbox" checked={skipHooks} onChange={event => setSkipHooks(event.target.checked)} />
						{t('create.skipHooks')}
					</label>
				)}
			</section>
			{props.pending === true ? <p className="wt-dialog-working">{t('create.working')}</p> : null}
			{props.errorKey === undefined ? null : <p className="wt-dialog-error">{t(props.errorKey)}</p>}
			<footer>
				<button type="button" onClick={props.onCancel}>{t('create.cancel')}</button>
				<button type="submit" disabled={!canSubmit}>{t('create.submit')}</button>
			</footer>
		</form>
	)
}
