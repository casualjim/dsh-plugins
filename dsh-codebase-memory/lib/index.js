/**
 * dsh-codebase-memory — codebase-memory-mcp knowledge-graph integration for
 * the DeepSeek Harness.
 *
 * Function-level port of upstream's client integrations (the six canonical
 * capabilities in src/cli/agent_clients.h) onto native DSH carriers:
 *
 * | Upstream capability | DSH carrier here                          |
 * |---------------------|-------------------------------------------|
 * | MCP graph access    | @deepseek-ai/dsh-mcp-client row (patch)   |
 * | INSTRUCTIONS        | systemPrompt section (`alwaysOn`)         |
 * | SKILL               | skills/codebase-memory/SKILL.md           |
 * | AGENT ×3 tiers      | tool-subagent child fibers (scout/verify/auditor) |
 * | HOOK ×4 behaviors   | typed events (session-start, post-execute, subagent/start) |
 * | PLUGIN behavior     | this plugin                               |
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import * as toolSubagent from '@deepseek-ai/dsh-tool-subagent';
import { buildGraphAugmentation, DISCOVERY_GATE_NOTICE, gateToken, RAW_DISCOVERY_TOOLS, SESSION_REMINDER, } from './augment.js';
import { tierPersona, tierToolFilter, tierToolName, } from './tier-prompts.js';
export const name = 'dsh-codebase-memory';
export const inject = [];
const SECTION_ORDER = 1;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
function defaultBinPath() {
    return process.env.CBM_BIN_PATH ?? join(homedir(), '.local/bin/codebase-memory-mcp');
}
function reminderMessage() {
    return createUserMessage({
        content: [{ type: 'text', text: SESSION_REMINDER }],
        source: { kind: 'plugin', plugin: name },
    });
}
function textMessage(text) {
    return createUserMessage({
        content: [{ type: 'text', text }],
        source: { kind: 'plugin', plugin: name },
    });
}
/** Parse our bundled SKILL.md frontmatter (name, description) plus body. */
export function parseSkillFile(file) {
    const raw = readFileSync(file, 'utf8');
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
    if (match === null)
        throw new Error(`missing frontmatter in ${file}`);
    const meta = {};
    for (const line of match[1].split('\n')) {
        const separator = line.indexOf(':');
        if (separator === -1)
            continue;
        meta[line.slice(0, separator).trim()] = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    }
    if (!meta.name || !meta.description)
        throw new Error(`missing name/description in ${file}`);
    return { name: meta.name, description: meta.description, content: raw.slice(match[0].length).trim() };
}
const INSTRUCTIONS_SECTION = [
    'Graph-first code discovery is available via codebase-memory MCP tools',
    '(`mcp__codebase-memory-mcp__search_graph`, `_trace_path`, `_get_code_snippet`,',
    '`_query_graph`, `_get_architecture`). Prefer them over repeated grep/glob rounds for',
    'structural questions (callers, call chains, impact, dead code). Delegate deep dives to',
    'the `codebase_memory_scout` / `codebase_memory` / `codebase_memory_auditor` subagents.',
].join('\n');
const TIERS = ['scout', 'verify', 'auditor'];
export function apply(ctx, config = {}) {
    const binPath = config.binPath ?? defaultBinPath();
    const access = config.tierAccess ?? 'direct';
    const budgetMs = config.augmentBudgetMs ?? 300;
    // Skill: skills/codebase-memory/SKILL.md.
    try {
        const skillDir = join(ROOT, 'skills', 'codebase-memory');
        const skill = parseSkillFile(join(skillDir, 'SKILL.md'));
        ctx.skills.register({ ...skill, source: 'bundled', resourceBase: { kind: 'directory', path: skillDir } });
    }
    catch (error) {
        ctx.logger.warn(`${name}: skill registration failed: ${String(error)}`);
    }
    // Instructions section (upstream AGENTS.md line), shared with all agents.
    if (config.alwaysOn !== false) {
        ctx.get('systemPrompt')?.section({ name: `${name}:instructions`, order: SECTION_ORDER, text: INSTRUCTIONS_SECTION });
    }
    // Tier subagents: one tool-subagent child fiber per tier, allow-lists
    // enforced by the tool registry (stronger than upstream frontmatter).
    if (config.enableTiers !== false) {
        for (const tier of TIERS) {
            ctx.plugin(toolSubagent, {
                provider: config.provider ?? 'spawn',
                toolName: tierToolName(tier),
                persona: tierPersona(tier, access),
                toolFilter: tierToolFilter(tier, access),
                backgroundMode: 'one-shot',
            });
        }
    }
    // Session reminder (upstream SessionStart hook): reset the gate per session.
    let advised = false;
    ctx.on('agent/session-start', ({ agent }) => {
        advised = false;
        agent.inject(reminderMessage());
    });
    // SubagentStart analog: hand every spawned subagent the same reminder.
    if (config.enableSubagentReminder !== false) {
        ctx.on('subagent/start', (info) => {
            const child = ctx.get('agents')?.get(info.id);
            child?.inject(reminderMessage());
        });
    }
    // Discovery gate + result augmentation (upstream PreToolUse Grep|Glob gate
    // and PostToolUse Read augment, folded into one post-execute listener).
    // Delegates first like every waterfall citizen, then attaches context.
    if (config.enableAugment !== false) {
        ctx.on('tools/post-execute', async (exec, _result, next) => {
            const downstream = await next();
            if (!RAW_DISCOVERY_TOOLS.has(exec.name))
                return downstream;
            const contexts = [];
            if (!advised) {
                advised = true;
                contexts.push(textMessage(DISCOVERY_GATE_NOTICE));
            }
            const token = gateToken(exec.name, exec.arguments);
            if (token !== undefined && exec.signal.aborted === false) {
                const cwd = exec.agent?.session.header.cwd;
                if (cwd !== undefined) {
                    try {
                        const augmentation = await buildGraphAugmentation(binPath, cwd, token, budgetMs, exec.signal);
                        if (augmentation !== undefined)
                            contexts.push(textMessage(augmentation));
                    }
                    catch {
                        // fail open: augmentation is best-effort by contract
                    }
                }
            }
            if (contexts.length === 0)
                return downstream;
            return { ...downstream, additionalContexts: [...contexts, ...downstream.additionalContexts ?? []] };
        });
    }
}
