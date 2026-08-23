import type { Context } from '@deepseek-ai/cordis';
import type { CommandDefinition } from '@deepseek-ai/dsh-commands';
import type { SkillRegistration } from '@deepseek-ai/dsh-skill';
export declare const name = "dsh-cavekit";
export declare const inject: string[];
/** Parse a SKILL.md frontmatter block (`name`, `description`) and return the body. */
export declare function parseSkill(file: string): Pick<SkillRegistration, 'name' | 'description' | 'content'>;
/** Parse a prompt template: command name from the filename (`ck:spec` → `ck-spec`), description, input hint, body. */
export declare function parsePrompt(file: string): Pick<CommandDefinition, 'name' | 'description' | 'input'> & {
    readonly content: string;
};
export declare function apply(ctx: Context): void;
