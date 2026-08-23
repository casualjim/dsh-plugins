import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import * as toolSubagent from '@deepseek-ai/dsh-tool-subagent';
export const name = 'dsh-caveman';
export const inject = ['skills', 'commands'];
/** Prompt-section order: style layer directly after the deployment persona (`0`). */
const CAVEMAN_SECTION_ORDER = 1;
/**
 * Package root: this module lives one directory below it — `src/` during
 * tests, `lib/` in the published build — and `skills/`, `prompts/`, and
 * `agents/` ship at the package root beside it.
 */
const root = dirname(dirname(fileURLToPath(import.meta.url)));
function parseFrontmatter(file) {
    const text = readFileSync(file, 'utf8');
    const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
    if (!match)
        throw new Error(`missing frontmatter in ${file}`);
    const meta = {};
    const lines = match[1].split('\n');
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const separator = line.indexOf(':');
        if (separator === -1)
            continue;
        const key = line.slice(0, separator).trim();
        const rawValue = line.slice(separator + 1).trim();
        // Folded (`>`) and literal (`|`) block scalars: consume the indented block.
        if (rawValue === '>' || rawValue === '|' || rawValue === '>-' || rawValue === '|-') {
            const block = [];
            for (let j = i + 1; j < lines.length; j += 1) {
                if (lines[j] === '') {
                    block.push('');
                    i = j;
                    continue;
                }
                if (!/^\s+\S/.test(lines[j]))
                    break;
                block.push(lines[j].trim());
                i = j;
            }
            meta[key] = block.join(rawValue.startsWith('>') ? ' ' : '\n').replace(/\s+/g, ' ').trim();
            continue;
        }
        meta[key] = rawValue.replace(/^['"]|['"]$/g, '').trim();
    }
    const { name, description } = meta;
    if (!description || description === '')
        throw new Error(`missing description in ${file}`);
    // `tools: [read, grep, glob]` — a bare bracket list, one line.
    const toolsMatch = /^\[(.*)\]$/.exec(meta.tools ?? '');
    const tools = toolsMatch === null
        ? undefined
        : toolsMatch[1].split(',').map(entry => entry.trim().replace(/^['"]|['"]$/g, '')).filter(entry => entry !== '');
    return { name, description, hint: meta['argument-hint'], tools, content: text.slice(match[0].length).trim() };
}
/** Parse a SKILL.md frontmatter block (`name`, `description`) and return the body. */
export function parseSkill(file) {
    const { name, description, content } = parseFrontmatter(file);
    if (!name)
        throw new Error(`missing name in ${file}`);
    return { name, description, content };
}
/**
 * Parse a prompt template: command name from the filename, description, input
 * hint, and body. `{{args}}` in the body interpolates the raw command input.
 */
export function parsePrompt(file) {
    const { name, description, hint, content } = parseFrontmatter(file);
    return {
        name: basename(file).replace(/\.md$/, ''),
        description,
        ...(hint ? { input: { hint } } : {}),
        content,
    };
}
/**
 * Parse a cavecrew persona (`agents/cavecrew-*.md`): frontmatter `name` becomes
 * the delegation tool name (`cavecrew-investigator` → `cavecrew_investigator`),
 * frontmatter `tools` becomes the child's tool allowlist, and the body is the
 * persona text.
 */
export function parsePersona(file) {
    const { name, description, tools, content } = parseFrontmatter(file);
    if (!name)
        throw new Error(`missing name in ${file}`);
    if (tools === undefined)
        throw new Error(`missing tools in ${file}`);
    return { toolName: name.replace(/-/g, '_'), description, persona: content, tools };
}
/** Always-on style rule: upstream `skills/caveman/SKILL.md` core, minus skill-machinery wording. */
function alwaysOnSectionText(defaultMode) {
    return [
        'Caveman output mode is ACTIVE EVERY RESPONSE.',
        '',
        'Respond terse like smart caveman. All technical substance stay. Only fluff die.',
        'Drop: articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries, hedging. Fragments OK.',
        'Short synonyms. Technical terms exact. Code blocks unchanged. Errors quoted exact — shortest decisive line.',
        'Never drop not/never/no/only/except. Numbers, units exact.',
        'Never ADD word to sound caveman — if caveman phrasing not shorter than plain phrasing, use plain.',
        'Preserve user\'s dominant language exactly. Compress the style, not the language.',
        'No self-reference, no announcing the style. Pattern: [thing] [action] [reason]. [next step].',
        '',
        `Current intensity: ${defaultMode} (/caveman <level> switches; "stop caveman" ends it).`,
        'Drop caveman for security warnings, irreversible-action confirmations, and any fragment order that risks misread; resume after.',
    ].join('\n');
}
export function apply(ctx, config = {}) {
    const defaultMode = config.defaultMode ?? 'full';
    // Skills: each directory under skills/ registers its SKILL.md.
    const skillsDir = join(root, 'skills');
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
        if (!entry.isDirectory())
            continue;
        const file = join(skillsDir, entry.name, 'SKILL.md');
        ctx.skills.register({
            ...parseSkill(file),
            source: 'bundled',
            resourceBase: { kind: 'directory', path: dirname(file) },
        });
    }
    // Commands: each prompts/*.md becomes a slash command; {{args}} interpolates.
    const promptsDir = join(root, 'prompts');
    for (const entry of readdirSync(promptsDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.md'))
            continue;
        const prompt = parsePrompt(join(promptsDir, entry.name));
        ctx.commands.register({
            name: prompt.name,
            description: prompt.description,
            ...(prompt.input ? { input: prompt.input } : {}),
            handler: ({ agent, rawInput }) => {
                const args = rawInput.trim() === '' ? defaultMode : rawInput.trim();
                agent.followup(createUserMessage({
                    content: [{
                            type: 'text',
                            text: prompt.content.replaceAll('{{args}}', args).replaceAll('{{defaultMode}}', defaultMode),
                        }],
                    source: { kind: 'user' },
                }));
                return { kind: 'success' };
            },
        });
    }
    // Optional always-on style section — analog of upstream's SessionStart hook,
    // on by default. Registered on the shared systemPrompt service, so it reaches
    // the root agent and every spawned subagent (a child's persona shadows the
    // global layer, never replaces it).
    if (config.alwaysOn !== false) {
        const systemPrompt = ctx.get('systemPrompt');
        systemPrompt?.section({
            name: 'caveman:always-on',
            order: CAVEMAN_SECTION_ORDER,
            text: alwaysOnSectionText(defaultMode),
        });
    }
    // Cavecrew personas: one dsh-tool-subagent child fiber per agents/cavecrew-*.md.
    if (config.enableCavecrew !== false) {
        const provider = config.provider ?? 'spawn';
        const agentsDir = join(root, 'agents');
        for (const entry of readdirSync(agentsDir, { withFileTypes: true })) {
            if (!entry.isFile() || !entry.name.startsWith('cavecrew-') || !entry.name.endsWith('.md'))
                continue;
            const persona = parsePersona(join(agentsDir, entry.name));
            ctx.plugin(toolSubagent, {
                provider,
                toolName: persona.toolName,
                persona: persona.persona,
                toolFilter: { allow: [...persona.tools] },
                backgroundMode: 'one-shot',
            });
        }
    }
}
