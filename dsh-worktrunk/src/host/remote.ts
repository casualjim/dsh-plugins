/**
 * Plain-JSON projection of the host service. Stable domain failures cross the
 * wire as values; anything unrecognized is rethrown so the DSH Gateway reports
 * a transport failure instead of dressing infrastructure faults as refusals.
 */
import {
	WORKTREE_ERROR_CODES,
	createWorktrunkFailure,
	type HookSpec,
	type PanelSnapshot,
	type WorktreeErrorCode,
	type WorktrunkFailure,
	type WorktrunkRemoteResult,
} from '../contract.js'
import { WtError } from '../wt.js'
import type { WorktrunkService } from './service.js'

const codes = new Set<string>(WORKTREE_ERROR_CODES)

function isKnownFailure(error: unknown): error is WtError & { code: WorktreeErrorCode } {
	return error instanceof WtError && codes.has(error.code)
}

/** Map a thrown value to a wire failure, or rethrow when it is not a domain error. */
export function toWorktrunkFailure(error: unknown): WorktrunkFailure {
	if (!isKnownFailure(error)) throw error
	return createWorktrunkFailure(error.code, error.message, {})
}

async function project<Value>(operation: () => Promise<Value>): Promise<WorktrunkRemoteResult<Value>> {
	try {
		return { ok: true, value: await operation() }
	} catch (error) {
		return { ok: false, error: toWorktrunkFailure(error) }
	}
}

/**
 * The method surface the Typert descriptors expose. Every value type is named
 * and JSON-safe on purpose: the generator rejects `unknown`, bare `any`, and
 * optionality expressed as `string | undefined` at a Remote boundary.
 */
export interface WorktrunkRemoteManager {
	readPanel(input: { workspaceId: string }): Promise<WorktrunkRemoteResult<PanelSnapshot>>
	previewHooks(input: { workspaceId: string }): Promise<WorktrunkRemoteResult<readonly HookSpec[]>>
	createWorktree(input: { workspaceId: string, branch: string, base?: string, skipHooks?: boolean }): Promise<WorktrunkRemoteResult<{ path: string, branch: string, hooksRan: boolean, registrationWarning?: string }>>
	removeWorktree(input: { workspaceId: string, branch: string, force?: boolean, forceDeleteBranch?: boolean, keepBranch?: boolean, currentCwd?: string }): Promise<WorktrunkRemoteResult<null>>
	mergeWorktree(input: { workspaceId: string, branch: string, target?: string, keepCommit?: boolean, keepWorktree?: boolean, currentCwd?: string }): Promise<WorktrunkRemoteResult<null>>
	copyIgnored(input: { workspaceId: string, path?: string, force?: boolean, requireInclude?: boolean }): Promise<WorktrunkRemoteResult<null>>
	openWorktree(input: { workspaceId: string, path: string, branch: string }): Promise<WorktrunkRemoteResult<{ workspaceId?: string }>>
	ensureWorktreePermission(input: { sessionId: string }): Promise<WorktrunkRemoteResult<{ status: string, preset?: string }>>
}

/** Wrap the service in the wire contract. */
export function createWorktrunkRemoteProjection(service: WorktrunkService): WorktrunkRemoteManager {
	return {
		readPanel: input => project(() => service.readPanel(input)),
		previewHooks: input => project(() => service.previewHooks(input)),
		createWorktree: input => project(() => service.createWorktree(input)),
		removeWorktree: input => project(async () => { await service.removeWorktree(input); return null }),
		mergeWorktree: input => project(async () => { await service.mergeWorktree(input); return null }),
		copyIgnored: input => project(async () => { await service.copyIgnored(input); return null }),
		openWorktree: input => project(() => service.openWorktree(input)),
		ensureWorktreePermission: input => project(() => service.ensureWorktreePermission(input)),
	}
}
