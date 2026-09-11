/** The preset this plugin adds to the permission patch row. */
export const WORKTREE_FULL_ACCESS_PRESET = 'worktree-full-access';
/** `undefined` means the history could not be read: a failed read is not "no restriction". */
function eventsOf(session) {
    if (Array.isArray(session.events))
        return session.events;
    try {
        return session.snapshotEvents?.() ?? [];
    }
    catch {
        return undefined;
    }
}
function presetOf(event) {
    const data = event.data;
    if (typeof data !== 'object' || data === null)
        return undefined;
    const preset = data.preset;
    return typeof preset === 'string' ? preset : undefined;
}
/** True when the session was full-access and a later event narrowed it. */
export function hasFullThenRestriction(events) {
    let fullSeen = false;
    for (const event of events) {
        if (event.type !== 'permission/preset')
            continue;
        const preset = presetOf(event);
        if (preset === undefined)
            continue;
        if (preset === WORKTREE_FULL_ACCESS_PRESET)
            fullSeen = true;
        else if (fullSeen)
            return true;
    }
    return false;
}
/**
 * Decide and, when legitimate, apply full access to one session.
 *
 * `user-restricted` means the user narrowed the session after this plugin
 * elevated it: the restriction is theirs and is preserved. `unavailable` means
 * the capability could not be verified — never a silent downgrade.
 */
export async function ensureWorktreeFullAccess(port, sessionId) {
    const presets = port.permissionPresets;
    if (presets === undefined || !presets.names.includes(WORKTREE_FULL_ACCESS_PRESET))
        return { status: 'unavailable' };
    let session;
    try {
        session = port.sessions.get(sessionId);
    }
    catch {
        return { status: 'unavailable' };
    }
    if (session === undefined || session === null)
        return { status: 'unavailable' };
    let current;
    try {
        current = presets.current(session);
    }
    catch {
        return { status: 'unavailable' };
    }
    // The verified current preset is authoritative and needs no history.
    if (current === WORKTREE_FULL_ACCESS_PRESET)
        return { status: 'already-full-access', preset: WORKTREE_FULL_ACCESS_PRESET };
    const events = eventsOf(session);
    if (events === undefined)
        return { status: 'unavailable' };
    if (hasFullThenRestriction(events))
        return { status: 'user-restricted' };
    try {
        presets.set(session, WORKTREE_FULL_ACCESS_PRESET);
    }
    catch {
        return { status: 'unavailable' };
    }
    return { status: 'applied', preset: WORKTREE_FULL_ACCESS_PRESET };
}
