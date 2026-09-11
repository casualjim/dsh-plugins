/**
 * Wire vocabulary shared by the host service, the Typert remote, and the browser
 * panel. This module imports nothing: it is the one place both planes agree on.
 */
export const WORKTREE_ERROR_CODES = [
    'WT_NOT_INSTALLED',
    'NOT_A_REPO',
    'NO_INITIAL_COMMIT',
    'NO_LOCAL_BRANCH',
    'WT_FAILED',
    'WT_BAD_JSON',
    'WT_BUSY',
    'SESSION_WORKTREE',
    'PRESET_UNAVAILABLE',
    'PERMISSION_UNVERIFIED',
    'HOOK_FAILED',
    'NOT_FOUND',
];
/** Build a failure value. */
export function createWorktrunkFailure(code, message, details = {}) {
    return { code, message, details };
}
