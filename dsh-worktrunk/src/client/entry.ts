/**
 * Browser half of dsh-worktrunk. It registers one sidebar panel entry and the
 * matching keyed main panel, and it owns the panel's dialog routing, session
 * creation, and the full-access confirmation flow.
 */
import { createElement, useEffect, useState, type ReactElement } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SlotCore, Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from './locale.js'
import { WORKTRUNK_NS, en } from './locale.js'
import { createWorktrunkConnection } from './connection.js'
import { createPanelStore, worktreeErrorMessageKey, type PanelStore } from './store.js'
import { WorktreePanel } from './panel/WorktreePanel.js'
import { CreateDialog } from './panel/CreateDialog.js'
import { RemoveDialog } from './panel/RemoveDialog.js'
import { MergeDialog } from './panel/MergeDialog.js'
import { PermissionDialog } from './panel/PermissionDialog.js'
import { PanelIcon } from './PanelIcon.js'
import type { HookSpec, RepoFacts, WorktreeRow } from '../contract.js'

/** Panel identity shared by the sidebar entry and the main-column occupant. */
export const WORKTRUNK_PANEL_ID = 'worktrunk' as const
/** Sidebar row order, after the shipped entries. */
export const WORKTRUNK_PANEL_ORDER = 20

/** Header facts for a panel whose repository read has not landed yet. */
const NO_REPO: RepoFacts = { root: '', defaultBranch: 'main', forge: null }

/** One workspace row as the Workspace Controller publishes it (`WorkspaceView`). */
export interface WorktreeWorkspaceRow {
	readonly workspaceId: string
	readonly sessionIds?: readonly string[]
}

/**
 * The workspace owning the current session, else the first registered one —
 * the same resolution DSH's own workspace browser performs.
 */
export function currentWorkspaceIdOf(rows: readonly WorktreeWorkspaceRow[] | undefined, currentSessionId: string | undefined): string | undefined {
	const items = rows ?? []
	if (currentSessionId !== undefined) {
		const owner = items.find(item => item.sessionIds?.includes(currentSessionId) === true)
		if (owner !== undefined) return owner.workspaceId
	}
	return items[0]?.workspaceId
}

/** What a permission outcome means for the session. */
export function describePermissionOutcome(status: string): { key: string, openSession: boolean, retryable: boolean } {
	switch (status) {
		case 'applied':
		case 'already-full-access':
			return { key: 'permission.applied', openSession: true, retryable: false }
		case 'user-restricted':
			return { key: 'permission.userRestricted', openSession: true, retryable: false }
		default:
			return { key: 'permission.unavailable', openSession: false, retryable: true }
	}
}

export const name = 'dsh-worktrunk-client'
export const inject = ['connection', 'locale', 'slots', 'sessions', 'workspaces']

/**
 * The client service faces. This package compiles its host and browser halves
 * in one program, and the host `@deepseek-ai/dsh-session` augmentation of
 * `Context.sessions` shadows the client one (the duplicate-declaration error
 * hides behind `skipLibCheck`), so the browser faces are reached through their
 * real types here rather than through `ctx`. The slots registry and the
 * Workspace Controller are provided by packages this one does not depend on
 * (the UI renderer, the workspace controller), so their narrowed read faces
 * live here too — the same treatment `src/host/workspace.ts` gives its
 * optional registry service.
 */
interface WorktrunkClient {
	readonly connection: ConnectionHandle
	readonly sessions: ISessions
	readonly slots: {
		readonly register: SlotCore['register']
		inject(key: string, callback: () => () => void): () => void
	}
	readonly workspaces?: { readonly list?: { getSnapshot(): { items?: readonly WorktreeWorkspaceRow[] } } }
}

/** Dialog under the panel body, if any. */
type WorktreeDialog =
	| { kind: 'none' }
	| { kind: 'create' }
	| { kind: 'remove', row: WorktreeRow, unmerged: boolean }
	| { kind: 'merge', row: WorktreeRow }
	| { kind: 'permission', cwd: string }

/** Register both slots and wire the panel. */
export function apply(ctx: ClientContext): void {
	const client = ctx as unknown as WorktrunkClient
	const t = ctx.locale.bind(WORKTRUNK_NS) as Translate
	ctx.effect(() => ctx.locale.register(WORKTRUNK_NS, 'en', en), 'dsh-worktrunk: locale dictionary')

	const connection = createWorktrunkConnection(client.connection.rpc)
	ctx.effect(() => () => connection.dispose(), 'dsh-worktrunk: connection disposal')

	const store = createPanelStore(connection)
	ctx.effect(() => () => store.dispose(), 'dsh-worktrunk: panel store disposal')

	const sessionList = (): ReturnType<typeof client.sessions.list.getSnapshot> => client.sessions.list.getSnapshot()
	const currentWorkspaceId = (): string | undefined =>
		currentWorkspaceIdOf(client.workspaces?.list?.getSnapshot().items, sessionList().current)
	const currentSessionCwd = (): string | undefined => {
		const snapshot = sessionList()
		return snapshot.current === undefined ? undefined : snapshot.byId[snapshot.current]?.cwd
	}
	const sessionLabel = (sessionId: SessionId): string => sessionList().byId[sessionId]?.displayTitle ?? String(sessionId)
	const isInsideWorktree = (path: string): boolean => {
		const cwd = currentSessionCwd()
		return cwd !== undefined && (cwd === path || cwd.startsWith(`${path}/`))
	}

	const Body = (): ReactElement => {
		const [dialog, setDialog] = useState<WorktreeDialog>({ kind: 'none' })
		const [hooks, setHooks] = useState<readonly HookSpec[]>([])
		const [errorKey, setErrorKey] = useState<string | undefined>(undefined)

		useEffect(() => {
			const workspaceId = currentWorkspaceId()
			if (workspaceId !== undefined) void store.load(workspaceId)
		}, [])

		const submitCreate = (input: { branch: string, base?: string, skipHooks: boolean }): void => {
			const workspaceId = currentWorkspaceId()
			if (workspaceId === undefined) return
			setErrorKey(undefined)
			void connection.createWorktree({ workspaceId, ...input })
				.then(() => store.load(workspaceId))
				.then(() => setDialog({ kind: 'none' }))
				.catch(error => setErrorKey(worktreeErrorMessageKey(error)))
		}

		const confirmPermission = (cwd: string): void => {
			void (async () => {
				try {
					const sessionId = await client.sessions.create({ cwd })
					const result = await connection.ensureWorktreePermission({ sessionId })
					const outcome = describePermissionOutcome(result.status)
					setErrorKey(outcome.key === 'permission.applied' ? undefined : outcome.key)
					if (outcome.openSession) client.sessions.open(sessionId)
				} catch (error) {
					setErrorKey(worktreeErrorMessageKey(error))
				} finally {
					setDialog({ kind: 'none' })
				}
			})()
		}

		return createElement('div', { className: 'wt-panel-host' },
			createElement(WorktreePanel, {
				store,
				connection,
				t,
				currentSessionCwd: currentSessionCwd(),
				sessionLabel,
				openSession: (sessionId: SessionId) => { client.sessions.open(sessionId) },
				onCreate: () => {
					const workspaceId = currentWorkspaceId()
					if (workspaceId === undefined) return
					void connection.previewHooks({ workspaceId }).then(setHooks).catch(() => setHooks([]))
					setErrorKey(undefined)
					setDialog({ kind: 'create' })
				},
				onNewSession: (row) => { setErrorKey(undefined); setDialog({ kind: 'permission', cwd: (row as WorktreeRow).path }) },
				onSyncIgnored: (row) => {
					const workspaceId = currentWorkspaceId()
					if (workspaceId !== undefined) void connection.copyIgnored({ workspaceId, path: (row as WorktreeRow).path })
				},
				onMerge: (row) => { setErrorKey(undefined); setDialog({ kind: 'merge', row: row as WorktreeRow }) },
				// ponytail: `unmerged` is not in the panel snapshot, so the delete-branch gate cannot be
				// pre-emptive; the host refuses and the notice names it. Widen WorktreeRow if it must show.
				onRemove: (row) => { setErrorKey(undefined); setDialog({ kind: 'remove', row: row as WorktreeRow, unmerged: false }) },
			}),
			dialog.kind === 'create'
				? createElement(CreateDialog, {
					repo: store.getSnapshot().repo ?? NO_REPO,
					hooks,
					defaultBranch: store.getSnapshot().repo?.defaultBranch ?? NO_REPO.defaultBranch,
					t,
					errorKey,
					onCancel: () => setDialog({ kind: 'none' }),
					onSubmit: submitCreate,
				})
				: null,
			dialog.kind === 'remove'
				? createElement(RemoveDialog, {
					row: dialog.row,
					unmerged: dialog.unmerged,
					t,
					errorKey,
					onCancel: () => setDialog({ kind: 'none' }),
					onSubmit: (input) => {
						const workspaceId = currentWorkspaceId()
						if (workspaceId === undefined) return
						void connection.removeWorktree({ workspaceId, branch: dialog.row.branch, ...input, currentCwd: currentSessionCwd() })
							.then(() => store.load(workspaceId))
							.then(() => setDialog({ kind: 'none' }))
							.catch(error => setErrorKey(worktreeErrorMessageKey(error)))
					},
				})
				: null,
			dialog.kind === 'merge'
				? createElement(MergeDialog, {
					row: dialog.row,
					defaultBranch: store.getSnapshot().repo?.defaultBranch ?? NO_REPO.defaultBranch,
					hooks: store.getSnapshot().hooks,
					isCurrentSessionWorktree: isInsideWorktree(dialog.row.path),
					t,
					errorKey,
					onCancel: () => setDialog({ kind: 'none' }),
					onSubmit: (input) => {
						const workspaceId = currentWorkspaceId()
						if (workspaceId === undefined) return
						void connection.mergeWorktree({ workspaceId, branch: dialog.row.branch, ...input, currentCwd: currentSessionCwd() })
							.then(() => store.load(workspaceId))
							.then(() => setDialog({ kind: 'none' }))
							.catch(error => setErrorKey(worktreeErrorMessageKey(error)))
					},
				})
				: null,
			dialog.kind === 'permission'
				? createElement(PermissionDialog, {
					cwd: dialog.cwd,
					t,
					onCancel: () => setDialog({ kind: 'none' }),
					onConfirm: () => confirmPermission(dialog.cwd),
				})
				: null,
			errorKey === undefined
				? null
				: createElement('p', { className: 'wt-panel-notice' }, t(errorKey)),
		)
	}

	client.slots.inject('sidebar.panellist', () => client.slots.register({
		name: 'sidebar.panellist',
		id: WORKTRUNK_PANEL_ID,
		order: WORKTRUNK_PANEL_ORDER,
		label: () => t('panel.label'),
	}, PanelIcon))

	client.slots.inject('main', () => client.slots.register({
		name: 'main',
		key: WORKTRUNK_PANEL_ID,
		locale: WORKTRUNK_NS,
		inject: () => ({ store }),
	}, Body))
}
