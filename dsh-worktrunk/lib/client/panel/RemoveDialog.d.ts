/**
 * Removal confirmation. `wt` owns the gates; this dialog only states them, so
 * its choices map one-to-one onto `--force`, `--force-delete`, and keeping the
 * branch. Both branch choices are always offered when a branch can be deleted —
 * the panel cannot know whether the branch is merged, and `wt remove` refuses an
 * unmerged branch without `--force-delete`.
 */
import { type ReactElement } from 'react';
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots';
import type { WorktreeRow } from '../../contract.js';
/** What the dialog must tell the user, and which gates apply. */
export declare function removeDialogFacts(row: WorktreeRow, t: Translate): {
    lines: readonly string[];
    needsForce: boolean;
    canDeleteBranch: boolean;
};
/** Submit gate: a dirty worktree may only go once the force acknowledgement is ticked. */
export declare function removeDialogBlocked(needsForce: boolean, force: boolean): boolean;
/**
 * Handler body, exported so the gate is drivable without a DOM: a blocked attempt
 * never reaches `submit`.
 */
export declare function removeDialogSubmit(facts: {
    needsForce: boolean;
}, choice: {
    force: boolean;
    forceDeleteBranch: boolean;
    keepBranch: boolean;
}, submit: (input: {
    force: boolean;
    forceDeleteBranch: boolean;
    keepBranch: boolean;
}) => void): void;
export interface RemoveDialogProps {
    readonly row: WorktreeRow;
    readonly t: Translate;
    readonly pending?: boolean;
    readonly errorKey?: string;
    readonly onCancel: () => void;
    readonly onSubmit: (input: {
        force: boolean;
        forceDeleteBranch: boolean;
        keepBranch: boolean;
    }) => void;
}
/** Remove-worktree dialog. */
export declare function RemoveDialog(props: RemoveDialogProps): ReactElement;
