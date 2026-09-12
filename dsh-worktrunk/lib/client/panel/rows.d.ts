/** Presentational rows: one worktree, its chips, and its sessions. */
import type { ReactElement } from 'react';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots';
import type { WorktreeRow } from '../../contract.js';
/** Status chips for one row, in a stable order: dirty, detached, branch, ahead/behind. */
export declare function rowChips(row: WorktreeRow, t: Translate): string[];
export interface WorktreeRowViewProps {
    readonly row: WorktreeRow;
    readonly t: Translate;
    readonly expanded: boolean;
    readonly selected: boolean;
    readonly isCurrentSession: boolean;
    readonly sessionLabel: (sessionId: SessionId) => string;
    readonly onToggle: () => void;
    readonly onSelect: () => void;
    readonly onOpenSession: (sessionId: SessionId) => void;
    readonly onNewSession: () => void;
    readonly onCopyPath: () => void;
    readonly onSyncIgnored: () => void;
    readonly onMerge: () => void;
    readonly onRemove: () => void;
}
/** One worktree row with `[current]`, HEAD, chips, and its session list. */
export declare function WorktreeRowView(props: WorktreeRowViewProps): ReactElement;
