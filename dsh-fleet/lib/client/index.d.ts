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
 * by React lifecycle. The dsh web GUI requires browser auth, so switching
 * nodes navigates with the peer's launch token (?token=) — delivered over
 * the mesh inside the hello frame — and the home row uses status.home_url.
 *
 * Failure policy: warn only, never break the GUI.
 */
export declare function apply(ctx: unknown): void;
export declare const inject: string[];
