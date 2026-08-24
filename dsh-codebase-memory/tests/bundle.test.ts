import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
	buildGraphAugmentation,
	DISCOVERY_GATE_NOTICE,
	extractSearchToken,
	formatAugmentation,
	gateToken,
	projectCandidates,
	SESSION_REMINDER,
} from '../src/augment.js'
import { parseSkillFile } from '../src/index.js'
import {
	FULL_MCP_TOOLS,
	MCP_TOOL_NAMESPACE,
	tierPersona,
	tierToolFilter,
	tierToolName,
} from '../src/tier-prompts.js'

const HERE = dirname(fileURLToPath(import.meta.url))

describe('tier personas', () => {
	it('direct personas carry the shared contract and tier role', () => {
		for (const tier of ['scout', 'verify', 'auditor'] as const) {
			const persona = tierPersona(tier, 'direct')
			expect(persona).toContain(`Tier ${['1', '2', '3'][['scout', 'verify', 'auditor'].indexOf(tier)]}`)
			expect(persona).toContain('check_index_coverage')
			expect(persona).toContain('Never edit files or perform state-changing actions')
		}
	})

	it('handoff personas forbid MCP claims', () => {
		for (const tier of ['scout', 'verify', 'auditor'] as const) {
			const persona = tierPersona(tier, 'handoff')
			expect(persona).toContain('handoff')
			expect(persona).not.toContain('Use codebase-memory-mcp in the exact graph project')
		}
	})

	it('tool filters gate MCP tools by tier and access', () => {
		expect(tierToolFilter('scout', 'direct').allow).toContain(`${MCP_TOOL_NAMESPACE}search_graph`)
		expect(tierToolFilter('scout', 'direct').allow).not.toContain(`${MCP_TOOL_NAMESPACE}query_graph`)
		expect(tierToolFilter('auditor', 'direct').allow).toContain(`${MCP_TOOL_NAMESPACE}detect_changes`)
		expect(tierToolFilter('verify', 'handoff').allow.filter(name => name.startsWith('mcp__'))).toEqual([])
		for (const tier of ['scout', 'verify', 'auditor'] as const) {
			expect(tierToolName(tier)).toMatch(/^codebase_memory/)
		}
		expect(FULL_MCP_TOOLS.length).toBeGreaterThan(7)
	})
})

describe('gate tokens', () => {
	it('extracts the longest identifier with a 4-char floor', () => {
		expect(extractSearchToken('function callGraph for user_service')).toBe('user_service')
		expect(extractSearchToken('ab cd')).toBeUndefined()
		expect(extractSearchToken(undefined)).toBeUndefined()
	})

	it('reads pattern/query/file_path args only for raw discovery tools', () => {
		expect(gateToken('grep', { pattern: 'searchGraph\\(' })).toBe('searchGraph')
		expect(gateToken('bash', { command: 'searchGraphHere' })).toBeUndefined()
		expect(gateToken('read', { file_path: '/x/y/AgentLoop.ts' })).toBe('AgentLoop')
	})
})

describe('augmentation', () => {
	it('formats hits as a bounded list', () => {
		const text = formatAugmentation('plugin', [
			{ qualified_name: 'pkg.Plugin', file_path: 'src/plugin.ts' },
			{ name: 'PluginTwo', label: 'class' },
		])
		expect(text).toContain('[codebase-memory] 2 graph symbol(s) match "plugin"')
		expect(text).toContain('- pkg.Plugin  src/plugin.ts')
	})

	it('walks up at most four project candidates', () => {
		expect(projectCandidates('/a/b/c/d/e')).toEqual(['e', 'd', 'c', 'b'])
	})

	it('returns undefined against a missing binary (fail open)', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'cbm-test-'))
		mkdirSync(join(dir, 'proj'), { recursive: true })
		const missing = join(dir, 'no-such-binary')
		const controller = new AbortController()
		const result = await buildGraphAugmentation(missing, join(dir, 'proj'), 'token', 300, controller.signal)
		expect(result).toBeUndefined()
	})

	it('parses real CLI output shape end to end via a stub binary', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'cbm-stub-'))
		mkdirSync(join(dir, 'proj'), { recursive: true })
		const bin = join(dir, 'stub-cbm')
		writeFileSync(bin, `#!/bin/sh\nprintf '%s' '{"results":[{"qualified_name":"a.B","file_path":"b.ts"}]}'\n`, { mode: 0o755 })
		execFileSync('chmod', ['+x', bin])
		const result = await buildGraphAugmentation(bin, join(dir, 'proj'), 'whatever', 2000, undefined)
		expect(result).toContain('1 graph symbol(s)')
	})
})

describe('bundled content', () => {
	it('SKILL.md parses with graph tooling description', () => {
		const skill = parseSkillFile(join(HERE, '../skills/codebase-memory/SKILL.md'))
		expect(skill.name).toBe('codebase-memory')
		expect(skill.description).toContain('graph')
		expect(skill.content).toContain('search_graph')
	})

	it('reminder and gate notice name the dsh mcp surface', () => {
		expect(SESSION_REMINDER).toContain('mcp__codebase-memory-mcp__search_graph')
		expect(DISCOVERY_GATE_NOTICE).toContain('mcp__codebase-memory-mcp__index_repository')
	})

	it('patch inserts the mcp row before the bundle row', () => {
		const patch = readFileSync(join(HERE, '../cordis.patch.yml'), 'utf8')
		const mcpAt = patch.indexOf("name: '@deepseek-ai/dsh-mcp-client'")
		const bundleAt = patch.indexOf('name: dsh-codebase-memory')
		expect(mcpAt).toBeGreaterThan(-1)
		expect(bundleAt).toBeGreaterThan(mcpAt)
		expect(patch).toContain('serverName: codebase-memory-mcp')
	})
})
