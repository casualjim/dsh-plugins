/**
 * The `headroom` settings section value and its wire decoder. Pure, React-free
 * so the node test suite can validate the decode contract.
 */
export const EMPTY_HEADROOM_SECTION = Object.freeze({
    enabled: true,
    baseUrl: null,
    mode: 'normal',
});
const MODES = ['normal', 'quiet', 'silent'];
/**
 * Narrow one wire section. A malformed durable value reads as the empty
 * section so the UI never locks on a rejected shape; the Host schema is the
 * real validator for writes.
 */
export function decodeHeadroomSection(section) {
    if (typeof section !== 'object' || section === null || Array.isArray(section))
        return undefined;
    const value = section;
    const mode = MODES.includes(value.mode)
        ? value.mode
        : EMPTY_HEADROOM_SECTION.mode;
    return {
        enabled: value.enabled !== false,
        baseUrl: typeof value.baseUrl === 'string' && value.baseUrl.trim() !== ''
            ? value.baseUrl.trim()
            : null,
        mode,
    };
}
