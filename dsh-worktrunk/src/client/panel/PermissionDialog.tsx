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
	readonly onConfirm: () => void
}

/** Full-access acknowledgement dialog. */
export function PermissionDialog(props: PermissionDialogProps): ReactElement {
	const { t } = props
	const [acknowledged, setAcknowledged] = useState(false)
	return (
		<form
			className="wt-dialog wt-dialog-permission"
			onSubmit={(event) => {
				event.preventDefault()
				if (acknowledged) props.onConfirm()
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
				<button type="submit" disabled={!acknowledged}>{t('permission.enable')}</button>
			</footer>
		</form>
	)
}
