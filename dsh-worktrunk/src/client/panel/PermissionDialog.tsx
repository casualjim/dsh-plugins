/**
 * The acknowledgement step before a session inside a worktree is elevated. It
 * states the mechanism, the blast radius, and what does not change.
 */
import { useState, type ReactElement } from 'react'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'

export interface PermissionDialogProps {
	readonly cwd: string
	readonly t: Translate
	readonly onCancel: () => void
	readonly onConfirm: () => void | Promise<void>
}

/** Full-access acknowledgement dialog. */
export function PermissionDialog(props: PermissionDialogProps): ReactElement {
	const { t } = props
	const [acknowledged, setAcknowledged] = useState(false)
	const [pending, setPending] = useState(false)
	const submit = (): void => {
		if (!acknowledged || pending) return
		setPending(true)
		void (async () => {
			try {
				await props.onConfirm()
			} catch {
				// The entry turns a failed attempt into its own notice.
			} finally {
				setPending(false)
			}
		})()
	}
	return (
		<form
			className="wt-dialog wt-dialog-permission"
			onSubmit={(event) => {
				event.preventDefault()
				submit()
			}}
		>
			<h3>{t('permission.title')}</h3>
			<p>{t('permission.description', { cwd: props.cwd })}</p>
			<label>
				<input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />
				{t('permission.acknowledge')}
			</label>
			<footer>
				<button type="button" onClick={props.onCancel}>{t('permission.cancel')}</button>
				<button type="submit" disabled={!acknowledged || pending}>{t('permission.enable')}</button>
			</footer>
		</form>
	)
}
