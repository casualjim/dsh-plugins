/**
 * Plain-JSON projection of the host service. Stable domain failures cross the
 * wire as values; anything unrecognized is rethrown so the DSH Gateway reports
 * a transport failure instead of dressing infrastructure faults as refusals.
 */
import { WORKTREE_ERROR_CODES, createWorktrunkFailure, } from '../contract.js';
import { WtError } from '../wt.js';
const codes = new Set(WORKTREE_ERROR_CODES);
function isKnownFailure(error) {
    return error instanceof WtError && codes.has(error.code);
}
/** Map a thrown value to a wire failure, or rethrow when it is not a domain error. */
export function toWorktrunkFailure(error) {
    if (!isKnownFailure(error))
        throw error;
    return createWorktrunkFailure(error.code, error.message, {});
}
async function project(operation) {
    try {
        return { ok: true, value: await operation() };
    }
    catch (error) {
        return { ok: false, error: toWorktrunkFailure(error) };
    }
}
/** Wrap the service in the wire contract. */
export function createWorktrunkRemoteProjection(service) {
    return {
        readPanel: input => project(() => service.readPanel(input)),
        previewHooks: input => project(() => service.previewHooks(input)),
        createWorktree: input => project(() => service.createWorktree(input)),
        removeWorktree: input => project(async () => { await service.removeWorktree(input); return null; }),
        mergeWorktree: input => project(async () => { await service.mergeWorktree(input); return null; }),
        copyIgnored: input => project(async () => { await service.copyIgnored(input); return null; }),
        openWorktree: input => project(() => service.openWorktree(input)),
        ensureWorktreePermission: input => project(() => service.ensureWorktreePermission(input)),
    };
}
