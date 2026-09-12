/**
 * The acknowledgement step before a session inside a worktree is elevated. It
 * states the mechanism, the blast radius, and what does not change.
 */
import { type ReactElement } from 'react';
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots';
export interface PermissionDialogProps {
    readonly cwd: string;
    readonly t: Translate;
    readonly onCancel: () => void;
    readonly onConfirm: () => void | Promise<void>;
}
/** Full-access acknowledgement dialog. */
export declare function PermissionDialog(props: PermissionDialogProps): ReactElement;
