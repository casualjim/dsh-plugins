/**
 * Heimdall config loading for DSH: row config (from the `dsh-heimdall` patch
 * entry) deep-merged over a project-level `.pi/heimdall.jsonc` at the session
 * workspace root. Ported from pi-heimdall's heimdall-config.ts.
 *
 * @module dsh-heimdall/config
 */
export interface CommandPolicy {
    name: string;
    blocked: string[];
    message: string;
    /** When true, block matched command only if its shell segment is not bare (has pipe or redirect). Absent → unconditional block. */
    bare?: boolean;
}
export interface Config {
    /** Opt-out guard ids. */
    disabled?: string[];
    /** Repo command policies; also loadable from `.pi/heimdall.jsonc`. */
    commandPolicies?: CommandPolicy[];
    /** Path (relative to the workspace root) of the secret-key manifest. Default `.env.json`. */
    dotenv?: string;
}
export declare const OPT_OUT_GUARD_IDS: readonly ["secret-guard", "command-policy-guard", "env-protect", "kubectl-secret-guard", "sops-secret-guard"];
export interface LoadedConfig {
    config: Config;
    disabled: ReadonlySet<string>;
}
/** pi parity: later levels override earlier values and append arrays. */
export declare function deepMerge(base: Config, overrides: Config): Config;
/**
 * Merge the row config with the project-level config at `workspaceRoot` and
 * fold the `disabled` array into a set for per-call checks.
 */
export declare function loadConfig(workspaceRoot: string | undefined, rowConfig: Config): LoadedConfig;
/** Where the secret-key manifest lives for one workspace root. */
export declare function dotenvPath(workspaceRoot: string | undefined, config: Config): string | undefined;
