/**
 * Configuration resolution: cordis row config wins, environment next,
 * defaults last. Ported from noheadroom's `config.ts` with DSH naming.
 */
import { deepFreeze } from '@deepseek-ai/dsh-llm';
export const DEFAULTS = deepFreeze({
    enabled: true,
    baseUrl: null,
    mode: 'normal',
    minContextTokens: 20_000,
    minMessageChars: 2_000,
    timeoutMs: 30_000,
    throttleMs: 3_000,
    allowRemote: false,
    renameToolCalls: true,
    maxSeenFingerprints: 512,
});
const CONFIG_KEYS = new Set([
    'enabled',
    'baseUrl',
    'mode',
    'minContextTokens',
    'minMessageChars',
    'timeoutMs',
    'throttleMs',
    'allowRemote',
    'renameToolCalls',
    'maxSeenFingerprints',
]);
const HEADROOM_MODES = ['normal', 'quiet', 'silent'];
/** Normalize a configured or environment-provided URL; empty → null (degrade). */
export function normalizeBaseUrl(raw) {
    if (raw === null || raw === undefined)
        return null;
    const trimmed = raw.trim().replace(/\/+$/, '');
    return trimmed.length === 0 ? null : trimmed;
}
/** Whether the URL names the loopback host. */
export function isLocalHeadroomUrl(rawUrl) {
    try {
        const url = new URL(rawUrl);
        return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
    }
    catch {
        return false;
    }
}
/** Remote URLs are refused unless the user explicitly allowed them. */
export function isRemoteBlocked(config) {
    return config.baseUrl !== null
        && !config.allowRemote
        && !isLocalHeadroomUrl(config.baseUrl);
}
function parseBoolean(raw, fallback) {
    if (raw === undefined)
        return fallback;
    if (typeof raw === 'boolean')
        return raw;
    if (typeof raw !== 'string')
        return fallback;
    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized))
        return true;
    if (['0', 'false', 'no', 'off'].includes(normalized))
        return false;
    return fallback;
}
function parseInteger(raw, fallback, min) {
    if (raw === undefined)
        return fallback;
    const parsed = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN;
    if (!Number.isFinite(parsed) || parsed < min)
        return fallback;
    return Math.trunc(parsed);
}
function parseMode(raw, envRaw, fallback) {
    const normalize = (value) => {
        if (typeof value !== 'string')
            return null;
        const trimmed = value.trim().toLowerCase();
        return HEADROOM_MODES.includes(trimmed) ? trimmed : null;
    };
    return normalize(raw) ?? normalize(envRaw) ?? fallback;
}
/**
 * Resolve and validate the merged configuration. The cordis row `config`
 * wins over environment, environment over defaults. `baseUrl` resolves to
 * `null` when neither names a proxy — the degraded mode, never a hard error.
 */
export function resolveConfig(config = {}, env = process.env) {
    for (const key of Object.keys(config)) {
        if (!CONFIG_KEYS.has(key)) {
            throw new Error(`HeadroomConfig: unknown key "${key}" `
                + `(allowed: ${[...CONFIG_KEYS].join(', ')})`);
        }
    }
    const envBaseUrl = normalizeBaseUrl(env.DSH_HEADROOM_URL ?? env.HEADROOM_URL ?? env.HEADROOM_BASE_URL);
    const baseUrl = normalizeBaseUrl(config.baseUrl === undefined ? envBaseUrl : config.baseUrl);
    const resolved = {
        enabled: parseBoolean(config.enabled, parseBoolean(env.DSH_HEADROOM_ENABLED, DEFAULTS.enabled)),
        baseUrl,
        mode: parseMode(config.mode, env.DSH_HEADROOM_MODE, DEFAULTS.mode),
        minContextTokens: parseInteger(config.minContextTokens, parseInteger(env.DSH_HEADROOM_MIN_CONTEXT_TOKENS, DEFAULTS.minContextTokens, 0), 0),
        minMessageChars: parseInteger(config.minMessageChars, parseInteger(env.DSH_HEADROOM_MIN_MESSAGE_CHARS, DEFAULTS.minMessageChars, 1), 1),
        timeoutMs: parseInteger(config.timeoutMs, parseInteger(env.DSH_HEADROOM_TIMEOUT_MS, DEFAULTS.timeoutMs, 100), 100),
        throttleMs: parseInteger(config.throttleMs, parseInteger(env.DSH_HEADROOM_THROTTLE_MS, DEFAULTS.throttleMs, 0), 0),
        allowRemote: parseBoolean(config.allowRemote, parseBoolean(env.DSH_HEADROOM_ALLOW_REMOTE, DEFAULTS.allowRemote)),
        renameToolCalls: parseBoolean(config.renameToolCalls, parseBoolean(env.DSH_HEADROOM_RENAME_TOOL_CALLS, DEFAULTS.renameToolCalls)),
        maxSeenFingerprints: parseInteger(config.maxSeenFingerprints, parseInteger(env.DSH_HEADROOM_MAX_SEEN_FINGERPRINTS, DEFAULTS.maxSeenFingerprints, 16), 16),
    };
    return deepFreeze(structuredClone(resolved));
}
