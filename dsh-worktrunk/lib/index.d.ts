import type { Context } from '@deepseek-ai/cordis';
import { type WtEntry } from './wt.js';
export declare const name = "dsh-worktrunk";
export declare const inject: string[];
/** Row config `dsh-worktrunk` patch entry. */
export interface Config {
    /** `wt` binary name or absolute path. Default `wt`. */
    readonly bin?: string;
    /** Label prefix used when registering a worktree as a DSH workspace. Default `[wt]`. */
    readonly labelPrefix?: string;
}
/** Refuse an operation that would delete the worktree this session runs inside. */
export declare function assertNotSessionWorktree(entry: WtEntry | undefined, cwd: string, action: string): void;
/** Parse `/wt ...` into a typed request; errors carry usage help. */
export declare function parseCommand(rawInput: string): {
    kind: string;
    branch?: string;
    base?: string;
    target?: string;
    force?: boolean;
    keepCommit?: boolean;
    keepWorktree?: boolean;
};
/** Mount the plugin: tools, command, and session context note. */
export declare function apply(ctx: Context, config?: Config): void;
