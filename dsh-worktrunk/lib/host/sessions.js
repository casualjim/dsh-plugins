/**
 * Session membership index. The host reads session *headers* only — never a
 * transcript, message, or event body — and groups a session under a worktree
 * because its cwd says it runs there.
 */
import { isWithin } from '../wt.js';
/** Merge live and persisted headers by id; live wins, cwd-less sessions are dropped. */
export async function readSessionHeaders(sources) {
    const merged = new Map();
    for (const session of sources.sessions?.list() ?? []) {
        const cwd = session.header?.cwd;
        if (typeof cwd === 'string' && cwd !== '')
            merged.set(session.id, cwd);
    }
    try {
        for (const header of await (sources.sessionPersistence?.list() ?? Promise.resolve([]))) {
            if (merged.has(header.id))
                continue;
            if (typeof header.cwd === 'string' && header.cwd !== '')
                merged.set(header.id, header.cwd);
        }
    }
    catch {
        // A persistence failure degrades membership to live sessions only; it never
        // fails the panel read, and it never becomes an empty worktree list.
    }
    return [...merged].map(([id, cwd]) => ({ id, cwd }));
}
/** Sessions whose cwd is the worktree path itself or a directory inside it. */
export function sessionsForWorktree(refs, worktreePath) {
    return refs.filter(ref => isWithin(worktreePath, ref.cwd));
}
