import type { Context as ClientContext } from '@deepseek-ai/cordis';
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client';
/** Panel identity shared by the sidebar entry and the main-column occupant. */
export declare const WORKTRUNK_PANEL_ID: 'worktrunk';
/** Sidebar row order, after the shipped entries. */
export declare const WORKTRUNK_PANEL_ORDER = 20;
/** The style-tag id the panel's stylesheet is injected under, per the shell's convention. */
export declare const WORKTRUNK_CSS_TAG_ID = "dsh-worktrunk/worktree.css";
/**
 * Inject the panel's stylesheet once. DSH's shell styles are CSS-modules-scoped, so without
 * this every `button`/`ul`/`li` renders as a browser default; the tag id makes a second mount
 * (or a second plugin instance) a no-op. Absent DOM (tests, SSR) is a no-op too.
 */
export declare function injectPanelStyle(): void;
/** One workspace row as the Workspace Controller publishes it (`WorkspaceView`). */
export interface WorktreeWorkspaceRow {
    readonly workspaceId: string;
    readonly sessionIds?: readonly string[];
}
/**
 * The workspace owning the current session, else the first registered one —
 * the same resolution DSH's own workspace browser performs.
 */
export declare function currentWorkspaceIdOf(rows: readonly WorktreeWorkspaceRow[] | undefined, currentSessionId: string | undefined): string | undefined;
/** What a permission outcome means for the session. `undefined` means "claim nothing". */
export declare function describePermissionOutcome(status: string): {
    key: string | undefined;
    openSession: boolean;
};
/** The client faces the confirmation flow drives. */
export interface PermissionConfirmationInput {
    readonly sessions: Pick<ISessions, 'create' | 'open'>;
    readonly ensurePermission: (input: {
        sessionId: string;
    }) => Promise<{
        status: string;
    }>;
    /** The notice key, or `undefined` when the outcome claims full access. */
    readonly notice: (key: string | undefined) => void;
}
/**
 * The confirmation flow, latched: a second trigger while an attempt is in
 * flight joins that attempt instead of creating a second session.
 */
export declare function createPermissionConfirmation(): (input: PermissionConfirmationInput, cwd: string) => Promise<void>;
export declare const name = "dsh-worktrunk-client";
export declare const inject: string[];
/** Register both slots and wire the panel. */
export declare function apply(ctx: ClientContext): void;
