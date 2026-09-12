/**
 * Create form. The hook list is the approval step `wt` would otherwise prompt
 * for, because creation runs with `--yes`; the toggle maps to `--no-hooks`.
 */
import { type ReactElement } from 'react';
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots';
import type { HookSpec, RepoFacts } from '../../contract.js';
/** Hook preview summary: one line per start hook, plus whether creation will block. */
export declare function createDialogSummary(hooks: readonly HookSpec[], t: Translate): {
    title: string;
    lines: readonly string[];
    blocking: boolean;
};
export interface CreateDialogProps {
    readonly repo: RepoFacts;
    readonly hooks: readonly HookSpec[];
    readonly defaultBranch: string;
    readonly currentBranch?: string;
    readonly t: Translate;
    readonly pending?: boolean;
    readonly errorKey?: string;
    readonly onCancel: () => void;
    readonly onSubmit: (input: {
        branch: string;
        base?: string;
        skipHooks: boolean;
    }) => void;
}
/** Create-worktree dialog. */
export declare function CreateDialog(props: CreateDialogProps): ReactElement;
