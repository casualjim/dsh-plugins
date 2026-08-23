/**
 * Configuration resolution: cordis row config wins, environment next,
 * defaults last. Ported from noheadroom's `config.ts` with DSH naming.
 */
import type { HeadroomConfig, ResolvedHeadroomConfig } from './types.js';
export declare const DEFAULTS: ResolvedHeadroomConfig;
/** Normalize a configured or environment-provided URL; empty → null (degrade). */
export declare function normalizeBaseUrl(raw: string | null | undefined): string | null;
/** Whether the URL names the loopback host. */
export declare function isLocalHeadroomUrl(rawUrl: string): boolean;
/** Remote URLs are refused unless the user explicitly allowed them. */
export declare function isRemoteBlocked(config: Pick<ResolvedHeadroomConfig, 'baseUrl' | 'allowRemote'>): boolean;
/**
 * Resolve and validate the merged configuration. The cordis row `config`
 * wins over environment, environment over defaults. `baseUrl` resolves to
 * `null` when neither names a proxy — the degraded mode, never a hard error.
 */
export declare function resolveConfig(config?: HeadroomConfig, env?: NodeJS.ProcessEnv): ResolvedHeadroomConfig;
