/**
 * Merge form. `wt merge` runs with the worktree as cwd, squashes and rebases,
 * fast-forwards the target, and removes the worktree unless told to keep it.
 */
import { type ReactElement } from 'react';
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots';
import type { HookSpec, WorktreeRow } from '../../contract.js';
/** One line per pre-merge hook. */
export declare function mergeHooks(hooks: readonly HookSpec[], t: Translate): readonly string[];
export interface MergeDialogProps {
    readonly row: WorktreeRow;
    readonly defaultBranch: string;
    readonly hooks: readonly HookSpec[];
    readonly isCurrentSessionWorktree: boolean;
    readonly t: Translate;
    readonly pending?: boolean;
    readonly errorKey?: string;
    readonly onCancel: () => void;
    readonly onSubmit: (input: {
        target: string;
        keepCommit: boolean;
        keepWorktree: boolean;
    }) => void;
}
/** Merge-worktree dialog. */
export declare function MergeDialog(props: MergeDialogProps): ReactElement;
