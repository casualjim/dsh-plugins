/**
 * The `headroom` settings section value and its wire decoder. Pure, React-free
 * so the node test suite can validate the decode contract.
 */
export type HeadroomModeValue = 'normal' | 'quiet' | 'silent';
/** The settings section as the UI reads it. */
export interface HeadroomSectionValue {
    readonly enabled: boolean;
    /** Proxy URL; `null` = unset (degraded no-op). */
    readonly baseUrl: string | null;
    readonly mode: HeadroomModeValue;
}
export declare const EMPTY_HEADROOM_SECTION: HeadroomSectionValue;
/**
 * Narrow one wire section. A malformed durable value reads as the empty
 * section so the UI never locks on a rejected shape; the Host schema is the
 * real validator for writes.
 */
export declare function decodeHeadroomSection(section: unknown): HeadroomSectionValue | undefined;
