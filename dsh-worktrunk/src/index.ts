/**
 * dsh-worktrunk — worktrunk (`wt`) git worktrees for DeepSeek Harness.
 *
 * What this plugin gives a DSH profile:
 *
 * 1. Agent tools `worktrunk_create`, `worktrunk_list`, `worktrunk_merge`,
 *    `worktrunk_remove`, `worktrunk_copy_ignored` — create/inspect/merge/
 *    delete worktrunk-managed worktrees and sync gitignored files (secrets,
 *    local config) between the main checkout and a worktree.
 * 2. A human `/wt` command (`create | list | open | merge | remove | copy-ignored`).
 * 3. Workspace registration: created/opened worktrees are registered in
 *    `ctx.workspaceRegistry` so a new session can start inside the worktree,
 *    which places it inside that session's workspace-write sandbox.
 * 4. Session context: when a session runs inside a registered worktree, the
 *    agent is told so once per session.
 *
 * Setup steps (mise install, env generation, copying gitignored files) are
 * worktrunk's job, declared per-repository in `wt.toml` (`pre-start` /
 * `post-start` hooks) — see the README. This plugin only drives the CLI.
 *
 * Requires the `wt` binary on the host (`brew install worktrunk`).
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Context } from '@deepseek-ai/cordis'
import type { CommandDefinition } from '@deepseek-ai/dsh-commands'
import { copyIgnoredArgs, createArgs, isWithin, listWorktrees, mergeArgs, removeArgs, runWtOk, WtError, type WtContext, type WtEntry } from './wt.js'

export const name = 'dsh-worktrunk'
export const inject = ['tools', 'commands', 'subprocess']

/** Row config `dsh-worktrunk` patch entry. */
export interface Config {
	/** `wt` binary name or absolute path. Default `wt`. */
	readonly bin?: string
	/** Label prefix used when registering a worktree as a DSH workspace. Default `[wt]`. */
	readonly labelPrefix?: string
}

interface ResolvedConfig {
	bin: string
	labelPrefix: string
}

/** Resolve the working directory a tool/command call operates from. */
function sessionCwd(agent: unknown): string {
	const header = (agent as { session?: { header?: { cwd?: string } } } | undefined)?.session?.header
	return header?.cwd ?? process.cwd()
}

/** The workspace-registry service, when the profile provides one. */
interface WorkspaceRegistry {
	create(path: string, label: string): Promise<unknown>
	resolveByPath(path: string): Promise<{ id: string } | undefined>
	delete(id: string): Promise<unknown>
}

function registry(ctx: Context): WorkspaceRegistry | undefined {
	return (ctx as unknown as { get(service: string): unknown }).get('workspaceRegistry') as WorkspaceRegistry | undefined
}

/** One list row as rendered — WtEntry satisfies this; tool output is slimmer. */
interface ListRow {
	branch: string
	path: string
	isMain: boolean
	isCurrent: boolean
	headSha?: string | null
	headShortSha?: string | null
	headSubject?: string | null
}

/** Render one list row. */
function renderEntry(entry: ListRow): string {
	const head = entry.headShortSha ? (entry.headSubject ? `${entry.headShortSha} ${entry.headSubject}` : entry.headShortSha) : '?'
	const tags = [entry.isMain ? 'main' : null, entry.isCurrent ? 'current' : null].filter(Boolean).join(',')
	return `  ${entry.branch}  →  ${entry.path}  [${head}${tags === '' ? '' : ` | ${tags}`}]`
}

/** Shared list renderer (tool output + command text). */
function renderList(repoCwd: string, entries: ListRow[]): string {
	if (entries.length === 0) return `No worktrunk worktrees for the repository of ${repoCwd}.\nCreate one with worktrunk_create or /wt create <branch>.`
	const lines = ['Worktrunk worktrees:', ...entries.map(renderEntry)]
	return lines.join('\n')
}

/** Look up one branch's entry in the repository of `cwd`. */
async function findBranch(ctx: WtContext, config: ResolvedConfig, cwd: string, branch: string, signal?: AbortSignal): Promise<WtEntry | undefined> {
	const entries = await listWorktrees(ctx, config.bin, cwd, signal)
	return entries.find(entry => entry.branch === branch)
}

/** Append to merge failures: how to back a half-finished merge out. */
const MERGE_RECOVERY_HINT = 'If a merge was left in progress, resolve the conflicts and run `git merge --continue`, or run `git merge --abort` in the affected worktree to back out.'

/** Refuse an operation that would delete the worktree this session runs inside. */
export function assertNotSessionWorktree(entry: WtEntry | undefined, cwd: string, action: string): void {
	if (entry !== undefined && isWithin(entry.path, cwd)) {
		throw new WtError('SESSION_WORKTREE', `Refusing to ${action} the worktree at ${entry.path}: this session is running inside it. Start a session elsewhere first.`)
	}
}

/**
 * Register (or refresh) the worktree's DSH workspace registration. Best
 * effort: a registry failure never fails the underlying wt operation.
 */
async function registerWorkspace(ctx: Context, path: string, branch: string, config: ResolvedConfig): Promise<string | undefined> {
	const reg = registry(ctx)
	if (reg === undefined) return undefined
	try {
		const existing = await reg.resolveByPath(path)
		if (existing === undefined) await reg.create(path, `${config.labelPrefix} ${branch}`)
		return undefined
	} catch (error) {
		return `workspace registration skipped: ${(error as Error).message}`
	}
}

/** Best-effort removal of a worktree's workspace registration. */
async function unregisterWorkspace(ctx: Context, path: string): Promise<void> {
	const reg = registry(ctx)
	if (reg === undefined) return
	try {
		const workspace = await reg.resolveByPath(path)
		if (workspace !== undefined) await reg.delete(workspace.id)
	} catch {
		// Stale registration is harmless; the worktree itself is already gone.
	}
}

/** Register the four model-facing worktrunk tools. */
function registerTools(ctx: Context, config: ResolvedConfig): void {
	ctx.tools.register(defineTool({
		name: 'worktrunk_create',
		description: 'Create a new git branch and worktree with worktrunk (`wt switch --create`). The worktree lives OUTSIDE the repository (sibling directory by default); its `pre-start`/`post-start` hooks from the repo\'s wt.toml run on creation (dependency install, env generation, copying gitignored files). The worktree is registered as a DSH workspace — start a new session inside it to work there.',
		parameters: {
			branch: { type: 'string', required: true, description: 'Name of the branch to create.' },
			base: { type: 'string', description: 'Base ref to branch from (default: the repository default branch; `@` = the currently checked-out branch/worktree).' },
			hooks: { type: 'boolean', description: 'Run wt.toml start hooks (default true). Pass false to skip setup steps.' },
		},
		output: {
			schema: {
				type: 'object',
				additionalProperties: false,
				properties: {
					branch: { type: 'string', required: true },
					path: { type: 'string', required: true },
					registrationWarning: { type: 'string' },
				},
			},
			render: (_args, value) => [{
				type: 'text',
				text: [
					`Created branch ${JSON.stringify(value.branch)} with worktree at ${value.path}`,
					`  start hooks: ${value.registrationWarning === undefined ? 'ran (wt.toml pre-start/post-start)' : 'state unknown'}`,
					`  tip: start a new session with this workspace to work inside it.`,
					...(value.registrationWarning !== undefined ? [`  note: ${value.registrationWarning}`] : []),
				].join('\n'),
			}],
		},
		async execute(args, exec) {
			const cwd = sessionCwd(exec.agent)
			await runWtOk(ctx as unknown as WtContext, createArgs(config.bin, { branch: args.branch, base: args.base, hooks: args.hooks }), cwd, exec.signal)
			const entry = await findBranch(ctx as unknown as WtContext, config, cwd, args.branch, exec.signal)
			const path = entry?.path
			if (path === undefined) throw new WtError('NOT_FOUND', `worktree for ${JSON.stringify(args.branch)} not found after creation — check \`worktrunk_list\`.`)
			const warning = await registerWorkspace(ctx, path, args.branch, config)
			return { branch: args.branch, path, ...(warning !== undefined ? { registrationWarning: warning } : {}) }
		},
		presentCall: args => ({ card: 'generic', title: 'Create worktrunk worktree', kind: 'other', rawInput: args }),
	}))

	ctx.tools.register(defineTool({
		name: 'worktrunk_list',
		description: 'List worktrunk-managed git worktrees of the repository containing the current session, with paths, HEAD, and main/current flags.',
		parameters: {},
		output: {
			schema: {
				type: 'object',
				additionalProperties: false,
				properties: {
					entries: {
						type: 'array',
						required: true,
						items: {
							type: 'object',
							additionalProperties: false,
							properties: {
								branch: { type: 'string', required: true },
								path: { type: 'string', required: true },
								isMain: { type: 'boolean', required: true },
								isCurrent: { type: 'boolean', required: true },
								headSha: { type: 'string' },
								headSubject: { type: 'string' },
							},
						},
					},
				},
			},
			render: (_args, value) => [{ type: 'text', text: renderList('(session)', value.entries) }],
		},
		async execute(_args, exec) {
			const cwd = sessionCwd(exec.agent)
			const entries = await listWorktrees(ctx as unknown as WtContext, config.bin, cwd, exec.signal)
			return {
				entries: entries.map(entry => ({
					branch: entry.branch,
					path: entry.path,
					isMain: entry.isMain,
					isCurrent: entry.isCurrent,
					...(entry.headSha !== null ? { headSha: entry.headSha } : {}),
					...(entry.headSubject !== null ? { headSubject: entry.headSubject } : {}),
				})),
			}
		},
		presentCall: () => ({ card: 'generic', title: 'List worktrunk worktrees', kind: 'other', rawInput: {} }),
	}))

	ctx.tools.register(defineTool({
		name: 'worktrunk_remove',
		description: 'Remove a worktrunk worktree (and by default its branch, when fully merged) in the foreground. Refuses the worktree the current session runs inside; refuses dirty worktrees unless force is set; deleting an UNMERGED branch additionally needs forceDeleteBranch.',
		parameters: {
			branch: { type: 'string', required: true, description: 'Branch whose worktree should be removed.' },
			force: { type: 'boolean', description: 'Remove even with uncommitted changes (default false).' },
			forceDeleteBranch: { type: 'boolean', description: 'Delete the branch even when not fully merged (`--force-delete`/`-D`). Default false.' },
			keepBranch: { type: 'boolean', description: 'Keep the branch, remove only the worktree (default false).' },
		},
		output: {
			schema: {
				type: 'object',
				additionalProperties: false,
				properties: {
					branch: { type: 'string', required: true },
					removed: { type: 'boolean', required: true },
				},
			},
			render: (_args, value) => [{ type: 'text', text: `Removed worktree for ${JSON.stringify(value.branch)}.` }],
		},
		async execute(args, exec) {
			const cwd = sessionCwd(exec.agent)
			const entry = await findBranch(ctx as unknown as WtContext, config, cwd, args.branch, exec.signal)
			assertNotSessionWorktree(entry, cwd, 'remove')
			await runWtOk(ctx as unknown as WtContext, removeArgs(config.bin, { branch: args.branch, force: args.force, forceDeleteBranch: args.forceDeleteBranch, keepBranch: args.keepBranch }), cwd, exec.signal)
			if (entry !== undefined) await unregisterWorkspace(ctx, entry.path)
			return { branch: args.branch, removed: true }
		},
		presentCall: args => ({ card: 'generic', title: 'Remove worktrunk worktree', kind: 'other', rawInput: args }),
	}))

	ctx.tools.register(defineTool({
		name: 'worktrunk_merge',
		description: 'Merge a worktree\'s branch into a target branch (default: the repository default branch) with worktrunk: squash & rebase, fast-forward, then remove the worktree. Run its wt.toml pre-merge hooks as part of the merge. Refuses when the target worktree contains the current session.',
		parameters: {
			branch: { type: 'string', required: true, description: 'Branch whose worktree should be merged. Its worktree is the working directory for the merge.' },
			target: { type: 'string', description: 'Branch to merge into (default: the repository default branch).' },
			keepCommit: { type: 'boolean', description: 'Skip squashing — preserve the branch\'s commit history (`--no-squash`). Default false.' },
			keepWorktree: { type: 'boolean', description: 'Keep the worktree after merging (`--no-remove`). Default false; required when this session runs inside the worktree.' },
		},
		output: {
			schema: {
				type: 'object',
				additionalProperties: false,
				properties: {
					branch: { type: 'string', required: true },
					merged: { type: 'boolean', required: true },
				},
			},
			render: (_args, value) => [{ type: 'text', text: `Merged ${JSON.stringify(value.branch)}.` }],
		},
		async execute(args, exec) {
			const cwd = sessionCwd(exec.agent)
			const entry = await findBranch(ctx as unknown as WtContext, config, cwd, args.branch, exec.signal)
			if (entry === undefined) throw new WtError('NOT_FOUND', `no worktree for branch ${JSON.stringify(args.branch)} — check \`worktrunk_list\`.`)
			if (args.keepWorktree !== true) assertNotSessionWorktree(entry, cwd, 'merge (it removes the worktree)')
			try {
				await runWtOk(ctx as unknown as WtContext, mergeArgs(config.bin, { target: args.target, keepCommit: args.keepCommit, keepWorktree: args.keepWorktree }), entry.path, exec.signal)
			} catch (error) {
				if (error instanceof WtError && error.code === 'WT_FAILED') {
					throw new WtError(error.code, `${error.message}\n${MERGE_RECOVERY_HINT}`)
				}
				throw error
			}
			if (args.keepWorktree !== true) await unregisterWorkspace(ctx, entry.path)
			return { branch: args.branch, merged: true }
		},
		presentCall: args => ({ card: 'generic', title: 'Merge worktrunk worktree', kind: 'other', rawInput: args }),
	}))

	ctx.tools.register(defineTool({
		name: 'worktrunk_copy_ignored',
		description: 'Copy gitignored files (secrets, local config, caches) between worktrees with `wt step copy-ignored`. Existing files in the destination are skipped unless force is set; safe to re-run.',
		parameters: {
			force: { type: 'boolean', description: 'Overwrite existing destination files (default false).' },
			requireInclude: { type: 'boolean', description: 'Only copy files listed in .worktreeinclude (default false = copy all gitignored files).' },
		},
		output: {
			schema: {
				type: 'object',
				additionalProperties: false,
				properties: { ok: { type: 'boolean', required: true } },
			},
			render: (_args, value) => [{ type: 'text', text: value.ok ? 'copy-ignored finished (see wt output for the file list).' : 'copy-ignored failed.' }],
		},
		async execute(args, exec) {
			const cwd = sessionCwd(exec.agent)
			await runWtOk(ctx as unknown as WtContext, copyIgnoredArgs(config.bin, { force: args.force, requireInclude: args.requireInclude }), cwd, exec.signal)
			return { ok: true }
		},
		presentCall: args => ({ card: 'generic', title: 'Copy gitignored files', kind: 'other', rawInput: args }),
	}))
}

/** Parse `/wt ...` into a typed request; errors carry usage help. */
export function parseCommand(rawInput: string): { kind: string, branch?: string, base?: string, target?: string, force?: boolean, keepCommit?: boolean, keepWorktree?: boolean } {
	const tokens = rawInput.trim().split(/\s+/u).filter(Boolean)
	const usage = 'Usage: /wt create <branch> [<base>] | /wt list | /wt open <branch> | /wt merge <branch> [<target>] [--keep-commit] [--keep-worktree] | /wt remove <branch> [--force] | /wt copy-ignored'
	if (tokens.length === 0) return { kind: 'list' }
	const [verb, ...rest] = tokens
	const force = rest.includes('--force')
	const keepCommit = rest.includes('--keep-commit')
	const keepWorktree = rest.includes('--keep-worktree')
	const positional = rest.filter(token => !token.startsWith('--'))
	switch (verb) {
		case 'list':
		case 'ls':
			return { kind: 'list' }
		case 'create':
			if (positional.length < 1 || positional.length > 2) return { kind: 'usage' }
			return { kind: 'create', branch: positional[0], base: positional[1] }
		case 'merge':
			if (positional.length < 1 || positional.length > 2) return { kind: 'usage' }
			return { kind: 'merge', branch: positional[0], target: positional[1], keepCommit, keepWorktree }
		case 'open':
		case 'remove':
		case 'close':
		case 'delete':
			if (positional.length !== 1) return { kind: 'usage' }
			return { kind: verb === 'open' ? 'open' : 'remove', branch: positional[0], force }
		case 'copy-ignored':
		case 'sync':
			return { kind: 'copy-ignored' }
		default:
			return { kind: 'unknown', branch: verb }
	}
}

/** Execute one parsed `/wt` request. Returns user-facing text. */
async function executeWtCommand(ctx: Context, config: ResolvedConfig, invocation: { rawInput: string, agent: unknown, signal?: AbortSignal }): Promise<{ kind: 'success' | 'error', text: string }> {
	const cwd = sessionCwd(invocation.agent)
	try {
		const parsed = parseCommand(invocation.rawInput)
		const usage = 'Usage: /wt create <branch> [<base>] | /wt list | /wt open <branch> | /wt merge <branch> [<target>] [--keep-commit] [--keep-worktree] | /wt remove <branch> [--force] | /wt copy-ignored'
		switch (parsed.kind) {
			case 'usage':
				return { kind: 'error', text: usage }
			case 'unknown':
				return { kind: 'error', text: `Unknown /wt verb ${JSON.stringify(parsed.branch)}.\n${usage}` }
			case 'list': {
				const entries = await listWorktrees(ctx as unknown as WtContext, config.bin, cwd, invocation.signal)
				return { kind: 'success', text: renderList(cwd, entries) }
			}
			case 'create': {
				await runWtOk(ctx as unknown as WtContext, createArgs(config.bin, { branch: parsed.branch!, base: parsed.base }), cwd, invocation.signal)
				const entry = await findBranch(ctx as unknown as WtContext, config, cwd, parsed.branch!, invocation.signal)
				const path = entry?.path ?? '(unknown — run /wt list)'
				const warning = await registerWorkspace(ctx, path, parsed.branch!, config)
				return {
					kind: 'success',
					text: [
						`Created branch ${JSON.stringify(parsed.branch)} with worktree at ${path}`,
						'Start a new session with this workspace to work inside it.',
						...(warning !== undefined ? [`note: ${warning}`] : []),
					].join('\n'),
				}
			}
			case 'open': {
				const entry = await findBranch(ctx as unknown as WtContext, config, cwd, parsed.branch!, invocation.signal)
				if (entry === undefined) return { kind: 'error', text: `no worktree for branch ${JSON.stringify(parsed.branch)} — create it with /wt create.` }
				const warning = await registerWorkspace(ctx, entry.path, entry.branch, config)
				return {
					kind: 'success',
					text: [
						`Worktree ${JSON.stringify(entry.branch)} at ${entry.path}`,
						`  HEAD: ${entry.headShortSha ?? '?'}${entry.headSubject === null ? '' : ` ${entry.headSubject}`}`,
						'Start a new session with this workspace to work inside it.',
						...(warning !== undefined ? [`note: ${warning}`] : []),
					].join('\n'),
				}
			}
			case 'merge': {
				const entry = await findBranch(ctx as unknown as WtContext, config, cwd, parsed.branch!, invocation.signal)
				if (entry === undefined) return { kind: 'error', text: `no worktree for branch ${JSON.stringify(parsed.branch)} — check /wt list.` }
				if (parsed.keepWorktree !== true) assertNotSessionWorktree(entry, cwd, 'merge (it removes the worktree)')
				try {
					await runWtOk(ctx as unknown as WtContext, mergeArgs(config.bin, { target: parsed.target, keepCommit: parsed.keepCommit, keepWorktree: parsed.keepWorktree }), entry.path, invocation.signal)
				} catch (error) {
					if (error instanceof WtError && error.code === 'WT_FAILED') {
						return { kind: 'error', text: `${error.message}\n${MERGE_RECOVERY_HINT}` }
					}
					throw error
				}
				if (parsed.keepWorktree !== true) await unregisterWorkspace(ctx, entry.path)
				return { kind: 'success', text: `Merged ${JSON.stringify(parsed.branch)}${parsed.keepWorktree === true ? ' (worktree kept).' : ' — worktree removed.'}` }
			}
			case 'remove': {
				const entry = await findBranch(ctx as unknown as WtContext, config, cwd, parsed.branch!, invocation.signal)
				assertNotSessionWorktree(entry, cwd, 'remove')
				await runWtOk(ctx as unknown as WtContext, removeArgs(config.bin, { branch: parsed.branch!, force: parsed.force }), cwd, invocation.signal)
				if (entry !== undefined) await unregisterWorkspace(ctx, entry.path)
				return { kind: 'success', text: `Removed worktree for ${JSON.stringify(parsed.branch)}.` }
			}
			case 'copy-ignored': {
				await runWtOk(ctx as unknown as WtContext, copyIgnoredArgs(config.bin, {}), cwd, invocation.signal)
				return { kind: 'success', text: 'copy-ignored finished.' }
			}
			default:
				return { kind: 'error', text: usage }
		}
	} catch (error) {
		if (error instanceof WtError) return { kind: 'error', text: error.message }
		throw error
	}
}

/** Register the human-facing `/wt` command. */
function registerCommand(ctx: Context, config: ResolvedConfig): void {
	const definition: CommandDefinition = {
		name: 'wt',
		description: 'create, list, open, merge, or remove worktrunk git worktrees; sync gitignored files',
		input: { hint: 'create <branch> [<base>] | list | open <branch> | merge <branch> [<target>] [--keep-commit] [--keep-worktree] | remove <branch> [--force] | copy-ignored' },
		handler: invocation => executeWtCommand(ctx, config, invocation),
	}
	ctx.commands.register(definition)
}

/**
 * Announce, once per session, when a session runs inside a worktrunk worktree
 * (not the main checkout), so the agent knows its provenance and the
 * copy-ignored escape hatch.
 */
function registerContextNote(ctx: Context, config: ResolvedConfig): void {
	const lookedUp = new Map<string, WtEntry | null>()
	const announced = new Set<string>()
	ctx.on('agent/pre-step', async ({ agent, signal }, next) => {
		const decision = await next()
		if (decision.kind === 'reject' || signal.aborted) return decision
		const cwd = (agent as { session?: { header?: { cwd?: string } } }).session?.header?.cwd
		if (typeof cwd !== 'string') return decision
		const sessionId = String((agent as { session?: { id?: unknown } }).session?.id ?? '')
		if (!lookedUp.has(sessionId)) {
			try {
				const entries = await listWorktrees(ctx as unknown as WtContext, config.bin, cwd, signal)
				lookedUp.set(sessionId, entries.find(entry => !entry.isMain && isWithin(entry.path, cwd)) ?? null)
			} catch {
				lookedUp.set(sessionId, null)
			}
		}
		const found = lookedUp.get(sessionId) ?? null
		if (found === null || announced.has(sessionId)) return decision
		announced.add(sessionId)
		const text = [
			`You are working inside the worktrunk git worktree for branch ${JSON.stringify(found.branch)} at ${found.path}.`,
			`  HEAD: ${found.headShortSha ?? '?'}${found.headSubject === null ? '' : ` ${found.headSubject}`}`,
			'Start hooks from wt.toml ran at creation; sync gitignored files (secrets, local config) with worktrunk_copy_ignored or /wt copy-ignored.',
		].join('\n')
		return {
			kind: 'enter',
			messages: [...decision.messages, createUserMessage({
				content: [{ type: 'text', text }],
				source: {
					kind: 'plugin',
					plugin: name,
					form: 'snapshot',
					sections: [{ name, text }],
				},
			})],
		}
	}, { prepend: true })
}

/** Mount the plugin: tools, command, and session context note. */
export function apply(ctx: Context, config: Config = {}): void {
	const resolved: ResolvedConfig = {
		bin: config.bin ?? 'wt',
		labelPrefix: config.labelPrefix ?? '[wt]',
	}
	registerTools(ctx, resolved)
	registerCommand(ctx, resolved)
	registerContextNote(ctx, resolved)
}
