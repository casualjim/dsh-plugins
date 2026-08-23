import type { Context } from '@deepseek-ai/cordis';
import type { CommandDefinition } from '@deepseek-ai/dsh-commands';
import type { SkillRegistration } from '@deepseek-ai/dsh-skill';
export declare const name = "dsh-caveman";
export declare const inject: string[];
/**
 * Row config for the `dsh-caveman` patch entry.
 *
 * - `alwaysOn` — inject the core caveman style rule as a `systemPrompt`
 *   section for every session (the dsh analog of upstream's SessionStart
 *   auto-activation hook, which is on by default with `defaultMode: full`).
 *   Default `true`: the section rides through to spawned subagents too, since a
 *   child `persona` is a scoped shadow over the global prompt layer, never a
 *   replacement. Set `false` to mount the skills and commands without
 *   auto-activation; the `caveman` skill still activates on its trigger phrases
 *   and `/caveman` switches mode explicitly.
 * - `defaultMode` — intensity level named in the always-on section and in the
 *   `/caveman` command fallback (`lite`, `full`, `ultra`, `wenyan-lite`,
 *   `wenyan-full`, `wenyan-ultra`). Default `full`.
 * - `provider` — `ctx.subagents` provider the cavecrew personas delegate on.
 *   Default `spawn` (fresh child, no parent context; both host in-process
 *   providers declare the `persona` capability).
 * - `enableCavecrew` — register the three cavecrew delegation tools. Default
 *   `true`.
 */
export interface Config {
    readonly alwaysOn?: boolean;
    readonly defaultMode?: string;
    readonly provider?: string;
    readonly enableCavecrew?: boolean;
}
/** Parse a SKILL.md frontmatter block (`name`, `description`) and return the body. */
export declare function parseSkill(file: string): Pick<SkillRegistration, 'name' | 'description' | 'content'>;
/**
 * Parse a prompt template: command name from the filename, description, input
 * hint, and body. `{{args}}` in the body interpolates the raw command input.
 */
export declare function parsePrompt(file: string): Pick<CommandDefinition, 'name' | 'description' | 'input'> & {
    readonly content: string;
};
/** One cavecrew persona file: model-facing tool name, persona text, and tool allowlist. */
export interface Persona {
    readonly toolName: string;
    readonly description: string;
    readonly persona: string;
    readonly tools: readonly string[];
}
/**
 * Parse a cavecrew persona (`agents/cavecrew-*.md`): frontmatter `name` becomes
 * the delegation tool name (`cavecrew-investigator` → `cavecrew_investigator`),
 * frontmatter `tools` becomes the child's tool allowlist, and the body is the
 * persona text.
 */
export declare function parsePersona(file: string): Persona;
export declare function apply(ctx: Context, config?: Config): void;
