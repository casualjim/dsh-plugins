/** The sidebar glyph for the worktrunk panel entry. */
import type { ReactElement } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// The `sidebar.panellist` SlotMap key is declared by the sidebar package; importing
// its client entry is what puts that declaration in the program. `tsconfig.json`
// pins `@deepseek-ai/dsh-client-ui-slots` to this package's copy, so the sidebar's
// augmentation lands on the module the seat types below come from.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'

/** Renders the branch glyph at the sidebar-requested size. */
export function PanelIcon({ size, active }: PropsRuntime<'sidebar.panellist'>): ReactElement {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" data-active={active ? 'true' : undefined}>
			<path d="M4 2v9a2 2 0 0 0 2 2h3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
			<circle cx="4" cy="2.5" r="1.5" fill="currentColor" />
			<circle cx="11" cy="13" r="1.5" fill="currentColor" />
			<circle cx="11" cy="5.5" r="1.5" fill="currentColor" />
			<path d="M11 7v4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
		</svg>
	)
}
