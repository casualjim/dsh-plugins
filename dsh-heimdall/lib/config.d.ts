/**
 * Heimdall config loading for DSH — the one parser and one representation
 * for every heimdall config consumer in this repo.
 *
 * Config resolves from fixed universal locations. Agent-owned legacy paths
 * (`.pi/`, `.omp/`, `.dsh/` heimdall files) are MIGRATED on load — merged,
 * written to the universal location, deleted — and never read as a fallback:
 *
 *   - Row config:  the `dsh-heimdall` patch entry (deployment layer)
 *   - User level:  ~/.config/heimdall/config.jsonc (fallback: config.json)
 *   - Project:     `<workspaceRoot>/.config/heimdall.json` (fallback: .json)
 *
 * The row config is the base; each file layer overrides scalars and appends
 * arrays on top, matching pi-heimdall's merge semantics. Every field of the
 * file schema (guards + `sandbox`) merges by per-field schema rules.
 *
 * `dsh-heimdall-sandbox` imports {@link loadSandboxSections} and
 * {@link mergeSandboxOptions} from here via the `dsh-heimdall/config`
 * subpath — it owns no parser and no merge of its own.
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
export interface SandboxOptions {
    /**
     * Pi-local integration fields. NOT part of the native heimdall-sandbox
     * policy; carried so the universal file round-trips through both harnesses.
     */
    enabled?: boolean;
    binaryPath?: string;
    useDefaultFilesystemDeny?: boolean;
    filesystem?: {
        /** Paths denied for reads AND writes; supports `~` and ordered `!` negations. */
        deny?: string[];
        /** The only writable subtrees; omitted/empty under read-only intent. */
        writable?: string[];
        /** In-sandbox path -> host path mounts; usable under every mode. */
        virtual?: Record<string, string>;
    };
    env?: {
        /** Parent env vars preserved in the child; absent = binary default set. */
        allow?: string[];
        /** Parent env vars removed (blocklist mode); denied env beats allow. */
        deny?: string[];
    };
    /** `host` (default) or `none`; unknown values are the binary's contract. */
    network?: string;
    /** `default` or `none` (`--no-proc`); unknown values are the binary's contract. */
    proc?: string;
    /** Mount the SSH agent socket under Linux isolation. */
    sshAgent?: boolean;
    /** Mount GnuPG agent, keyboxd, and dirmngr sockets under Linux isolation. */
    gpgAgent?: boolean;
    /** Mount age-compatible agent sockets under Linux isolation. */
    ageAgent?: boolean;
}
export interface Config {
    /** Opt-out guard ids. */
    disabled?: string[];
    /** Repo command policies; also loadable from `.config/heimdall.json`. */
    commandPolicies?: CommandPolicy[];
    /** Path (relative to the workspace root) of the secret-key manifest. Default `.env.json`. */
    dotenv?: string;
    /** Native-sandbox policy fragment; consumed by dsh-heimdall-sandbox. */
    sandbox?: SandboxOptions;
}
export declare const OPT_OUT_GUARD_IDS: readonly ['secret-guard', 'command-policy-guard', 'env-protect', 'kubectl-secret-guard', 'sops-secret-guard'];
export interface LoadedConfig {
    config: Config;
    disabled: ReadonlySet<string>;
    /** Problems found during migration (unparseable legacy files kept in place). */
    migrationErrors: string[];
}
/**
 * The `sandbox` section merge with per-field schema rules: string lists
 * append value-deduped (deny order matters — `!` negations), `virtual`
 * mounts merge by key, env lists are nullable, scalars later-wins. Pi-local
 * integration fields (`enabled`, `binaryPath`, `useDefaultFilesystemDeny`)
 * ride along as scalars.
 */
export declare function mergeSandboxOptions(...layers: (SandboxOptions | undefined)[]): SandboxOptions;
/** pi parity: later levels override earlier values and append arrays. */
export declare function deepMerge(base: Config, overrides: Config): Config;
/** Migrate the user-level config; returns the target path when written. */
export declare function migrateUserConfig(configDir?: string, migrationErrors?: string[]): string | undefined;
/** Migrate the workspace config; returns the target path when written. */
export declare function migrateWorkspaceConfig(workspaceRoot: string, migrationErrors?: string[]): string | undefined;
/**
 * Merge the row config with the universal user level
 * (`~/.config/heimdall/config.json(c)`) and the universal workspace file
 * (`<workspaceRoot>/.config/heimdall.json(c)`). Legacy
 * `{.pi,.omp,.dsh}/heimdall.json(c)` files — user and workspace level — are
 * migrated (merged, written, deleted) before the universal levels load; they
 * are never read as a fallback. Fold the `disabled` array into a set for
 * per-call checks.
 */
export declare function loadConfig(workspaceRoot: string | undefined, rowConfig: Config): LoadedConfig;
/** Where the secret-key manifest lives for one workspace root. */
export declare function dotenvPath(workspaceRoot: string | undefined, config: Config): string | undefined;
/** pi parity: the private-path deny corpus shared across harnesses. */
export declare const DEFAULT_PRIVATE_PATHS: readonly string[];
/**
 * The generated-defaults template — byte-identical to pi-heimdall's
 * `defaultConfigText()` so both harnesses regenerate the same bytes and the
 * shared file never flaps. The corpus is owned by the generated file; user
 * config owns overrides.
 */
export declare function defaultConfigText(): string;
/**
 * The `sandbox` layers for consumers that only speak the native-sandbox
 * policy fragment (dsh-heimdall-sandbox): generated defaults (deny corpus),
 * the user level, and the workspace level — all universal locations. Runs
 * the same mandatory migration as {@link loadConfig} first; regenerates
 * `default.jsonc` (the corpus owner) on every load. Strict: a universal
 * file that exists but is unparseable, or carries a non-object `sandbox`
 * section, throws — a silently ignored sandbox grant is a misconfiguration,
 * not a fallback. `useDefaultFilesystemDeny: false` in user/workspace
 * config strips the GENERATED deny list (explicit entries stay).
 */
export declare function loadSandboxSections(workspaceRoot: string | undefined): {
    defaults: SandboxOptions | undefined;
    user: SandboxOptions | undefined;
    workspace: SandboxOptions | undefined;
};
