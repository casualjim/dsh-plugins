/**
 * Session membership index. The host reads session *headers* only — never a
 * transcript, message, or event body — and groups a session under a worktree
 * because its cwd says it runs there.
 */
import type { SessionHeader } from '@deepseek-ai/dsh-session/types';
import type { WorktreeSessionRef } from '../contract.js';
/** The `SessionHeader` fields this index reads, named from the published header. */
type HeaderIdentity = Pick<SessionHeader, 'id' | 'cwd'>;
/** One live session as `ctx.sessions.list()` publishes it (its `Session`): the id is top-level. */
interface LiveSession {
    readonly id: string;
    readonly header?: Pick<SessionHeader, 'cwd'>;
}
/**
 * One stored-session snapshot exactly as `ctx.sessionPersistence.list()` publishes it
 * (`SessionPersistenceSnapshot`): the header is **nested**, with the revision and size
 * travelling beside it. Reading a top-level `id`/`cwd` here silently drops every persisted
 * session, which design §6 forbids.
 */
export interface PersistedSessionSnapshot {
    readonly header: HeaderIdentity;
    readonly revision?: unknown;
    readonly eventCount?: number;
    readonly sizeBytes?: number;
}
/** The two header sources a DSH host may provide. Both are optional. */
export interface SessionSources {
    sessions?: {
        list(): readonly LiveSession[];
    };
    sessionPersistence?: {
        list(): Promise<readonly PersistedSessionSnapshot[]>;
    };
}
/** Merge live and persisted headers by id; live wins, cwd-less sessions are dropped. */
export declare function readSessionHeaders(sources: SessionSources): Promise<WorktreeSessionRef[]>;
/** Sessions whose cwd is the worktree path itself or a directory inside it. */
export declare function sessionsForWorktree(refs: readonly WorktreeSessionRef[], worktreePath: string): WorktreeSessionRef[];
export {};
