import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { WorktrunkRemoteResult } from '../contract.js'
import { createWorktrunkService, type WorktrunkServiceConfig } from './service.js'
import { createWorktrunkRemoteProjection, type WorktrunkRemoteManager } from './remote.js'

/**
 * Composition root for the browser half. Cordis constructs it, which registers
 * the `worktrunkManager` Typert namespace and binds the service to this fiber's
 * lifetime. The decorated methods stay deliberately thin: projection and error
 * normalization live in `createWorktrunkRemoteProjection`.
 */
export class WorktrunkRemoteService extends TypertRemoteService {
	static inject = ['subprocess']

	private readonly remote: WorktrunkRemoteManager

	constructor(ctx: Context, config: WorktrunkServiceConfig) {
		super(ctx, 'worktrunkManager')
		const service = createWorktrunkService(ctx as never, config)
		this.remote = createWorktrunkRemoteProjection(service)
	}

	@Remote
	readPanel(input: { workspaceId: string }): Promise<WorktrunkRemoteResult<unknown>> {
		return this.remote.readPanel(input)
	}

	@Remote
	previewHooks(input: { workspaceId: string }): Promise<WorktrunkRemoteResult<unknown>> {
		return this.remote.previewHooks(input)
	}

	@Remote
	createWorktree(input: { workspaceId: string, branch: string, base?: string, skipHooks?: boolean }): Promise<WorktrunkRemoteResult<unknown>> {
		return this.remote.createWorktree(input)
	}

	@Remote
	removeWorktree(input: { workspaceId: string, branch: string, force?: boolean, forceDeleteBranch?: boolean, keepBranch?: boolean, currentCwd?: string }): Promise<WorktrunkRemoteResult<null>> {
		return this.remote.removeWorktree(input)
	}

	@Remote
	mergeWorktree(input: { workspaceId: string, branch: string, target?: string, keepCommit?: boolean, keepWorktree?: boolean, currentCwd?: string }): Promise<WorktrunkRemoteResult<null>> {
		return this.remote.mergeWorktree(input)
	}

	@Remote
	copyIgnored(input: { workspaceId: string, path?: string, force?: boolean, requireInclude?: boolean }): Promise<WorktrunkRemoteResult<null>> {
		return this.remote.copyIgnored(input)
	}

	@Remote
	openWorktree(input: { workspaceId: string, path: string, branch: string }): Promise<WorktrunkRemoteResult<unknown>> {
		return this.remote.openWorktree(input)
	}

	@Remote
	ensureWorktreePermission(input: { sessionId: string }): Promise<WorktrunkRemoteResult<unknown>> {
		return this.remote.ensureWorktreePermission(input)
	}
}
