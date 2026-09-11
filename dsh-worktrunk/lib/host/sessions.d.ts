import type { WorktreeSessionRef } from '../contract.js';
/** The two header sources a DSH host may provide. Both are optional. */
export interface SessionSources {
    sessions?: {
        list(): readonly {
            id: string;
            header?: {
                cwd?: string;
            };
        }[];
    };
    sessionPersistence?: {
        list(): Promise<readonly {
            id: string;
            cwd?: string;
        }[]>;
    };
}
/** Merge live and persisted headers by id; live wins, cwd-less sessions are dropped. */
export declare function readSessionHeaders(sources: SessionSources): Promise<WorktreeSessionRef[]>;
/** Sessions whose cwd is the worktree path itself or a directory inside it. */
export declare function sessionsForWorktree(refs: readonly WorktreeSessionRef[], worktreePath: string): WorktreeSessionRef[];
