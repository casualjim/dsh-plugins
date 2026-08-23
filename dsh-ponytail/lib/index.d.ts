import type { Context } from '@deepseek-ai/cordis';
import type { CommandDefinition } from '@deepseek-ai/dsh-commands';
import type { SkillRegistration } from '@deepseek-ai/dsh-skill';
export declare const name = "dsh-ponytail";
export declare const inject: string[];
/**
 * Row config for the `dsh-ponytail` patch entry.
 *
 * - `alwaysOn` — inject the ponytail ruleset as a `systemPrompt` section for
 *   every session and every spawned subagent (the dsh analog of upstream's
 *   SessionStart auto-activation hook plus the SubagentStart propagation hook).
 *   Default `true`, matching upstream ponytail which is active on every session
 *   unless the default mode is `off`. Set `false` to mount the skills and
 *   commands without auto-activation; activate manually with `/ponytail`.
 * - `defaultMode` — intensity level named in the always-on section and used as
 *   the `/ponytail` fallback (`off`, `lite`, `full`, `ultra`). Default `full`.
 *   Falls back to the `PONYTAIL_DEFAULT_MODE` environment variable when the row
 *   config omits it, then `full` — the same resolution order upstream uses.
 */
export interface Config {
    readonly alwaysOn?: boolean;
    readonly defaultMode?: string;
}
/** Valid runtime modes (the `review` mode is a session-only skill, never a default). */
declare const RUNTIME_MODES: readonly ["off", "lite", "full", "ultra"];
type RuntimeMode = (typeof RUNTIME_MODES)[number];
/** Parse a SKILL.md frontmatter block (`name`, `description`) and return the body. */
export declare function parseSkill(file: string): Pick<SkillRegistration, 'name' | 'description' | 'content'>;
/**
 * Parse a prompt template: command name from the filename, description, input
 * hint, and body. `{{args}}` in the body interpolates the raw command input.
 */
export declare function parsePrompt(file: string): Pick<CommandDefinition, 'name' | 'description' | 'input'> & {
    readonly content: string;
};
/** Normalize a mode string to a runtime mode, or `null` when it is not one. */
export declare function normalizeMode(mode: string | undefined): RuntimeMode | null;
/**
 * Resolve the default mode: row `config.defaultMode`, then the
 * `PONYTAIL_DEFAULT_MODE` environment variable, then `full`. Mirrors upstream
 * ponytail's resolution order (env var > config file > full) with the row
 * config taking the config-file slot.
 */
export declare function resolveDefaultMode(config: Config): RuntimeMode;
/**
 * Filter the `ponytail` SKILL.md body to the active intensity level — a direct
 * port of upstream `ponytail-instructions.js#filterSkillBodyForMode`. Only the
 * intensity-table rows and worked examples are mode-specific; every other line
 * (the ladder, the rules, the boundaries) survives verbatim.
 */
export declare function filterSkillBodyForMode(body: string, mode: RuntimeMode): string;
/**
 * Build the always-on ruleset for a mode: the upstream
 * `PONYTAIL MODE ACTIVE — level: <mode>` header followed by the mode-filtered
 * `ponytail` SKILL.md body. Falls back to a compact inline ruleset when the
 * skill file cannot be read, so a damaged install never drops the reminder.
 */
export declare function ponytailRuleset(mode: RuntimeMode): string;
export declare function apply(ctx: Context, config?: Config): void;
export {};
