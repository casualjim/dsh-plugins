/**
 * dsh-fleet — browser entry.
 *
 * Injects an instance dropdown row directly below the sidebar New Session
 * button (anchor: css-modules class suffix "_newSession"; the DSH client
 * css pattern is [hash]_[local]). Lists this machine + fleet peers from
 * /api/dsh-fleet/status; picking a peer dials a loopback gateway port and
 * navigates the tab there. The plugin runs on every fleet member, so the
 * dropdown is present on remote GUIs too — pick "local" to come back.
 *
 * Failure policy: warn only, never break GUI. If the sidebar anchor never
 * appears (custom shell), stays dormant.
 */
export declare function apply(ctx: unknown): void;
export declare const inject: string[];
