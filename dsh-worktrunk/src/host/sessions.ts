/**
 * Session membership index. The host reads session *headers* only — never a
 * transcript, message, or event body — and groups a session under a worktree
 * because its cwd says it runs there.
 */
import type { SessionHeader } from '@deepseek-ai/dsh-session/types'
import { isWithin } from '../wt.js'
import type { WorktreeSessionRef } from '../contract.js'

/** The `SessionHeader` fields this index reads, named from the published header. */
type HeaderIdentity = Pick<SessionHeader, 'id' | 'cwd'>

/** One live session as `ctx.sessions.list()` publishes it (its `Session`): the id is top-level. */
interface LiveSession { readonly id: string, readonly header?: Pick<SessionHeader, 'cwd'> }

/**
 * One stored-session snapshot exactly as `ctx.sessionPersistence.list()` publishes it
 * (`SessionPersistenceSnapshot`): the header is **nested**, with the revision and size
 * travelling beside it. Reading a top-level `id`/`cwd` here silently drops every persisted
 * session, which design §6 forbids.
 */
export interface PersistedSessionSnapshot {
	readonly header: HeaderIdentity
	readonly revision?: unknown
	readonly eventCount?: number
	readonly sizeBytes?: number
}

/** The two header sources a DSH host may provide. Both are optional. */
export interface SessionSources {
	sessions?: { list(): readonly LiveSession[] }
	sessionPersistence?: { list(): Promise<readonly PersistedSessionSnapshot[]> }
}

/** Merge live and persisted headers by id; live wins, cwd-less sessions are dropped. */
export async function readSessionHeaders(sources: SessionSources): Promise<WorktreeSessionRef[]> {
	const merged = new Map<string, string>()
	for (const session of sources.sessions?.list() ?? []) {
		const cwd = session.header?.cwd
		if (typeof cwd === 'string' && cwd !== '') merged.set(session.id, cwd)
	}
	try {
		for (const snapshot of await (sources.sessionPersistence?.list() ?? Promise.resolve([]))) {
			const { id, cwd } = snapshot.header
			if (merged.has(id)) continue
			if (typeof cwd === 'string' && cwd !== '') merged.set(id, cwd)
		}
	} catch {
		// A persistence failure degrades membership to live sessions only; it never
		// fails the panel read, and it never becomes an empty worktree list.
	}
	return [...merged].map(([id, cwd]) => ({ id, cwd }))
}

/** Sessions whose cwd is the worktree path itself or a directory inside it. */
export function sessionsForWorktree(refs: readonly WorktreeSessionRef[], worktreePath: string): WorktreeSessionRef[] {
	return refs.filter(ref => isWithin(worktreePath, ref.cwd))
}
