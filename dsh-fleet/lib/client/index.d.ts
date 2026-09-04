/**
 * dsh-fleet — browser entry.
 *
 * Contributes two React cells through the client slot registry (no direct
 * DOM work anywhere — the shell owns rendering):
 *   - "sidebar.footer.action" list cell: fleet instance switcher beside the
 *     Settings seat (wide row in the expanded sidebar, icon in the rail).
 *   - "settings.section" list cell: Fleet settings page (pairing, devices).
 *
 * Status refresh is one fetch every 5s while the sidebar is mounted, bounded
 * by React lifecycle. On a peer gateway origin the page is served through the
 * tunnel, so the self row navigates to the remembered local origin
 * (localStorage "dsh-fleet:home") instead of a peer-relative "/".
 *
 * Failure policy: warn only, never break the GUI.
 */
export declare function apply(ctx: unknown): void;
export declare const inject: string[];
