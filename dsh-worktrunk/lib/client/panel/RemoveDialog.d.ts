/**
 * Removal confirmation. `wt` owns the gates; this dialog only states them, so
 * the two choices it offers map one-to-one onto `--force` and `--force-delete`.
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
    readonly unmerged: boolean;
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
