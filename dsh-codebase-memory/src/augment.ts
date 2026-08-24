/**
 * Discovery-gate + augmentation helpers — DSH port of upstream's hook layer
 * (Claude Code shims calling `hook-augment`, and the pi extension's
 * gate/augment pair). Everything fails open: any error means "no context",
 * never a blocked or corrupted tool result.
 */
import { execFile } from 'node:child_process'
import { basename, dirname, resolve } from 'node:path'

/** DSH raw-discovery tools the gate watches (lowercase DSH names). */
export const RAW_DISCOVERY_TOOLS = new Set(['grep', 'glob', 'read'])

/**
 * Session reminder injected at session start and into spawned subagents.
 * Tool names use the dsh mcp-client surface (`mcp__<server>__<tool>`).
 */
export const SESSION_REMINDER = [
	'CRITICAL — Code Discovery Protocol:',
	'1. ALWAYS use codebase-memory MCP tools FIRST for code exploration:',
	`   - ${'mcp__codebase-memory-mcp__search_graph'}(name_pattern/label) to find functions/classes/routes`,
	'   - mcp__codebase-memory-mcp__trace_path(function_name, direction) for call chains',
	'   - mcp__codebase-memory-mcp__get_code_snippet(qualified_name) for exact symbol source',
	'   - mcp__codebase-memory-mcp__query_graph(query) for complex Cypher patterns',
	'   - mcp__codebase-memory-mcp__get_architecture() for project structure',
	'   - mcp__codebase-memory-mcp__search_code(pattern) for graph-augmented text search',
	'2. Use read/grep freely for text, configs, and non-code files; always read files before editing them.',
	'3. If the project is not indexed yet, run mcp__codebase-memory-mcp__index_repository on the project root first.',
].join('\n')

/** Gate guidance attached once after the first raw discovery call. */
export const DISCOVERY_GATE_NOTICE =
	'codebase-memory reminder: for broad code discovery, prefer the codebase-memory MCP tools ' +
	'(search_graph / trace_path / get_code_snippet) before more grep/glob rounds. If the current ' +
	'project is not indexed yet, run mcp__codebase-memory-mcp__index_repository on the project root first.'

/**
 * Longest identifier-like token in a raw discovery argument, min 4 chars.
 * Ported from the pi extension's extractSearchToken.
 */
export function extractSearchToken(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined
	let best = ''
	for (const match of value.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
		if (match[0].length > best.length) best = match[0]
	}
	if (best.length < 4) return undefined
	return best.slice(0, 96)
}

/** Pull the token the gate augments on, from one tool call's arguments. */
export function gateToken(toolName: string, args: unknown): string | undefined {
	if (!RAW_DISCOVERY_TOOLS.has(toolName) || typeof args !== 'object' || args === null) return undefined
	const record = args as Record<string, unknown>
	return extractSearchToken(record.pattern) ?? extractSearchToken(record.query) ?? extractSearchToken(record.file_path)
}

interface SearchGraphResult {
	results?: Array<{ qualified_name?: unknown, name?: unknown, file_path?: unknown, label?: unknown }>
}

function stringProp(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value : undefined
}

export function formatAugmentation(token: string, results: NonNullable<SearchGraphResult['results']>): string {
	const rows = results.slice(0, 5).map((result) => {
		const display = stringProp(result.qualified_name) ?? stringProp(result.name) ?? '<unknown>'
		const file = stringProp(result.file_path)
		const label = stringProp(result.label)
		return `- ${display}${file ? `  ${file}` : ''}${label ? `  ${label}` : ''}`
	})
	return [`[codebase-memory] ${rows.length} graph symbol(s) match "${token}" (structured context; raw search result below unaffected):`, ...rows].join('\n')
}

const NOT_INDEXED = /project .*not found|not indexed|unknown project/i

/**
 * Project candidates to try for one augmentation: the workspace dir name and a
 * bounded walk-up, mirroring the pi extension.
 */
// ponytail: cap of 4 candidates keeps worst-case CLI spawns bounded; widen if deep monorepos miss
export function projectCandidates(cwd: string): string[] {
	const candidates: string[] = []
	let current = resolve(cwd)
	for (let i = 0; i < 4; i++) {
		const name = basename(current)
		if (name && !candidates.includes(name)) candidates.push(name)
		const parent = dirname(current)
		if (parent === current) break
		current = parent
	}
	return candidates
}

async function searchGraphOnce(bin: string, project: string, token: string, budgetMs: number, signal: AbortSignal | undefined): Promise<SearchGraphResult | 'project-error' | undefined> {
	const args = JSON.stringify({ project, name_pattern: `.*${token}.*`, limit: 5 })
	try {
		const stdout = await new Promise<string>((resolvePromise, rejectPromise) => {
			execFile(bin, ['cli', 'search_graph', args], { timeout: budgetMs, maxBuffer: 256 * 1024, signal }, (error, stdout) => {
				if (error) rejectPromise(error)
				else resolvePromise(stdout)
			})
		})
		return parseSearchGraphOutput(stdout.trim())
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		if (NOT_INDEXED.test(message)) return 'project-error'
		return undefined
	}
}

function parseSearchGraphOutput(text: string): SearchGraphResult | undefined {
	const start = text.indexOf('{')
	const end = text.lastIndexOf('}')
	if (start < 0 || end < start) return undefined
	try {
		return JSON.parse(text.slice(start, end + 1)) as SearchGraphResult
	} catch {
		return undefined
	}
}

/**
 * Run one bounded `cli search_graph` augmentation across candidate projects.
 * Returns undefined (silently) when the binary is missing, nothing matches,
 * or the budget expires.
 */
export async function buildGraphAugmentation(bin: string, cwd: string, token: string, budgetMs: number, signal: AbortSignal | undefined): Promise<string | undefined> {
	for (const project of projectCandidates(cwd)) {
		const result = await searchGraphOnce(bin, project, token, budgetMs, signal)
		if (result === 'project-error') continue
		if (!result?.results?.length) return undefined
		return formatAugmentation(token, result.results)
	}
	return undefined
}
