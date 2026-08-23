import type { Context } from '@deepseek-ai/cordis';
import type { SkillRegistration } from '@deepseek-ai/dsh-skill';
export declare const name = "dsh-pstack";
export declare const inject: string[];
/**
 * Row config for the `dsh-pstack` patch entry.
 *
 * - `provider` — `ctx.subagents` provider the bundled agent personas
 *   (`poteto-agent`, `comment-sicko`) delegate on. Default `spawn` (fresh
 *   child, no parent context).
 * - `enableAgents` — register the two bundled agent personas as subagent
 *   tools (`poteto_agent`, `comment_sicko`). Default `true`.
 * - `enablePotetoSection` — register the sticky Poteto Mode system-prompt
 *   section, toggled by the `/poteto-mode` command. Default `true`.
 */
export interface Config {
    readonly provider?: string;
    readonly enableAgents?: boolean;
    readonly enablePotetoSection?: boolean;
}
/** Parse a SKILL.md frontmatter block (`name`, `description`) and return the body. */
export declare function parseSkill(file: string): Pick<SkillRegistration, 'name' | 'description' | 'content'>;
/** One bundled agent persona file: model-facing tool name, description, persona text, tool allowlist. */
export interface Persona {
    readonly toolName: string;
    readonly description: string;
    readonly persona: string;
    readonly tools?: readonly string[];
}
/**
 * Parse a bundled agent persona (`agents/*.md`): frontmatter `name` becomes
 * the delegation tool name (`poteto-agent` → `poteto_agent`), frontmatter
 * `tools` (when present) becomes the child's tool allowlist, and the body is
 * the persona text.
 */
export declare function parsePersona(file: string): Persona;
export declare function apply(ctx: Context, config?: Config): void;
