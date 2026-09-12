/**
 * Panel body: header, worktree list, and the empty/loading/error states. Dialogs
 * are owned by the routing component in `entry.ts`; this file renders rows.
 */
import { type ReactElement } from 'react';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots';
import type { WorktrunkConnection } from '../connection.js';
import { type PanelStore } from '../store.js';
export interface WorktreePanelProps {
    readonly store: PanelStore;
    readonly connection: WorktrunkConnection;
    readonly t: Translate;
    readonly currentSessionCwd?: string;
    readonly sessionLabel?: (sessionId: SessionId) => string;
    readonly openSession: (sessionId: SessionId) => void;
    readonly onCreate: () => void;
    readonly onMerge?: (row: unknown) => void;
    readonly onRemove?: (row: unknown) => void;
    readonly onNewSession?: (row: unknown) => void;
    readonly onSyncIgnored?: (row: unknown) => void;
}
/** Panel body. */
export declare function WorktreePanel(props: WorktreePanelProps): ReactElement;
