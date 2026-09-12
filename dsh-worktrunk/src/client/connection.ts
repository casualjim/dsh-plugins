/**
 * The one wire adapter for the browser half. Every request rides the existing
 * DSH `/api` Connection; no second transport exists, and React never learns a
 * wire name.
 */
import type { PanelSnapshot, WorktrunkRemoteResult, HookSpec, WorktreeRow } from '../contract.js'

/** The one logical channel shared by the DSH Connection and Typert Gateway. */
export const WORKTRUNK_CHANNEL = '/api' as const

/** Canonical endpoints owned by this adapter. */
export const WORKTRUNK_ENDPOINTS = Object.freeze({
	readPanel: 'worktrunkManager/readPanel',
	previewHooks: 'worktrunkManager/previewHooks',
	createWorktree: 'worktrunkManager/createWorktree',
	removeWorktree: 'worktrunkManager/removeWorktree',
	mergeWorktree: 'worktrunkManager/mergeWorktree',
	copyIgnored: 'worktrunkManager/copyIgnored',
	openWorktree: 'worktrunkManager/openWorktree',
	ensureWorktreePermission: 'worktrunkManager/ensureWorktreePermission',
} as const)

/** Deliberately narrow transport seam: the adapter only needs `call`. */
export interface WorktrunkConnectionRpc {
	call(channel: string, endpoint: string, body: unknown, signal?: AbortSignal): Promise<unknown>
}

export interface WorktrunkConnectionErrorOptions {
	readonly code: string
	readonly message: string
	readonly details?: Readonly<Record<string, unknown>>
	readonly retryable: boolean
	readonly cause?: unknown
}

/** Browser-safe error shared by transport, gateway, and domain failures. */
export class WorktrunkConnectionError extends Error {
	readonly code: string
	readonly details: Readonly<Record<string, unknown>>
	readonly retryable: boolean

	constructor(options: WorktrunkConnectionErrorOptions) {
		super(options.message, options.cause === undefined ? undefined : { cause: options.cause })
		this.name = 'WorktrunkConnectionError'
		this.code = options.code
		this.details = Object.freeze({ ...(options.details ?? {}) })
		this.retryable = options.retryable
	}
}

export interface WorktrunkCreateInput { workspaceId: string, branch: string, base?: string, skipHooks?: boolean }
export interface WorktrunkRemoveInput { workspaceId: string, branch: string, force?: boolean, forceDeleteBranch?: boolean, keepBranch?: boolean, currentCwd?: string }
export interface WorktrunkMergeInput { workspaceId: string, branch: string, target?: string, keepCommit?: boolean, keepWorktree?: boolean, currentCwd?: string }
export interface WorktrunkCopyIgnoredInput { workspaceId: string, path?: string, force?: boolean, requireInclude?: boolean }
export interface WorktrunkOpenInput { workspaceId: string, path: string, branch: string }
export interface WorktrunkCreateResult { path: string, branch: string, hooksRan: boolean, registrationWarning?: string }
export interface WorktrunkPermissionResult { status: string, preset?: string }

/** Panel-facing connection surface. */
export interface WorktrunkConnection {
	readPanel(input: { workspaceId: string }): Promise<PanelSnapshot>
	previewHooks(input: { workspaceId: string }): Promise<readonly HookSpec[]>
	createWorktree(input: WorktrunkCreateInput): Promise<WorktrunkCreateResult>
	removeWorktree(input: WorktrunkRemoveInput): Promise<void>
	mergeWorktree(input: WorktrunkMergeInput): Promise<void>
	copyIgnored(input: WorktrunkCopyIgnoredInput): Promise<void>
	openWorktree(input: WorktrunkOpenInput): Promise<{ workspaceId?: string }>
	ensureWorktreePermission(input: { sessionId: string }): Promise<WorktrunkPermissionResult>
	dispose(): void
}

type Envelope = { ok: true, value: unknown } | { ok: false, error: { code?: unknown, message?: unknown, details?: unknown } }

/**
 * Domain failures a retry can clear on its own: `wt` absent or busy, an operation that failed,
 * a hook failure, an unverified permission, and the workspace readiness states that clear once
 * the repository is fixed. Every other code means the user must act or the profile must change,
 * so the panel shows the reason without a Retry button. Gateway/transport failures stay
 * retryable unconditionally — see `invoke`.
 */
const RETRYABLE_DOMAIN_CODES: ReadonlySet<string> = new Set([
	'WT_NOT_INSTALLED',
	'WT_BUSY',
	'WT_FAILED',
	'HOOK_FAILED',
	'PERMISSION_UNVERIFIED',
	'NOT_A_REPO',
	'NO_INITIAL_COMMIT',
	'NO_LOCAL_BRANCH',
	'WT_BAD_JSON',
])

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asEnvelope(value: unknown): Envelope {
	if (isRecord(value) && typeof value.ok === 'boolean') return value as Envelope
	return { ok: false, error: { code: 'WORKTRUNK_INVALID_RESULT', message: '', details: {} } }
}

/** Adapt the shared DSH Connection RPC into the panel contract. */
export function createWorktrunkConnection(rpc: WorktrunkConnectionRpc): WorktrunkConnection {
	const inFlight = new Set<AbortController>()
	let disposed = false

	async function invoke<Value>(endpoint: string, input: unknown): Promise<Value> {
		if (disposed) throw new WorktrunkConnectionError({ code: 'CLIENT_DISPOSED', message: 'Worktrunk connection is disposed; reload the plugin and retry.', retryable: false })
		const controller = new AbortController()
		inFlight.add(controller)
		try {
			let raw: unknown
			try {
				raw = await rpc.call(WORKTRUNK_CHANNEL, endpoint, { args: { input } }, controller.signal)
			} catch (error) {
				if (disposed && controller.signal.aborted) throw new WorktrunkConnectionError({ code: 'CLIENT_DISPOSED', message: 'Worktrunk connection is disposed; reload the plugin and retry.', retryable: false })
				throw new WorktrunkConnectionError({
					code: 'WORKTRUNK_CONNECTION_FAILED',
					message: error instanceof Error ? error.message : String(error),
					details: { endpoint },
					retryable: true,
					cause: error,
				})
			}
			const envelope = asEnvelope(raw)
			if (!envelope.ok) {
				const error = envelope.error
				throw new WorktrunkConnectionError({
					code: typeof error.code === 'string' ? error.code : 'WORKTRUNK_GATEWAY_FAILED',
					message: typeof error.message === 'string' ? error.message : '',
					details: { endpoint, ...(isRecord(error.details) ? error.details : {}) },
					retryable: true,
				})
			}
			const inner = asEnvelope(envelope.value)
			if (!inner.ok) {
				const error = inner.error
				const code = typeof error.code === 'string' ? error.code : 'WORKTRUNK_DOMAIN_FAILED'
				throw new WorktrunkConnectionError({
					code,
					message: typeof error.message === 'string' ? error.message : '',
					details: { endpoint, ...(isRecord(error.details) ? error.details : {}) },
					retryable: RETRYABLE_DOMAIN_CODES.has(code),
				})
			}
			return inner.value as Value
		} finally {
			inFlight.delete(controller)
		}
	}

	return {
		readPanel: input => invoke<PanelSnapshot>(WORKTRUNK_ENDPOINTS.readPanel, input),
		previewHooks: input => invoke<readonly HookSpec[]>(WORKTRUNK_ENDPOINTS.previewHooks, input),
		createWorktree: input => invoke<WorktrunkCreateResult>(WORKTRUNK_ENDPOINTS.createWorktree, input),
		async removeWorktree(input) { await invoke<null>(WORKTRUNK_ENDPOINTS.removeWorktree, input) },
		async mergeWorktree(input) { await invoke<null>(WORKTRUNK_ENDPOINTS.mergeWorktree, input) },
		async copyIgnored(input) { await invoke<null>(WORKTRUNK_ENDPOINTS.copyIgnored, input) },
		openWorktree: input => invoke<{ workspaceId?: string }>(WORKTRUNK_ENDPOINTS.openWorktree, input),
		ensureWorktreePermission: input => invoke<WorktrunkPermissionResult>(WORKTRUNK_ENDPOINTS.ensureWorktreePermission, input),
		dispose(): void {
			if (disposed) return
			disposed = true
			for (const controller of inFlight) controller.abort()
			inFlight.clear()
		},
	}
}

export type { WorktreeRow, WorktrunkRemoteResult }
