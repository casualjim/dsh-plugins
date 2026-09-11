/**
 * worktree-full-access seam.
 *
 * A worktree's `.git` is a file pointing into the main repository's
 * `.git/worktrees/<name>`, so git writes made from a session whose workspace is
 * the worktree touch metadata outside the session directory. The named preset
 * disables filesystem confinement for that one session while keeping approval
 * prompts on; this module decides when that is legitimate and reports honestly
 * when it cannot be verified.
 */
import type { WorktreePermissionStatus } from '../contract.js';
/** The preset this plugin adds to the permission patch row. */
export declare const WORKTREE_FULL_ACCESS_PRESET = "worktree-full-access";
/** One recorded permission event on a session. */
export interface PermissionEventLike {
    readonly type: string;
    readonly data?: unknown;
}
/** The session shape this seam needs: identity plus its recorded events. */
export interface PermissionSessionLike {
    readonly id: string;
    readonly events?: readonly PermissionEventLike[];
    snapshotEvents?(): readonly PermissionEventLike[];
}
/** The subset of DSH's permission-presets service this plugin consumes. */
export interface PermissionPresetService {
    readonly names: readonly string[];
    current(sessionOrEvents: unknown): string;
    resolve(name: string): {
        readonly sandbox: string;
        readonly approval: string;
    };
    set(session: unknown, name: string): void;
}
/** Injected ports; every member is optional because not every profile installs them. */
export interface WorktrunkPermissionPort {
    readonly sessions: {
        get(sessionId: string): unknown;
    };
    readonly permissionPresets?: PermissionPresetService;
}
/** True when the session was full-access and a later event narrowed it. */
export declare function hasFullThenRestriction(events: readonly PermissionEventLike[]): boolean;
/**
 * Decide and, when legitimate, apply full access to one session.
 *
 * `user-restricted` means the user narrowed the session after this plugin
 * elevated it: the restriction is theirs and is preserved. `unavailable` means
 * the capability could not be verified — never a silent downgrade.
 */
export declare function ensureWorktreeFullAccess(port: WorktrunkPermissionPort, sessionId: string): Promise<{
    status: WorktreePermissionStatus;
    preset?: string;
}>;
