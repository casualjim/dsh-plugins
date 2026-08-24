import type { Context } from '@deepseek-ai/cordis';
import type { SkillRegistration } from '@deepseek-ai/dsh-skill';
import { type GraphAccess } from './tier-prompts.js';
export declare const name = "dsh-codebase-memory";
export declare const inject: string[];
/** Row config for the `dsh-codebase-memory` patch entry. */
export interface Config {
    /** Path to the CBM binary. Default `~/.local/bin/codebase-memory-mcp`. */
    binPath?: string;
    /** `ctx.subagents` provider the tier children run on. Default `spawn`. */
    provider?: string;
    /** Register the scout/verify/auditor tier subagents. Default `true`. */
    enableTiers?: boolean;
    /**
     * `direct` — tier children call the graph MCP tools themselves.
     * `handoff` — children get no MCP tools; the parent supplies graph evidence
     * and the child cross-checks exact source. Default `direct`.
     */
    tierAccess?: GraphAccess;
    /**
     * Attach a session reminder to spawned subagents (upstream SubagentStart).
     * Default `true`.
     */
    enableSubagentReminder?: boolean;
    /**
     * After grep/glob/read results, attach one graph-hit context message built
     * from a bounded `<bin> cli search_graph` call (upstream PostToolUse
     * augment + discovery gate). Fail-open. Default `true`.
     */
    enableAugment?: boolean;
    /** Per-attempt CLI budget in ms. Default `300` (upstream parity). */
    augmentBudgetMs?: number;
    /** Register the graph-first instructions section. Default `true`. */
    alwaysOn?: boolean;
}
/** Parse our bundled SKILL.md frontmatter (name, description) plus body. */
export declare function parseSkillFile(file: string): Pick<SkillRegistration, 'name' | 'description' | 'content'>;
export declare function apply(ctx: Context, config?: Config): void;
