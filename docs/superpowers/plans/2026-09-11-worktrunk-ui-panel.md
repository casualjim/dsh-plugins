# dsh-worktrunk UI Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpower-subagent-driven-development (recommended) or superpower-executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native DSH Web UI panel and the `worktree-full-access` permission preset to `dsh-worktrunk`, keeping worktrunk (`wt`) as the only worktree engine and `.config/wt.toml` hooks as the setup mechanism.

**Architecture:** One package, three source planes with one dependency direction: `src/contract.ts` (dependency-free wire vocabulary) ← `src/host/*` (service, sessions index, permission, workspace helpers, Typert remote) and ← `src/client/*` (browser panel registered into `sidebar.panellist` + keyed `main`). All worktree facts and mutations go through `wt` argv executed by the existing `runWt` runner. No sidecar, no state file, no raw git.

**Tech Stack:** TypeScript 7 (NodeNext, standard decorators, `jsx: react-jsx`), React 19, esbuild (client closure bundle), `@deepseek-ai/dsh-typert-protocol` + `dsh-typert-generator` 0.1.5-rc.1, vitest.

**Spec:** `docs/superpowers/specs/2026-09-11-worktrunk-ui-panel-design.md`

> **Spec amendments made while writing this plan** (already applied to the spec, commit them with Task 1): `wt.ts` may gain additive normalization fields and new read functions; the contract's session type is `WorktreeSessionRef { id, cwd }` (host owns membership, client owns presentation); out-of-scope narrowed to *behaviour* changes to the tools and `/wt` verbs.

## Global Constraints

- DSH contract family: `0.1.5-rc.1` for every `@deepseek-ai/*` devDependency and peerDependency.
- `wt v0.77.0` is the only worktree engine. Never call `git` from plugin code.
- Project hook config is `<repo>/.config/wt.toml`. A repository-root `wt.toml` is ignored by v0.77.
- The remote channel is `/api`; endpoints are `worktrunkManager/<method>`; the call shape is `rpc.call('/api', endpoint, { args: { input } }, signal)`.
- Client→host payloads and results are plain JSON. Domain errors are values: host returns `{ ok: false, error: { code, message, details } }` inside `{ ok: true, value: ... }`; a host method rethrows unknown errors so the Gateway reports a transport failure.
- Every host method result is wrapped: `WorktrunkRemoteResult<T> = { ok: true, value: T } | { ok: false, error: WorktrunkFailure }`.
- The five existing tools, every existing `/wt` verb, and the existing session context note keep their current behaviour.
- No new persistent state anywhere in the plugin.
- Locale namespace is `worktrunk`; v1 registers `en` only.
- Test runner: `pnpm test` (vitest) from `dsh-worktrunk/`. Build: `pnpm build`.

## File Structure

| Path | Responsibility |
|---|---|
| `src/contract.ts` | Wire vocabulary: row/session/hook/repo types, status unions, error codes. Imports nothing. |
| `src/wt.ts` | *Modified, additive.* `wt` argv builders, JSON normalization (gains schema-2 facts), `runWt`/`runWtOk`, `WtError`, plus `listWorktreesFull` and `hookSpecs`. |
| `src/host/workspace.ts` | DSH `workspaceRegistry` seam: resolve a workspace, register/refresh, unregister. Moved out of `index.ts`. |
| `src/host/sessions.ts` | Session header index: live `ctx.sessions` + `ctx.sessionPersistence` → `WorktreeSessionRef[]`; match to a worktree by `cwd`. |
| `src/host/permission.ts` | `permissionPresets` seam: decide and apply `worktree-full-access`; the four outcomes. |
| `src/host/service.ts` | `WorktrunkService`: every UI read and mutation, built on `wt.ts` + the three seams. |
| `src/host/remote.ts` | `WorktrunkRemoteService` (Typert namespace `worktrunkManager`) + the JSON/error projection. |
| `src/index.ts` | *Modified.* `apply()` keeps registering tools/command/context note, now importing the workspace helpers and mounting `WorktrunkRemoteService`. |
| `src/client/locale.ts` | `WORKTRUNK_NS`, `en` dictionary, `WorktrunkLocaleKey`, namespace merge. |
| `src/client/connection.ts` | The single `/api` adapter: endpoint table, envelope unwrapping, abort, dispose. |
| `src/client/store.ts` | Panel store: snapshot, selection, per-workspace read generations, late-result guard. |
| `src/client/panel/WorktreePanel.tsx` | Panel body: header, list, empty/loading/error states, dialog routing. |
| `src/client/panel/rows.tsx` | `WorktreeRowView`, session rows, status chips. |
| `src/client/panel/CreateDialog.tsx` | Create form: branch, base, hook preview, skip-hooks toggle. |
| `src/client/panel/RemoveDialog.tsx` | Remove confirmation with dirty/detached/merged facts and force gates. |
| `src/client/panel/MergeDialog.tsx` | Merge form: target, keep-commit, keep-worktree, pre-merge hook preview. |
| `src/client/panel/PermissionDialog.tsx` | Full-access acknowledgement dialog. |
| `src/client/entry.ts` | Client `apply`: locale registration, connection, store, both slot registrations. |
| `src/client/PanelIcon.tsx` | The `sidebar.panellist` glyph. |
| `scripts/generate-typert.mjs` | Emits `lib/typert.host.js` + `lib/typert.remote-client.js` from the host face. |
| `scripts/build-client.mjs` | esbuild closure bundle → `lib/client.js`. |
| `scripts/typert-protocol-meta.d.ts` | Build-only ambient module for the Typert analyzer. |
| `tsconfig.host.json` | Host-face config handed to the Typert analyzer. |
| `cordis.patch.yml` | *Modified.* `permission` preset row + host row config. |
| `package.json` | *Modified.* Exports, `dsh.client`, deps, build/test scripts. |
| `README.md` | *Modified.* `.config/wt.toml`, panel, permission flow. |

---

## Task 1: Contract vocabulary

**Files:**
- Create: `src/contract.ts`
- Test: `tests/contract.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `WorktreeChanges`, `WorktreeHead`, `WorktreeUpstream`, `WorktreeSessionRef`, `WorktreeRow`, `HookSpec`, `RepoFacts`, `PanelSnapshot`, `WorktreePermissionStatus`, `WorktreeErrorCode`, `WORKTREE_ERROR_CODES`, `WorktrunkFailure`, `WorktrunkRemoteResult<T>`, `createWorktrunkFailure`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/contract.test.ts
import { describe, expect, it } from 'vitest'
import {
  WORKTREE_ERROR_CODES,
  createWorktrunkFailure,
  type WorktreeRow,
} from '../src/contract.js'

describe('contract', () => {
  it('exposes the stable error codes without duplicates', () => {
    expect(new Set(WORKTREE_ERROR_CODES).size).toBe(WORKTREE_ERROR_CODES.length)
    expect(WORKTREE_ERROR_CODES).toContain('SESSION_WORKTREE')
    expect(WORKTREE_ERROR_CODES).toContain('PRESET_UNAVAILABLE')
    expect(WORKTREE_ERROR_CODES).toContain('WT_NOT_INSTALLED')
    expect(WORKTREE_ERROR_CODES).toContain('WT_BUSY')
  })

  it('builds a failure whose details are always present', () => {
    const failure = createWorktrunkFailure('WT_FAILED', 'boom')
    expect(failure).toEqual({ code: 'WT_FAILED', message: 'boom', details: {} })
  })

  it('keeps a worktree row JSON-serializable', () => {
    const row: WorktreeRow = {
      path: '/tmp/wt-a',
      branch: 'feature/a',
      isMain: false,
      isCurrent: true,
      detached: false,
      branchMismatch: false,
      duplicateBranch: false,
      head: { sha: 'a'.repeat(40), shortSha: 'aaaaaaa', subject: 'init', committedAt: '2026-09-11T00:00:00Z' },
      changes: { staged: false, modified: false, untracked: false, renamed: false, deleted: false, conflicted: false },
      upstream: null,
      sessions: [{ id: 's1', cwd: '/tmp/wt-a' }],
      registered: false,
    }
    expect(JSON.parse(JSON.stringify(row))).toEqual(row)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/contract.test.ts`
Expected: FAIL — `Failed to resolve import "../src/contract.js"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/contract.ts
/**
 * Wire vocabulary shared by the host service, the Typert remote, and the browser
 * panel. This module imports nothing: it is the one place both planes agree on.
 */

/** Working-tree state flags reported by `wt list --format=json` (schema 2). */
export interface WorktreeChanges {
	readonly staged: boolean
	readonly modified: boolean
	readonly untracked: boolean
	readonly renamed: boolean
	readonly deleted: boolean
	readonly conflicted: boolean
}

/** HEAD facts for one worktree. */
export interface WorktreeHead {
	readonly sha: string
	readonly shortSha: string
	readonly subject: string
	readonly committedAt: string | null
}

/** Upstream tracking facts; `null` when the branch has no upstream. */
export interface WorktreeUpstream {
	readonly remote: string | null
	readonly branch: string | null
	readonly ahead: number
	readonly behind: number
}

/** Host-owned session membership: identity plus the cwd that proves the grouping. */
export interface WorktreeSessionRef {
	readonly id: string
	readonly cwd: string
}

/** One worktree, as the panel renders it. */
export interface WorktreeRow {
	readonly path: string
	readonly branch: string
	readonly isMain: boolean
	readonly isCurrent: boolean
	readonly detached: boolean
	readonly branchMismatch: boolean
	readonly duplicateBranch: boolean
	readonly head: WorktreeHead | null
	readonly changes: WorktreeChanges
	readonly upstream: WorktreeUpstream | null
	readonly sessions: readonly WorktreeSessionRef[]
	/** True when the path is already registered as a DSH workspace. */
	readonly registered: boolean
}

/** One configured hook, as `wt hook show --format=json` reports it. */
export interface HookSpec {
	readonly name: string
	readonly type: string
	readonly template: string
	readonly source: 'project' | 'user'
	readonly needsApproval: boolean
}

/** Repository facts the panel header shows. */
export interface RepoFacts {
	readonly root: string
	readonly defaultBranch: string
	readonly forge: string | null
}

/** One complete panel read. */
export interface PanelSnapshot {
	readonly repo: RepoFacts
	readonly items: readonly WorktreeRow[]
	readonly hooks: readonly HookSpec[]
}

/** Outcome of a full-access request for one session. */
export type WorktreePermissionStatus =
	| 'applied'
	| 'already-full-access'
	| 'user-restricted'
	| 'unavailable'

/** Every stable failure the browser may branch on. */
export type WorktreeErrorCode =
	| 'WT_NOT_INSTALLED'
	| 'NOT_A_REPO'
	| 'NO_INITIAL_COMMIT'
	| 'NO_LOCAL_BRANCH'
	| 'WT_FAILED'
	| 'WT_BAD_JSON'
	| 'WT_BUSY'
	| 'SESSION_WORKTREE'
	| 'PRESET_UNAVAILABLE'
	| 'PERMISSION_UNVERIFIED'
	| 'HOOK_FAILED'
	| 'NOT_FOUND'

export const WORKTREE_ERROR_CODES: readonly WorktreeErrorCode[] = [
	'WT_NOT_INSTALLED',
	'NOT_A_REPO',
	'NO_INITIAL_COMMIT',
	'NO_LOCAL_BRANCH',
	'WT_FAILED',
	'WT_BAD_JSON',
	'WT_BUSY',
	'SESSION_WORKTREE',
	'PRESET_UNAVAILABLE',
	'PERMISSION_UNVERIFIED',
	'HOOK_FAILED',
	'NOT_FOUND',
] as const

/** JSON-safe failure value. */
export interface WorktrunkFailure {
	readonly code: WorktreeErrorCode
	readonly message: string
	readonly details: Readonly<Record<string, unknown>>
}

/** Every remote method resolves to this envelope. */
export type WorktrunkRemoteResult<Value> =
	| { readonly ok: true, readonly value: Value }
	| { readonly ok: false, readonly error: WorktrunkFailure }

/** Build a failure value. */
export function createWorktrunkFailure(
	code: WorktreeErrorCode,
	message: string,
	details: Readonly<Record<string, unknown>> = {},
): WorktrunkFailure {
	return { code, message, details }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/contract.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/contract.ts tests/contract.test.ts docs/superpowers/specs/2026-09-11-worktrunk-ui-panel-design.md
git commit -m "feat(worktrunk): add wire contract vocabulary"
```

---

## Task 2: Schema-2 worktree facts in the `wt` normalizer

**Files:**
- Modify: `src/wt.ts` (`WtEntry`, `normalizeEntry`, `listWorktrees`)
- Test: `tests/wt.test.ts` (append)

**Interfaces:**
- Consumes: `WorktreeChanges`, `WorktreeHead`, `WorktreeUpstream`, `RepoFacts` from `src/contract.ts`.
- Produces: `WtEntry` now carries `detached`, `branchMismatch`, `duplicateBranch`, `head: WorktreeHead | null`, `changes: WorktreeChanges`, `upstream: WorktreeUpstream | null` (the flat `headSha`/`headShortSha`/`headSubject` fields remain for existing consumers); new `listWorktreesFull(ctx, bin, cwd, signal): Promise<{ repo: RepoFacts, entries: WtEntry[] }>`; `listWorktrees` delegates to it.

- [ ] **Step 1: Write the failing test**

```ts
// tests/wt.test.ts (append)
import { listWorktreesFull, type WtEntry } from '../src/wt.js'

const SCHEMA2 = JSON.stringify({
  schema: 2,
  repo: { default_branch: 'main', forge: { url: 'https://github.com/acme/repo' } },
  items: [
    {
      branch: 'main',
      head: { sha: 'a'.repeat(40), short_sha: 'aaaaaaa', subject: 'init', committed_at: '2026-09-11T00:00:00Z' },
      worktree: { path: '/repo', main: true, current: true, detached: false, branch_mismatch: false, duplicate_branch: false,
        changes: { staged: true, modified: false, untracked: true, renamed: false, deleted: false, conflicted: false } },
      upstream: { remote: 'origin', branch: 'main', ahead: 2, behind: 1 },
    },
    {
      branch: 'feature/x',
      head: { sha: 'b'.repeat(40), short_sha: 'bbbbbbb', subject: 'work' },
      worktree: { path: '/wt/x', main: false, current: false, detached: true, branch_mismatch: true, duplicate_branch: false,
        changes: { staged: false, modified: true, untracked: false, renamed: false, deleted: false, conflicted: false } },
    },
  ],
})

describe('schema-2 facts', () => {
  it('normalizes repo facts and dirty/detached/upstream state', async () => {
    const subprocess = fakeSubprocess([{ stdout: SCHEMA2 }])
    const full = await listWorktreesFull({ subprocess } as never, 'wt', '/repo')
    expect(full.repo).toEqual({ root: '/repo', defaultBranch: 'main', forge: 'https://github.com/acme/repo' })
    const main = full.entries[0] as WtEntry
    expect(main.changes).toEqual({ staged: true, modified: false, untracked: true, renamed: false, deleted: false, conflicted: false })
    expect(main.upstream).toEqual({ remote: 'origin', branch: 'main', ahead: 2, behind: 1 })
    expect(main.head).toEqual({ sha: 'a'.repeat(40), shortSha: 'aaaaaaa', subject: 'init', committedAt: '2026-09-11T00:00:00Z' })
    const feature = full.entries[1] as WtEntry
    expect(feature.detached).toBe(true)
    expect(feature.branchMismatch).toBe(true)
    expect(feature.upstream).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/wt.test.ts`
Expected: FAIL — `listWorktreesFull is not a function`, and `main.changes` undefined.

- [ ] **Step 3: Write the implementation**

In `src/wt.ts`, add the type import and the new fields, then extend `normalizeEntry`, then split the list read:

```ts
import type { RepoFacts, WorktreeChanges, WorktreeHead, WorktreeUpstream } from './contract.js'

/** Live facts for one worktree, normalized across `wt list` JSON schemas. */
export interface WtEntry {
	branch: string
	path: string
	isMain: boolean
	isCurrent: boolean
	detached: boolean
	branchMismatch: boolean
	duplicateBranch: boolean
	head: WorktreeHead | null
	changes: WorktreeChanges
	upstream: WorktreeUpstream | null
	headSha: string | null
	headShortSha: string | null
	headSubject: string | null
}

const NO_CHANGES: WorktreeChanges = {
	staged: false, modified: false, untracked: false, renamed: false, deleted: false, conflicted: false,
}

function numberOrZero(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function stringOrNull(value: unknown): string | null {
	return typeof value === 'string' ? value : null
}

function normalizeChanges(worktree: Record<string, unknown>): WorktreeChanges {
	const raw = (worktree.changes ?? {}) as Record<string, unknown>
	return {
		staged: raw.staged === true,
		modified: raw.modified === true,
		untracked: raw.untracked === true,
		renamed: raw.renamed === true,
		deleted: raw.deleted === true,
		conflicted: raw.conflicted === true,
	}
}

function normalizeUpstream(item: Record<string, unknown>): WorktreeUpstream | null {
	const raw = item.upstream
	if (typeof raw !== 'object' || raw === null) return null
	const record = raw as Record<string, unknown>
	return { remote: stringOrNull(record.remote), branch: stringOrNull(record.branch), ahead: numberOrZero(record.ahead), behind: numberOrZero(record.behind) }
}
```

Replace the body of `normalizeEntry` with:

```ts
export function normalizeEntry(item: Record<string, unknown>): WtEntry | null {
	const branch = typeof item.branch === 'string' ? item.branch : null
	if (branch === null) return null
	const worktree = (item.worktree ?? {}) as Record<string, unknown>
	const head = (item.head ?? item.commit ?? {}) as Record<string, unknown>
	const path = typeof worktree.path === 'string' ? worktree.path : typeof item.path === 'string' ? item.path : null
	if (path === null) return null
	const sha = typeof head.sha === 'string' ? head.sha : null
	const shortSha = typeof head.short_sha === 'string' ? head.short_sha : null
	const subject = typeof head.subject === 'string' ? head.subject : null
	return {
		branch,
		path,
		isMain: worktree.main === true || item.main === true,
		isCurrent: worktree.current === true || item.current === true,
		detached: worktree.detached === true,
		branchMismatch: worktree.branch_mismatch === true,
		duplicateBranch: worktree.duplicate_branch === true,
		head: sha === null ? null : { sha, shortSha: shortSha ?? sha.slice(0, 7), subject: subject ?? '', committedAt: stringOrNull(head.committed_at) },
		changes: normalizeChanges(worktree),
		upstream: normalizeUpstream(item),
		headSha: sha,
		headShortSha: shortSha,
		headSubject: subject,
	}
}
```

Add the full read and make the old one delegate:

```ts
/** Read `wt list --format=json` once, returning repo facts and normalized entries. */
export async function listWorktreesFull(ctx: WtContext, bin: string, cwd: string, signal?: AbortSignal): Promise<{ repo: RepoFacts, entries: WtEntry[] }> {
	const outcome = await runWtOk(ctx, [bin, 'list', '--format=json'], cwd, signal)
	let parsed: unknown
	try {
		parsed = JSON.parse(outcome.stdout)
	} catch (error) {
		throw new WtError('WT_BAD_JSON', `\`wt list\` returned invalid JSON: ${(error as Error).message}`)
	}
	const record = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<string, unknown>
	const items = Array.isArray(parsed) ? parsed : Array.isArray(record.items) ? record.items : []
	const repoRaw = (record.repo ?? {}) as Record<string, unknown>
	const forgeRaw = (repoRaw.forge ?? {}) as Record<string, unknown>
	const repo: RepoFacts = {
		root: cwd,
		defaultBranch: typeof repoRaw.default_branch === 'string' ? repoRaw.default_branch : 'main',
		forge: typeof forgeRaw.url === 'string' ? forgeRaw.url : null,
	}
	return {
		repo,
		entries: items.map(item => normalizeEntry(item as Record<string, unknown>)).filter((entry): entry is WtEntry => entry !== null),
	}
}

/** List worktrees of the repository containing `cwd` via `wt list --format=json`. */
export async function listWorktrees(ctx: WtContext, bin: string, cwd: string, signal?: AbortSignal): Promise<WtEntry[]> {
	return (await listWorktreesFull(ctx, bin, cwd, signal)).entries
}
```

Also rename the existing `BAD_JSON` code to `WT_BAD_JSON` in the old parse path (it is deleted above, so the single occurrence is the new one).

Delete the now-unused `NO_CHANGES` constant if `normalizeChanges` does not use it — it does not, so do not add it at all.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/wt.test.ts`
Expected: PASS — the existing `normalizeEntry` tests plus the new schema-2 test.

- [ ] **Step 5: Commit**

```bash
git add src/wt.ts tests/wt.test.ts
git commit -m "feat(worktrunk): normalize schema-2 worktree facts"
```

---

## Task 3: Hook specs and the worktrunk install hint

**Files:**
- Modify: `src/wt.ts` (append)
- Test: `tests/wt.test.ts` (append)

**Interfaces:**
- Consumes: `HookSpec` from `src/contract.ts`; `runWtOk`, `WtContext`, `WtError` from `src/wt.ts`.
- Produces: `normalizeHookSpec(item): HookSpec | null`, `hookSpecs(ctx, bin, cwd, signal?): Promise<HookSpec[]>`, `WORKTRUNK_INSTALL_HINT: string`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/wt.test.ts (append)
import { hookSpecs, normalizeHookSpec } from '../src/wt.js'

const HOOKS_JSON = JSON.stringify([
  { name: 'install', needs_approval: true, source: 'project', template: 'mise install', type: 'pre-start' },
  { name: 'copy', needs_approval: false, source: 'user', template: 'wt step copy-ignored', type: 'post-start' },
  { name: 42, type: 'pre-start' },
])

describe('hook specs', () => {
  it('normalizes a hook record and rejects an unusable one', () => {
    expect(normalizeHookSpec({ name: 'install', needs_approval: true, source: 'project', template: 'mise install', type: 'pre-start' }))
      .toEqual({ name: 'install', needsApproval: true, source: 'project', template: 'mise install', type: 'pre-start' })
    expect(normalizeHookSpec({ name: 42, type: 'pre-start' })).toBeNull()
  })

  it('reads hooks through `wt hook show --format=json` and drops unparsable rows', async () => {
    const subprocess = fakeSubprocess([{ stdout: HOOKS_JSON }])
    const hooks = await hookSpecs({ subprocess } as never, 'wt', '/repo')
    expect(hooks).toHaveLength(2)
    expect(hooks[1]).toEqual({ name: 'copy', needsApproval: false, source: 'user', template: 'wt step copy-ignored', type: 'post-start' })
  })

  it('treats an empty configuration as no hooks', async () => {
    const subprocess = fakeSubprocess([{ stdout: '[]' }])
    await expect(hookSpecs({ subprocess } as never, 'wt', '/repo')).resolves.toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/wt.test.ts`
Expected: FAIL — `hookSpecs is not a function`.

- [ ] **Step 3: Write the implementation**

```ts
// src/wt.ts (append)
import type { HookSpec } from './contract.js'

/** Shown when the `wt` binary cannot be started. */
export const WORKTRUNK_INSTALL_HINT =
	'worktrunk is not installed or not on PATH. Install it with `brew install worktrunk` or `cargo install worktrunk`, then restart DSH.'

/** Normalize one `wt hook show --format=json` row. */
export function normalizeHookSpec(item: Record<string, unknown>): HookSpec | null {
	const name = typeof item.name === 'string' ? item.name : null
	const type = typeof item.type === 'string' ? item.type : null
	const template = typeof item.template === 'string' ? item.template : null
	if (name === null || type === null || template === null) return null
	return {
		name,
		type,
		template,
		source: item.source === 'user' ? 'user' : 'project',
		needsApproval: item.needs_approval === true,
	}
}

/**
 * Read the hooks `wt` would run for this repository. `wt` owns hook discovery, so
 * this is one native call rather than a TOML parse; a missing project config is `[]`.
 */
export async function hookSpecs(ctx: WtContext, bin: string, cwd: string, signal?: AbortSignal): Promise<HookSpec[]> {
	const outcome = await runWtOk(ctx, [bin, 'hook', 'show', '--format=json'], cwd, signal)
	let parsed: unknown
	try {
		parsed = JSON.parse(outcome.stdout)
	} catch (error) {
		throw new WtError('WT_BAD_JSON', `\`wt hook show\` returned invalid JSON: ${(error as Error).message}`)
	}
	if (!Array.isArray(parsed)) return []
	return parsed
		.map(item => normalizeHookSpec(item as Record<string, unknown>))
		.filter((spec): spec is HookSpec => spec !== null)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/wt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/wt.ts tests/wt.test.ts
git commit -m "feat(worktrunk): read hook specs through wt hook show"
```

---

## Task 4: Workspace registration seam

**Files:**
- Create: `src/host/workspace.ts`
- Modify: `src/index.ts` (delete the local `WorkspaceRegistry`/`registry`/`registerWorkspace`/`unregisterWorkspace` definitions; import them)
- Test: `tests/host-workspace.test.ts`

**Interfaces:**
- Consumes: `Context` from `@deepseek-ai/cordis`; `WtError`.
- Produces: `WorkspaceRegistry` (with optional `get`/`list`), `registryOf(ctx)`, `resolveWorkspacePath(ctx, workspaceId): Promise<string | undefined>`, `registerWorkspace(ctx, path, branch, labelPrefix): Promise<string | undefined>`, `unregisterWorkspace(ctx, path): Promise<void>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/host-workspace.test.ts
import { describe, expect, it } from 'vitest'
import { registerWorkspace, resolveWorkspacePath, unregisterWorkspace } from '../src/host/workspace.js'

function fakeCtx(registry: unknown) {
  return { get: (name: string) => (name === 'workspaceRegistry' ? registry : undefined) }
}

describe('workspace seam', () => {
  it('creates a registration once and skips an existing path', async () => {
    const created: Array<{ path: string, label: string }> = []
    const registry = {
      resolveByPath: async () => undefined,
      create: async (path: string, label: string) => { created.push({ path, label }) },
    }
    await expect(registerWorkspace(fakeCtx(registry) as never, '/wt/a', 'feature/a', '[wt]')).resolves.toBeUndefined()
    expect(created).toEqual([{ path: '/wt/a', label: '[wt] feature/a' }])

    const existing = { resolveByPath: async () => ({ id: 'w1' }), create: async () => { throw new Error('must not create') } }
    await expect(registerWorkspace(fakeCtx(existing) as never, '/wt/a', 'feature/a', '[wt]')).resolves.toBeUndefined()
  })

  it('reports a registry failure as a warning instead of throwing', async () => {
    const registry = { resolveByPath: async () => { throw new Error('registry down') }, create: async () => undefined }
    await expect(registerWorkspace(fakeCtx(registry) as never, '/wt/a', 'feature/a', '[wt]'))
      .resolves.toBe('workspace registration skipped: registry down')
  })

  it('resolves a workspace path from get() or list()', async () => {
    expect(await resolveWorkspacePath(fakeCtx({ get: (id: string) => (id === 'w1' ? { id: 'w1', path: '/repo' } : undefined) }) as never, 'w1'))
      .toBe('/repo')
    expect(await resolveWorkspacePath(fakeCtx({ list: () => [{ id: 'w2', path: '/other' }] }) as never, 'w2'))
      .toBe('/other')
    expect(await resolveWorkspacePath(fakeCtx({}) as never, 'w3')).toBeUndefined()
  })

  it('deletes an existing registration and ignores a missing one', async () => {
    const deleted: string[] = []
    const registry = { resolveByPath: async () => ({ id: 'w9' }), delete: async (id: string) => { deleted.push(id) } }
    await unregisterWorkspace(fakeCtx(registry) as never, '/wt/a')
    expect(deleted).toEqual(['w9'])
    await expect(unregisterWorkspace(fakeCtx({ resolveByPath: async () => undefined }) as never, '/wt/a')).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/host-workspace.test.ts`
Expected: FAIL — cannot resolve `../src/host/workspace.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/host/workspace.ts
/**
 * DSH workspaceRegistry seam. The plugin only ever registers worktree paths as
 * workspaces and refreshes/removes the registrations it created; it never reads
 * or writes DSH session data here.
 */
import type { Context } from '@deepseek-ai/cordis'

/** The workspace-registry service, when the profile provides one. */
export interface WorkspaceRegistry {
	get?(id: string): { id: string, path: string } | undefined
	list?(): readonly { id: string, path: string }[]
	create(path: string, label: string): Promise<unknown>
	resolveByPath(path: string): Promise<{ id: string } | undefined>
	delete(id: string): Promise<unknown>
}

/** Read the registry service out of a Cordis context. */
export function registryOf(ctx: Context): WorkspaceRegistry | undefined {
	return (ctx as unknown as { get(service: string): unknown }).get('workspaceRegistry') as WorkspaceRegistry | undefined
}

/** Resolve a workspace id to its path using whichever read face the profile installs. */
export async function resolveWorkspacePath(ctx: Context, workspaceId: string): Promise<string | undefined> {
	const registry = registryOf(ctx)
	if (registry === undefined) return undefined
	const direct = registry.get?.(workspaceId)
	if (direct !== undefined) return direct.path
	return registry.list?.().find(workspace => workspace.id === workspaceId)?.path
}

/**
 * Register (or refresh) the worktree's DSH workspace registration. Best effort:
 * a registry failure returns a warning string and never fails the wt operation.
 */
export async function registerWorkspace(ctx: Context, path: string, branch: string, labelPrefix: string): Promise<string | undefined> {
	const registry = registryOf(ctx)
	if (registry === undefined) return undefined
	try {
		const existing = await registry.resolveByPath(path)
		if (existing === undefined) await registry.create(path, `${labelPrefix} ${branch}`)
		return undefined
	} catch (error) {
		return `workspace registration skipped: ${(error as Error).message}`
	}
}

/** Best-effort removal of a worktree's workspace registration. */
export async function unregisterWorkspace(ctx: Context, path: string): Promise<void> {
	const registry = registryOf(ctx)
	if (registry === undefined) return
	try {
		const workspace = await registry.resolveByPath(path)
		if (workspace !== undefined) await registry.delete(workspace.id)
	} catch {
		// Stale registration is harmless; the worktree itself is already gone.
	}
}
```

Then in `src/index.ts`: delete `WorkspaceRegistry`, `registry`, `registerWorkspace`, `unregisterWorkspace`, import the two functions from `./host/workspace.js`, and replace every call with the four-argument form, for example:

```ts
const warning = await registerWorkspace(ctx, path, args.branch, config.labelPrefix)
```

and

```ts
await unregisterWorkspace(ctx, entry.path)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run`
Expected: PASS — new seam tests plus all pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add src/host/workspace.ts src/index.ts tests/host-workspace.test.ts
git commit -m "refactor(worktrunk): extract the workspace registration seam"
```

---

## Task 5: Session header index

**Files:**
- Create: `src/host/sessions.ts`
- Test: `tests/host-sessions.test.ts`

**Interfaces:**
- Consumes: `WorktreeSessionRef` from `src/contract.ts`.
- Produces: `SessionSources`, `readSessionHeaders(sources): Promise<WorktreeSessionRef[]>`, `sessionsForWorktree(refs, worktreePath): WorktreeSessionRef[]`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/host-sessions.test.ts
import { describe, expect, it } from 'vitest'
import { readSessionHeaders, sessionsForWorktree } from '../src/host/sessions.js'

describe('session header index', () => {
  it('merges live headers with persisted headers, live winning on a shared id', async () => {
    const refs = await readSessionHeaders({
      sessions: { list: () => [{ id: 's1', header: { cwd: '/repo' } }, { id: 's2', header: {} }] },
      sessionPersistence: { list: async () => [{ id: 's1', cwd: '/stale' }, { id: 's3', cwd: '/wt/a' }] },
    })
    expect(refs).toEqual([{ id: 's1', cwd: '/repo' }, { id: 's3', cwd: '/wt/a' }])
  })

  it('returns an empty index without either service, and survives a persistence failure', async () => {
    await expect(readSessionHeaders({})).resolves.toEqual([])
    await expect(readSessionHeaders({ sessionPersistence: { list: async () => { throw new Error('disk') } } })).resolves.toEqual([])
  })

  it('matches sessions by exact worktree path and by a nested cwd', () => {
    const refs = [{ id: 'a', cwd: '/wt/x' }, { id: 'b', cwd: '/wt/x/packages/app' }, { id: 'c', cwd: '/wt/xy' }, { id: 'd', cwd: '/repo' }]
    expect(sessionsForWorktree(refs, '/wt/x').map(ref => ref.id)).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/host-sessions.test.ts`
Expected: FAIL — cannot resolve `../src/host/sessions.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/host/sessions.ts
/**
 * Session membership index. The host reads session *headers* only — never a
 * transcript, message, or event body — and groups a session under a worktree
 * because its cwd says it runs there.
 */
import { isWithin } from '../wt.js'
import type { WorktreeSessionRef } from '../contract.js'

/** The two header sources a DSH host may provide. Both are optional. */
export interface SessionSources {
	sessions?: { list(): readonly { id: string, header?: { cwd?: string } }[] }
	sessionPersistence?: { list(): Promise<readonly { id: string, cwd?: string }[]> }
}

/** Merge live and persisted headers by id; live wins, cwd-less sessions are dropped. */
export async function readSessionHeaders(sources: SessionSources): Promise<WorktreeSessionRef[]> {
	const merged = new Map<string, string>()
	for (const session of sources.sessions?.list() ?? []) {
		const cwd = session.header?.cwd
		if (typeof cwd === 'string' && cwd !== '') merged.set(session.id, cwd)
	}
	try {
		for (const header of await (sources.sessionPersistence?.list() ?? Promise.resolve([]))) {
			if (merged.has(header.id)) continue
			if (typeof header.cwd === 'string' && header.cwd !== '') merged.set(header.id, header.cwd)
		}
	} catch {
		// A persistence failure degrades membership to live sessions only; it never
		// fails the panel read, and it never becomes an empty worktree list.
	}
	return [...merged].map(([id, cwd]) => ({ id, cwd }))
}

/** Sessions whose cwd is the worktree path itself or a directory inside it. */
export function sessionsForWorktree(refs: readonly WorktreeSessionRef[], worktreePath: string): WorktreeSessionRef[] {
	return refs.filter(ref => isWithin(worktreePath, ref.cwd))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/host-sessions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/host/sessions.ts tests/host-sessions.test.ts
git commit -m "feat(worktrunk): index sessions by worktree cwd"
```

---

## Task 6: Permission decision

**Files:**
- Create: `src/host/permission.ts`
- Test: `tests/host-permission.test.ts`

**Interfaces:**
- Consumes: `WorktreePermissionStatus` from `src/contract.ts`; `WtError` from `src/wt.ts`.
- Produces: `WORKTREE_FULL_ACCESS_PRESET`, `PermissionPresetService`, `PermissionSessionLike`, `WorktrunkPermissionPort`, `hasFullThenRestriction(events)`, `ensureWorktreeFullAccess(port, sessionId): Promise<{ status, preset? }>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/host-permission.test.ts
import { describe, expect, it } from 'vitest'
import { WORKTREE_FULL_ACCESS_PRESET, ensureWorktreeFullAccess, hasFullThenRestriction } from '../src/host/permission.js'

const presetService = (overrides: Partial<{ names: readonly string[], current: (s: unknown) => string, resolve: (n: string) => { sandbox: string, approval: string } }> = {}) => ({
  names: ['workspace-write', WORKTREE_FULL_ACCESS_PRESET],
  current: () => 'workspace-write',
  resolve: () => ({ sandbox: 'danger-full-access', approval: 'ask' }),
  ...overrides,
})

describe('worktree full access decision', () => {
  it('applies the preset to a workspace-write session', async () => {
    const applied: Array<{ session: unknown, preset: string }> = []
    const port = {
      sessions: { get: () => ({ id: 's1', events: [] }) },
      permissionPresets: { ...presetService(), set: (session: unknown, preset: string) => { applied.push({ session, preset }) } },
    }
    await expect(ensureWorktreeFullAccess(port, 's1')).resolves.toEqual({ status: 'applied', preset: WORKTREE_FULL_ACCESS_PRESET })
    expect(applied).toHaveLength(1)
    expect(applied[0]?.preset).toBe(WORKTREE_FULL_ACCESS_PRESET)
  })

  it('reports an already-elevated session without writing', async () => {
    const port = {
      sessions: { get: () => ({ id: 's1', events: [] }) },
      permissionPresets: { ...presetService({ current: () => WORKTREE_FULL_ACCESS_PRESET }), set: () => { throw new Error('must not write') } },
    }
    await expect(ensureWorktreeFullAccess(port, 's1')).resolves.toEqual({ status: 'already-full-access', preset: WORKTREE_FULL_ACCESS_PRESET })
  })

  it('preserves a restriction the user chose after full access', async () => {
    expect(hasFullThenRestriction([
      { type: 'permission/preset', data: { preset: WORKTREE_FULL_ACCESS_PRESET } },
      { type: 'permission/preset', data: { preset: 'read-only' } },
    ])).toBe(true)
    expect(hasFullThenRestriction([
      { type: 'permission/preset', data: { preset: WORKTREE_FULL_ACCESS_PRESET } },
    ])).toBe(false)
    const port = {
      sessions: { get: () => ({ id: 's1', events: [{ type: 'permission/preset', data: { preset: WORKTREE_FULL_ACCESS_PRESET } }, { type: 'permission/preset', data: { preset: 'read-only' } }] }) },
      permissionPresets: { ...presetService(), set: () => { throw new Error('must not write') } },
    }
    await expect(ensureWorktreeFullAccess(port, 's1')).resolves.toEqual({ status: 'user-restricted' })
  })

  it('reports unavailable when the preset service or the preset itself is missing', async () => {
    await expect(ensureWorktreeFullAccess({ sessions: { get: () => ({ id: 's1' }) } }, 's1')).resolves.toEqual({ status: 'unavailable' })
    const withoutPreset = { sessions: { get: () => ({ id: 's1' }) }, permissionPresets: { ...presetService({ names: ['workspace-write'] }), set: () => { throw new Error('must not write') } } }
    await expect(ensureWorktreeFullAccess(withoutPreset, 's1')).resolves.toEqual({ status: 'unavailable' })
  })

  it('reports unavailable for an unknown session', async () => {
    const port = { sessions: { get: () => undefined }, permissionPresets: { ...presetService(), set: () => undefined } }
    await expect(ensureWorktreeFullAccess(port, 'gone')).resolves.toEqual({ status: 'unavailable' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/host-permission.test.ts`
Expected: FAIL — cannot resolve `../src/host/permission.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/host/permission.ts
/**
 * worktree-full-access seam.
 *
 * A worktree's `.git` is a file pointing into the main repository's
 * `.git/worktrees/<name>`, so git writes made from a session whose workspace is
 * the worktree touch metadata outside the session directory. The named preset
 * disables filesystem confinement for that one session while keeping approval
 * prompts on; this module decides when that is legitimate and reports honestly
 * when it cannot be verified.
 */
import type { WorktreePermissionStatus } from '../contract.js'

/** The preset this plugin adds to the permission patch row. */
export const WORKTREE_FULL_ACCESS_PRESET = 'worktree-full-access'

/** One recorded permission event on a session. */
export interface PermissionEventLike {
	readonly type: string
	readonly data?: unknown
}

/** The session shape this seam needs: identity plus its recorded events. */
export interface PermissionSessionLike {
	readonly id: string
	readonly events?: readonly PermissionEventLike[]
	snapshotEvents?(): readonly PermissionEventLike[]
}

/** The subset of DSH's permission-presets service this plugin consumes. */
export interface PermissionPresetService {
	readonly names: readonly string[]
	current(sessionOrEvents: unknown): string
	resolve(name: string): { readonly sandbox: string, readonly approval: string }
	set(session: unknown, name: string): void
}

/** Injected ports; every member is optional because not every profile installs them. */
export interface WorktrunkPermissionPort {
	readonly sessions: { get(sessionId: string): unknown }
	readonly permissionPresets?: PermissionPresetService
}

function eventsOf(session: PermissionSessionLike): readonly PermissionEventLike[] {
	if (Array.isArray(session.events)) return session.events
	try {
		return session.snapshotEvents?.() ?? []
	} catch {
		return []
	}
}

function presetOf(event: PermissionEventLike): string | undefined {
	const data = event.data
	if (typeof data !== 'object' || data === null) return undefined
	const preset = (data as { preset?: unknown }).preset
	return typeof preset === 'string' ? preset : undefined
}

/** True when the session was full-access and a later event narrowed it. */
export function hasFullThenRestriction(events: readonly PermissionEventLike[]): boolean {
	let fullSeen = false
	for (const event of events) {
		if (event.type !== 'permission/preset') continue
		const preset = presetOf(event)
		if (preset === undefined) continue
		if (preset === WORKTREE_FULL_ACCESS_PRESET) fullSeen = true
		else if (fullSeen) return true
	}
	return false
}

/**
 * Decide and, when legitimate, apply full access to one session.
 *
 * `user-restricted` means the user narrowed the session after this plugin
 * elevated it: the restriction is theirs and is preserved. `unavailable` means
 * the capability could not be verified — never a silent downgrade.
 */
export async function ensureWorktreeFullAccess(
	port: WorktrunkPermissionPort,
	sessionId: string,
): Promise<{ status: WorktreePermissionStatus, preset?: string }> {
	const presets = port.permissionPresets
	if (presets === undefined || !presets.names.includes(WORKTREE_FULL_ACCESS_PRESET)) return { status: 'unavailable' }
	let session: unknown
	try {
		session = port.sessions.get(sessionId)
	} catch {
		return { status: 'unavailable' }
	}
	if (session === undefined || session === null) return { status: 'unavailable' }

	const events = eventsOf(session as PermissionSessionLike)
	let current: string | undefined
	try {
		current = presets.current(session)
	} catch {
		return { status: 'unavailable' }
	}
	if (current === WORKTREE_FULL_ACCESS_PRESET) return { status: 'already-full-access', preset: WORKTREE_FULL_ACCESS_PRESET }
	if (hasFullThenRestriction(events)) return { status: 'user-restricted' }
	try {
		presets.set(session, WORKTREE_FULL_ACCESS_PRESET)
	} catch {
		return { status: 'unavailable' }
	}
	return { status: 'applied', preset: WORKTREE_FULL_ACCESS_PRESET }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/host-permission.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/host/permission.ts tests/host-permission.test.ts
git commit -m "feat(worktrunk): decide and apply the worktree full-access preset"
```

---

## Task 7: Host service — reads

**Files:**
- Create: `src/host/service.ts`
- Test: `tests/host-service-read.test.ts`

**Interfaces:**
- Consumes: `hookSpecs`, `listWorktreesFull`, `runWtOk`, `createArgs`, `removeArgs`, `mergeArgs`, `copyIgnoredArgs`, `assertNotSessionWorktree`, `WtContext`, `WtEntry`, `WtError`, `isWithin` from `src/wt.ts`; `readSessionHeaders`, `sessionsForWorktree`; `resolveWorkspacePath`, `registerWorkspace`, `unregisterWorkspace`, `registryOf`; `ensureWorktreeFullAccess`; every type from `src/contract.ts`.
- Produces: `WorktrunkServiceContext`, `WorktrunkServiceConfig`, `WorktrunkService`, `createWorktrunkService(ctx, config)`. Read methods in this task: `readPanel(input, signal?)`, `previewHooks(input, signal?)`. Mutation methods arrive in Task 8.

- [ ] **Step 1: Write the failing test**

```ts
// tests/host-service-read.test.ts
import { describe, expect, it } from 'vitest'
import { createWorktrunkService } from '../src/host/service.js'

const LIST = JSON.stringify({
  schema: 2,
  repo: { default_branch: 'main', forge: { url: 'https://github.com/acme/repo' } },
  items: [
    { branch: 'main', head: { sha: 'a'.repeat(40), short_sha: 'aaaaaaa', subject: 'init' },
      worktree: { path: '/repo', main: true, current: true, changes: {} } },
    { branch: 'feature/a', head: { sha: 'b'.repeat(40), short_sha: 'bbbbbbb', subject: 'work' },
      worktree: { path: '/wt/a', main: false, current: false, changes: { modified: true } } },
  ],
})
const HOOKS = JSON.stringify([{ name: 'install', needs_approval: true, source: 'project', template: 'mise install', type: 'pre-start' }])

function fakeCtx(script: Array<{ stdout?: string, exitCode?: number }>, services: Record<string, unknown> = {}) {
  const calls: Array<{ argv: string[], cwd: string }> = []
  const subprocess = {
    spawn(options: { argv: string[], cwd: string }) {
      calls.push({ argv: options.argv, cwd: options.cwd })
      const step = script.shift() ?? { exitCode: 0 }
      const collect = (text: string) => ({ readFrom: () => ({ text }) })
      return {
        done: Promise.resolve({ exitCode: step.exitCode ?? 0, signal: null }),
        collected: { stdout: collect(step.stdout ?? ''), stderr: collect('') },
      }
    },
  }
  return {
    calls,
    ctx: {
      subprocess,
      get: (name: string) => (name === 'workspaceRegistry' ? services.workspaceRegistry : services[name]),
    },
  }
}

describe('worktrunk service reads', () => {
  it('reads repo facts, rows, hooks, and cwd-matched sessions', async () => {
    const { ctx, calls } = fakeCtx([{ stdout: LIST }, { stdout: '[]' }, { stdout: HOOKS }], {
      workspaceRegistry: {
        get: (id: string) => (id === 'w1' ? { id: 'w1', path: '/repo' } : undefined),
        list: () => [{ id: 'w1', path: '/repo' }],
        resolveByPath: async (path: string) => (path === '/wt/a' ? { id: 'w2' } : undefined),
      },
      sessions: { list: () => [{ id: 's1', header: { cwd: '/wt/a' } }, { id: 's2', header: { cwd: '/repo' } }] },
    })
    const service = createWorktrunkService(ctx as never, { bin: 'wt', labelPrefix: '[wt]' })
    const panel = await service.readPanel({ workspaceId: 'w1' })

    expect(calls.map(call => call.argv.join(' '))).toEqual(['wt list --format=json', 'wt list --format=json', 'wt hook show --format=json'])
    expect(panel.repo).toEqual({ root: '/repo', defaultBranch: 'main', forge: 'https://github.com/acme/repo' })
    expect(panel.items).toHaveLength(2)
    expect(panel.items[0]?.registered).toBe(true)
    expect(panel.items[1]?.sessions).toEqual([{ id: 's1', cwd: '/wt/a' }])
    expect(panel.items[1]?.changes.modified).toBe(true)
    expect(panel.hooks).toEqual([{ name: 'install', needsApproval: true, source: 'project', template: 'mise install', type: 'pre-start' }])
  })

  it('degrades to no hooks instead of failing the panel read', async () => {
    const { ctx } = fakeCtx([{ stdout: LIST }, { stdout: LIST }, { exitCode: 1 }], { workspaceRegistry: { list: () => [{ id: 'w1', path: '/repo' }] } })
    const service = createWorktrunkService(ctx as never, { bin: 'wt', labelPrefix: '[wt]' })
    await expect(service.readPanel({ workspaceId: 'w1' })).resolves.toMatchObject({ hooks: [] })
  })

  it('reports an unknown workspace as NOT_FOUND', async () => {
    const { ctx } = fakeCtx([])
    const service = createWorktrunkService(ctx as never, { bin: 'wt', labelPrefix: '[wt]' })
    await expect(service.readPanel({ workspaceId: 'missing' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/host-service-read.test.ts`
Expected: FAIL — cannot resolve `../src/host/service.js`.

- [ ] **Step 3: Write the implementation**

```ts
// src/host/service.ts
/**
 * The only place the plugin executes `wt` on behalf of the browser panel. Reads
 * reuse the same runner and normalization the agent tools use; nothing here
 * writes plugin state, and nothing here calls git.
 */
import type { Context } from '@deepseek-ai/cordis'
import {
	assertNotSessionWorktree,
	copyIgnoredArgs,
	createArgs,
	hookSpecs,
	isWithin,
	listWorktreesFull,
	mergeArgs,
	removeArgs,
	runWtOk,
	WtError,
	type WtContext,
	type WtEntry,
} from '../wt.js'
import type { HookSpec, PanelSnapshot, RepoFacts, WorktreeRow, WorktreeSessionRef } from '../contract.js'
import { readSessionHeaders, sessionsForWorktree, type SessionSources } from './sessions.js'
import { registerWorkspace, registryOf, resolveWorkspacePath, unregisterWorkspace } from './workspace.js'
import { ensureWorktreeFullAccess, type PermissionPresetService } from './permission.js'

/** Cordis context plus the subprocess service `wt` runs through. */
export interface WorktrunkServiceContext extends WtContext {
	get(service: string): unknown
}

/** Row config for the `dsh-worktrunk` patch entry. */
export interface WorktrunkServiceConfig {
	readonly bin: string
	readonly labelPrefix: string
}

/** Panel-facing service surface. */
export interface WorktrunkService {
	readPanel(input: { workspaceId: string }, signal?: AbortSignal): Promise<PanelSnapshot>
	previewHooks(input: { workspaceId: string }, signal?: AbortSignal): Promise<readonly HookSpec[]>
	createWorktree(input: { workspaceId: string, branch: string, base?: string, skipHooks?: boolean }, signal?: AbortSignal): Promise<{ path: string, branch: string, hooksRan: boolean, registrationWarning?: string }>
	removeWorktree(input: { workspaceId: string, branch: string, force?: boolean, forceDeleteBranch?: boolean, keepBranch?: boolean, currentCwd?: string }, signal?: AbortSignal): Promise<{ removed: true }>
	mergeWorktree(input: { workspaceId: string, branch: string, target?: string, keepCommit?: boolean, keepWorktree?: boolean, currentCwd?: string }, signal?: AbortSignal): Promise<{ merged: true }>
	copyIgnored(input: { workspaceId: string, path?: string, force?: boolean, requireInclude?: boolean }, signal?: AbortSignal): Promise<{ ok: true }>
	openWorktree(input: { workspaceId: string, path: string, branch: string }): Promise<{ workspaceId: string | undefined }>
	ensureWorktreePermission(input: { sessionId: string }): Promise<{ status: string, preset?: string }>
}

async function workspacePath(ctx: WorktrunkServiceContext, workspaceId: string): Promise<string> {
	const path = await resolveWorkspacePath(ctx as unknown as Context, workspaceId)
	if (path === undefined) throw new WtError('NOT_FOUND', `workspace ${JSON.stringify(workspaceId)} is not registered`)
	return path
}

function rowOf(entry: WtEntry, sessions: readonly WorktreeSessionRef[], registered: boolean): WorktreeRow {
	return {
		path: entry.path,
		branch: entry.branch,
		isMain: entry.isMain,
		isCurrent: entry.isCurrent,
		detached: entry.detached,
		branchMismatch: entry.branchMismatch,
		duplicateBranch: entry.duplicateBranch,
		head: entry.head,
		changes: entry.changes,
		upstream: entry.upstream,
		sessions,
		registered,
	}
}

function sessionSources(ctx: WorktrunkServiceContext): SessionSources {
	return {
		sessions: ctx.get('sessions') as SessionSources['sessions'],
		sessionPersistence: ctx.get('sessionPersistence') as SessionSources['sessionPersistence'],
	}
}

/** Build the panel-facing service over one Cordis context. */
export function createWorktrunkService(ctx: WorktrunkServiceContext, config: WorktrunkServiceConfig): WorktrunkService {
	const registry = registryOf(ctx as unknown as Context)

	async function readRows(root: string, signal?: AbortSignal): Promise<{ repo: RepoFacts, items: WorktreeRow[] }> {
		const [full, refs] = await Promise.all([
			listWorktreesFull(ctx, config.bin, root, signal),
			readSessionHeaders(sessionSources(ctx)),
		])
		const items: WorktreeRow[] = []
		for (const entry of full.entries) {
			const registered = registry?.resolveByPath === undefined ? false : (await registry.resolveByPath(entry.path)) !== undefined
			items.push(rowOf(entry, sessionsForWorktree(refs, entry.path), registered))
		}
		return { repo: full.repo, items }
	}

	async function findEntry(root: string, branch: string, signal?: AbortSignal): Promise<WtEntry> {
		const { entries } = await listWorktreesFull(ctx, config.bin, root, signal)
		const entry = entries.find(candidate => candidate.branch === branch)
		if (entry === undefined) throw new WtError('NOT_FOUND', `no worktree for branch ${JSON.stringify(branch)}`)
		return entry
	}

	return {
		async readPanel(input, signal) {
			const root = await workspacePath(ctx, input.workspaceId)
			const rows = await readRows(root, signal)
			let hooks: readonly HookSpec[] = []
			try {
				hooks = await hookSpecs(ctx, config.bin, root, signal)
			} catch {
				// Hook discovery is presentation data: a failure shows no hooks, it
				// never fails the panel read.
			}
			return { repo: rows.repo, items: rows.items, hooks }
		},
		async previewHooks(input, signal) {
			return hookSpecs(ctx, config.bin, await workspacePath(ctx, input.workspaceId), signal)
		},
		// Mutation methods are added in Task 8.
	} as unknown as WorktrunkService
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/host-service-read.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/host/service.ts tests/host-service-read.test.ts
git commit -m "feat(worktrunk): host service reads the panel snapshot"
```

---

## Task 8: Host service — mutations and the session-worktree refusal

**Files:**
- Modify: `src/host/service.ts` (replace the `// Mutation methods are added in Task 8.` placeholder with the six methods)
- Test: `tests/host-service-mutations.test.ts`

**Interfaces:**
- Consumes: everything Task 7 declares, plus `ensureWorktreeFullAccess` and `PermissionPresetService`.
- Produces: `createWorktree`, `removeWorktree`, `mergeWorktree`, `copyIgnored`, `openWorktree`, `ensureWorktreePermission` on `WorktrunkService` with the signatures already declared in Task 7.

- [ ] **Step 1: Write the failing test**

```ts
// tests/host-service-mutations.test.ts
import { describe, expect, it } from 'vitest'
import { createWorktrunkService } from '../src/host/service.js'

const LIST = JSON.stringify({
  schema: 2,
  repo: { default_branch: 'main' },
  items: [
    { branch: 'main', head: { sha: 'a'.repeat(40), short_sha: 'aaaaaaa', subject: 'init' }, worktree: { path: '/repo', main: true, current: true, changes: {} } },
    { branch: 'feature/a', head: { sha: 'b'.repeat(40), short_sha: 'bbbbbbb', subject: 'work' }, worktree: { path: '/wt/a', main: false, current: false, changes: {} } },
  ],
})

function fakeCtx(script: Array<{ stdout?: string, exitCode?: number }>, registry: Record<string, unknown> = {}) {
  const calls: Array<{ argv: string[], cwd: string }> = []
  const subprocess = {
    spawn(options: { argv: string[], cwd: string }) {
      calls.push({ argv: options.argv, cwd: options.cwd })
      const step = script.shift() ?? { exitCode: 0 }
      const collect = (text: string) => ({ readFrom: () => ({ text }) })
      return { done: Promise.resolve({ exitCode: step.exitCode ?? 0, signal: null }), collected: { stdout: collect(step.stdout ?? ''), stderr: collect('') } }
    },
  }
  const created: Array<{ path: string, label: string }> = []
  const ctx = {
    subprocess,
    get: (name: string) => (name === 'workspaceRegistry'
      ? { list: () => [{ id: 'w1', path: '/repo' }], resolveByPath: async () => undefined, create: async (path: string, label: string) => { created.push({ path, label }) }, ...registry }
      : undefined),
  }
  return { calls, created, ctx }
}

const service = (ctx: unknown) => createWorktrunkService(ctx as never, { bin: 'wt', labelPrefix: '[wt]' })

describe('worktrunk service mutations', () => {
  it('creates with hooks, then registers the worktree workspace', async () => {
    const { ctx, calls, created } = fakeCtx([{ stdout: '' }, { stdout: LIST }])
    const result = await service(ctx).createWorktree({ workspaceId: 'w1', branch: 'feature/a', base: 'main' })
    expect(calls[0]?.argv).toEqual(['wt', 'switch', '--create', 'feature/a', '--base', 'main', '--yes'])
    expect(calls[0]?.cwd).toBe('/repo')
    expect(result).toEqual({ path: '/wt/a', branch: 'feature/a', hooksRan: true })
    expect(created).toEqual([{ path: '/wt/a', label: '[wt] feature/a' }])
  })

  it('maps the skip-hooks toggle to --no-hooks', async () => {
    const { ctx, calls } = fakeCtx([{ stdout: '' }, { stdout: LIST }])
    await service(ctx).createWorktree({ workspaceId: 'w1', branch: 'feature/a', skipHooks: true })
    expect(calls[0]?.argv).toEqual(['wt', 'switch', '--create', 'feature/a', '--no-hooks', '--yes'])
  })

  it('refuses to remove the worktree the current session runs inside', async () => {
    const { ctx } = fakeCtx([{ stdout: LIST }])
    await expect(service(ctx).removeWorktree({ workspaceId: 'w1', branch: 'feature/a', currentCwd: '/wt/a/packages/app' }))
      .rejects.toMatchObject({ code: 'SESSION_WORKTREE' })
  })

  it('removes with the force gates and unregisters the workspace', async () => {
    const { ctx, calls } = fakeCtx([{ stdout: LIST }, { stdout: '' }])
    await expect(service(ctx).removeWorktree({ workspaceId: 'w1', branch: 'feature/a', force: true, forceDeleteBranch: true, currentCwd: '/repo' }))
      .resolves.toEqual({ removed: true })
    expect(calls[1]?.argv).toEqual(['wt', 'remove', '--force', '--force-delete', '--foreground', '--yes', 'feature/a'])
  })

  it('merges inside the worktree path and refuses the session worktree unless kept', async () => {
    const refused = fakeCtx([{ stdout: LIST }])
    await expect(service(refused.ctx).mergeWorktree({ workspaceId: 'w1', branch: 'feature/a', currentCwd: '/wt/a' }))
      .rejects.toMatchObject({ code: 'SESSION_WORKTREE' })

    const kept = fakeCtx([{ stdout: LIST }, { stdout: '' }])
    await expect(service(kept.ctx).mergeWorktree({ workspaceId: 'w1', branch: 'feature/a', target: 'main', keepCommit: true, keepWorktree: true, currentCwd: '/wt/a' }))
      .resolves.toEqual({ merged: true })
    expect(kept.calls[1]?.argv).toEqual(['wt', 'merge', 'main', '--no-squash', '--no-remove', '--yes'])
    expect(kept.calls[1]?.cwd).toBe('/wt/a')
  })

  it('copies gitignored files in an explicit path', async () => {
    const { ctx, calls } = fakeCtx([{ stdout: '' }])
    await expect(service(ctx).copyIgnored({ workspaceId: 'w1', path: '/wt/a', force: true })).resolves.toEqual({ ok: true })
    expect(calls[0]?.argv).toEqual(['wt', 'step', 'copy-ignored', '--force'])
    expect(calls[0]?.cwd).toBe('/wt/a')
  })

  it('opens a worktree by registering it and reports the preset outcome', async () => {
    const { ctx, created } = fakeCtx([])
    await expect(service(ctx).openWorktree({ workspaceId: 'w1', path: '/wt/a', branch: 'feature/a' }))
      .resolves.toEqual({ workspaceId: undefined })
    expect(created).toEqual([{ path: '/wt/a', label: '[wt] feature/a' }])

    const withPresets = fakeCtx([], {})
    const presetCtx = {
      ...withPresets.ctx,
      get: (name: string) => (name === 'permissionPresets'
        ? { names: ['worktree-full-access'], current: () => 'workspace-write', resolve: () => ({ sandbox: 'danger-full-access', approval: 'ask' }), set: () => undefined }
        : name === 'sessions' ? { get: () => ({ id: 's1', events: [] }) } : withPresets.ctx.get(name)),
    }
    await expect(service(presetCtx).ensureWorktreePermission({ sessionId: 's1' })).resolves.toEqual({ status: 'applied', preset: 'worktree-full-access' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/host-service-mutations.test.ts`
Expected: FAIL — `service(...).createWorktree is not a function`.

- [ ] **Step 3: Write the implementation**

Replace the placeholder line in the returned object with:

```ts
		async createWorktree(input, signal) {
			const root = await workspacePath(ctx, input.workspaceId)
			await runWtOk(ctx, createArgs(config.bin, { branch: input.branch, base: input.base, hooks: input.skipHooks === true ? false : undefined }), root, signal)
			const entry = await findEntry(root, input.branch, signal)
			const registrationWarning = await registerWorkspace(ctx as unknown as Context, entry.path, input.branch, config.labelPrefix)
			return {
				path: entry.path,
				branch: input.branch,
				hooksRan: input.skipHooks !== true,
				...(registrationWarning === undefined ? {} : { registrationWarning }),
			}
		},
		async removeWorktree(input, signal) {
			const root = await workspacePath(ctx, input.workspaceId)
			const entry = await findEntry(root, input.branch, signal)
			assertNotSessionWorktree(input.currentCwd === undefined ? undefined : entry, input.currentCwd, 'remove')
			await runWtOk(ctx, removeArgs(config.bin, { branch: input.branch, force: input.force, forceDeleteBranch: input.forceDeleteBranch, keepBranch: input.keepBranch }), root, signal)
			await unregisterWorkspace(ctx as unknown as Context, entry.path)
			return { removed: true as const }
		},
		async mergeWorktree(input, signal) {
			const root = await workspacePath(ctx, input.workspaceId)
			const entry = await findEntry(root, input.branch, signal)
			if (input.keepWorktree !== true) {
				assertNotSessionWorktree(input.currentCwd === undefined ? undefined : entry, input.currentCwd, 'merge (it removes the worktree)')
			}
			await runWtOk(ctx, mergeArgs(config.bin, { target: input.target, keepCommit: input.keepCommit, keepWorktree: input.keepWorktree }), entry.path, signal)
			if (input.keepWorktree !== true) await unregisterWorkspace(ctx as unknown as Context, entry.path)
			return { merged: true as const }
		},
		async copyIgnored(input, signal) {
			const cwd = input.path ?? (await workspacePath(ctx, input.workspaceId))
			await runWtOk(ctx, copyIgnoredArgs(config.bin, { force: input.force, requireInclude: input.requireInclude }), cwd, signal)
			return { ok: true as const }
		},
		async openWorktree(input) {
			const warning = await registerWorkspace(ctx as unknown as Context, input.path, input.branch, config.labelPrefix)
			if (warning !== undefined) return { workspaceId: undefined }
			const registered = await (registryOf(ctx as unknown as Context)?.resolveByPath(input.path) ?? Promise.resolve(undefined))
			return { workspaceId: registered?.id }
		},
		async ensureWorktreePermission(input) {
			return ensureWorktreeFullAccess({
				sessions: { get: sessionId => (ctx.get('sessions') as { get(id: string): unknown } | undefined)?.get(sessionId) },
				permissionPresets: ctx.get('permissionPresets') as PermissionPresetService | undefined,
			}, input.sessionId)
		},
```

Note: `assertNotSessionWorktree(undefined, cwd, action)` is a no-op by construction (the function returns early when the entry is undefined), which is exactly the intended meaning of "no current session cwd was supplied".

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run`
Expected: PASS — Task 7 and Task 8 service tests plus everything earlier.

- [ ] **Step 5: Commit**

```bash
git add src/host/service.ts tests/host-service-mutations.test.ts
git commit -m "feat(worktrunk): host service mutations over wt"
```

---

## Task 9: Permission patch row

**Files:**
- Modify: `cordis.patch.yml`
- Test: `tests/patch-presets.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a `permission` patch row carrying four presets, one of them `worktree-full-access`; the existing `insert` row for `dsh-worktrunk` keeps its `bin`/`labelPrefix` config.

- [ ] **Step 1: Write the failing test**

```ts
// tests/patch-presets.test.ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')

describe('bundle patch', () => {
  it('keeps the upstream presets and adds worktree-full-access', () => {
    for (const name of ['read-only', 'workspace-write', 'danger-full-access', 'worktree-full-access']) {
      expect(patch).toContain(`${name}:`)
    }
  })

  it('states the worktree preset keeps approval prompts on', () => {
    const preset = patch.slice(patch.indexOf('worktree-full-access:'))
    expect(preset).toContain('sandbox: danger-full-access')
    expect(preset).toContain('approval: ask')
  })

  it('still inserts the plugin row with its config', () => {
    expect(patch).toContain('id: dsh-worktrunk')
    expect(patch).toContain('name: dsh-worktrunk')
    expect(patch).toContain('labelPrefix:')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/patch-presets.test.ts`
Expected: FAIL — the patch has no `worktree-full-access:` entry.

- [ ] **Step 3: Write the implementation**

```yaml
# cordis.patch.yml — dsh-worktrunk bundle patch.
#
# The permission row REPLACES the whole permission config, so the upstream
# presets are copied verbatim here and one is added. A test asserts all four
# survive, so an upstream preset added later fails loudly instead of vanishing.
- id: permission
  config:
    presets:
      read-only:
        sandbox: read-only
        approval: ask
      workspace-write:
        sandbox: workspace-write
        approval: ask
      danger-full-access:
        sandbox: danger-full-access
        approval: never
      worktree-full-access:
        sandbox: danger-full-access
        approval: ask
        name: Worktree Full Access
        description: Full file access for linked Git metadata while keeping approval prompts enabled.

- insert:
    - id: dsh-worktrunk
      name: dsh-worktrunk
      config:
        bin: wt
        labelPrefix: '[wt]'
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/patch-presets.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add cordis.patch.yml tests/patch-presets.test.ts
git commit -m "feat(worktrunk): add the worktree-full-access permission preset"
```

---

## Task 10: Host remote service and package entrypoints

**Files:**
- Create: `scripts/typert-protocol-meta.d.ts`, `scripts/generate-typert.mjs`, `tsconfig.host.json`
- Create: `src/host/remote.ts`
- Modify: `src/index.ts` (mount the service), `src/contract.ts` (nothing), `package.json` (exports, deps, scripts), `tsconfig.json` (jsx + DOM lib)
- Test: `tests/package-manifest.test.ts`

**Interfaces:**
- Consumes: `TypertRemoteService`, `Remote` from `@deepseek-ai/dsh-typert-protocol`; `WorktrunkService`; every contract type; `createWorktrunkFailure`.
- Produces: `WorktrunkRemoteService` (namespace `worktrunkManager`), `createWorktrunkRemoteProjection(service)`, `project` error/JSON wrapper, `toWorktrunkFailure(error)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/package-manifest.test.ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

describe('package manifest', () => {
  it('publishes the host, contract, client, typert, and remote entrypoints', () => {
    expect(Object.keys(manifest.exports)).toEqual(expect.arrayContaining(['.', './client', './typert', './remote', './package.json']))
    expect(manifest.exports['./typert'].default).toBe('./lib/typert.host.js')
    expect(manifest.exports['./remote'].default).toBe('./lib/typert.remote-client.js')
    expect(manifest.exports['./client'].default).toBe('./lib/client.js')
  })

  it('declares the web client half with its injected services', () => {
    expect(manifest.dsh.client.platform).toBe('web')
    expect(manifest.dsh.client.inject).toEqual(expect.arrayContaining([
      '@deepseek-ai/dsh-client-store',
      '@deepseek-ai/dsh-client-ui-slots',
      '@deepseek-ai/dsh-client-ui-layout',
      '@deepseek-ai/dsh-client-ui-sidebar',
      '@deepseek-ai/dsh-client-connection',
    ]))
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
  })

  it('pins the installed DSH contract family in devDependencies', () => {
    expect(manifest.devDependencies['@deepseek-ai/dsh-typert-protocol']).toBe('0.1.5-rc.1')
    expect(manifest.devDependencies['@deepseek-ai/dsh-typert-generator']).toBe('0.1.5-rc.1')
  })

  it('builds the client and the typert artifacts from source', () => {
    expect(manifest.scripts.build).toContain('generate-typert.mjs')
    expect(manifest.scripts.build).toContain('build-client.mjs')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/package-manifest.test.ts`
Expected: FAIL — `manifest.exports['./client']` is undefined.

- [ ] **Step 3a: Write the host projection**

```ts
// src/host/remote.ts
/**
 * Plain-JSON projection of the host service. Stable domain failures cross the
 * wire as values; anything unrecognized is rethrown so the DSH Gateway reports
 * a transport failure instead of dressing infrastructure faults as refusals.
 */
import {
	WORKTREE_ERROR_CODES,
	createWorktrunkFailure,
	type WorktreeErrorCode,
	type WorktrunkFailure,
	type WorktrunkRemoteResult,
} from '../contract.js'
import { WtError } from '../wt.js'
import type { WorktrunkService } from './service.js'

const codes = new Set<string>(WORKTREE_ERROR_CODES)

function isKnownFailure(error: unknown): error is WtError & { code: WorktreeErrorCode } {
	return error instanceof WtError && codes.has(error.code)
}

/** Map a thrown value to a wire failure, or rethrow when it is not a domain error. */
export function toWorktrunkFailure(error: unknown): WorktrunkFailure {
	if (!isKnownFailure(error)) throw error
	return createWorktrunkFailure(error.code, error.message, {})
}

async function project<Value>(operation: () => Promise<Value>): Promise<WorktrunkRemoteResult<Value>> {
	try {
		return { ok: true, value: await operation() }
	} catch (error) {
		return { ok: false, error: toWorktrunkFailure(error) }
	}
}

/** The method surface the Typert descriptors expose. */
export interface WorktrunkRemoteManager {
	readPanel(input: { workspaceId: string }): Promise<WorktrunkRemoteResult<unknown>>
	previewHooks(input: { workspaceId: string }): Promise<WorktrunkRemoteResult<unknown>>
	createWorktree(input: { workspaceId: string, branch: string, base?: string, skipHooks?: boolean }): Promise<WorktrunkRemoteResult<unknown>>
	removeWorktree(input: { workspaceId: string, branch: string, force?: boolean, forceDeleteBranch?: boolean, keepBranch?: boolean, currentCwd?: string }): Promise<WorktrunkRemoteResult<null>>
	mergeWorktree(input: { workspaceId: string, branch: string, target?: string, keepCommit?: boolean, keepWorktree?: boolean, currentCwd?: string }): Promise<WorktrunkRemoteResult<null>>
	copyIgnored(input: { workspaceId: string, path?: string, force?: boolean, requireInclude?: boolean }): Promise<WorktrunkRemoteResult<null>>
	openWorktree(input: { workspaceId: string, path: string, branch: string }): Promise<WorktrunkRemoteResult<unknown>>
	ensureWorktreePermission(input: { sessionId: string }): Promise<WorktrunkRemoteResult<unknown>>
}

/** Wrap the service in the wire contract. */
export function createWorktrunkRemoteProjection(service: WorktrunkService): WorktrunkRemoteManager {
	return {
		readPanel: input => project(() => service.readPanel(input)),
		previewHooks: input => project(() => service.previewHooks(input)),
		createWorktree: input => project(() => service.createWorktree(input)),
		removeWorktree: input => project(async () => { await service.removeWorktree(input); return null }),
		mergeWorktree: input => project(async () => { await service.mergeWorktree(input); return null }),
		copyIgnored: input => project(async () => { await service.copyIgnored(input); return null }),
		openWorktree: input => project(() => service.openWorktree(input)),
		ensureWorktreePermission: input => project(() => service.ensureWorktreePermission(input)),
	}
}
```

- [ ] **Step 3b: Write the remote service class**

```ts
// src/host/remote-service.ts
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { WorktrunkRemoteResult } from '../contract.js'
import { createWorktrunkService, type WorktrunkServiceConfig } from './service.js'
import { createWorktrunkRemoteProjection, type WorktrunkRemoteManager } from './remote.js'

/**
 * Composition root for the browser half. Cordis constructs it, which registers
 * the `worktrunkManager` Typert namespace and binds the service to this fiber's
 * lifetime. The decorated methods stay deliberately thin: projection and error
 * normalization live in `createWorktrunkRemoteProjection`.
 */
export class WorktrunkRemoteService extends TypertRemoteService {
	static inject = ['subprocess']

	private readonly remote: WorktrunkRemoteManager

	constructor(ctx: Context, config: WorktrunkServiceConfig) {
		super(ctx, 'worktrunkManager')
		const service = createWorktrunkService(ctx as never, config)
		this.remote = createWorktrunkRemoteProjection(service)
	}

	@Remote
	readPanel(input: { workspaceId: string }): Promise<WorktrunkRemoteResult<unknown>> {
		return this.remote.readPanel(input)
	}

	@Remote
	previewHooks(input: { workspaceId: string }): Promise<WorktrunkRemoteResult<unknown>> {
		return this.remote.previewHooks(input)
	}

	@Remote
	createWorktree(input: { workspaceId: string, branch: string, base?: string, skipHooks?: boolean }): Promise<WorktrunkRemoteResult<unknown>> {
		return this.remote.createWorktree(input)
	}

	@Remote
	removeWorktree(input: { workspaceId: string, branch: string, force?: boolean, forceDeleteBranch?: boolean, keepBranch?: boolean, currentCwd?: string }): Promise<WorktrunkRemoteResult<null>> {
		return this.remote.removeWorktree(input)
	}

	@Remote
	mergeWorktree(input: { workspaceId: string, branch: string, target?: string, keepCommit?: boolean, keepWorktree?: boolean, currentCwd?: string }): Promise<WorktrunkRemoteResult<null>> {
		return this.remote.mergeWorktree(input)
	}

	@Remote
	copyIgnored(input: { workspaceId: string, path?: string, force?: boolean, requireInclude?: boolean }): Promise<WorktrunkRemoteResult<null>> {
		return this.remote.copyIgnored(input)
	}

	@Remote
	openWorktree(input: { workspaceId: string, path: string, branch: string }): Promise<WorktrunkRemoteResult<unknown>> {
		return this.remote.openWorktree(input)
	}

	@Remote
	ensureWorktreePermission(input: { sessionId: string }): Promise<WorktrunkRemoteResult<unknown>> {
		return this.remote.ensureWorktreePermission(input)
	}
}
```

- [ ] **Step 3c: Write the analyzer meta, host tsconfig, and generator**

```ts
// scripts/typert-protocol-meta.d.ts
/**
 * Build-only Typert metadata bridge: the analyzer recognizes protocol meta
 * symbols through this ambient module, while runtime code imports the published
 * protocol package.
 */
declare module '@deepseek-ai/dsh-typert-protocol' {
	export abstract class TypertRemoteService {
		readonly typertRemote: {
			readonly service: TypertRemoteService
			readonly serviceKey: string
			readonly namespace: string
		}
		protected constructor(ctx: unknown, serviceKey: string, options?: { readonly namespace?: string })
	}

	export function Remote<This extends object, Args extends unknown[], Result>(
		method: (this: This, ...args: Args) => Result,
		context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Result>,
	): void
}
```

```json
// tsconfig.host.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@deepseek-ai/dsh-typert-protocol": ["scripts/typert-protocol-meta.d.ts"]
    }
  },
  "files": [],
  "references": [{ "path": "./tsconfig.json" }]
}
```

```js
// scripts/generate-typert.mjs
/**
 * Emit the Typert host descriptor and its browser remote contribution from the
 * host face of this package.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { URL, fileURLToPath } from 'node:url'
import { FaceModelEmitter, WorkspaceAnalyzer } from '@deepseek-ai/dsh-typert-generator'

const packageDirectory = fileURLToPath(new URL('..', import.meta.url))
const outputDirectory = path.join(packageDirectory, 'lib')
const manifest = JSON.parse(await readFile(path.join(packageDirectory, 'package.json'), 'utf8'))
const packageName = manifest.name

for (const [subpath, expected] of Object.entries({
  './typert': { types: './lib/typert.host.d.ts', default: './lib/typert.host.js' },
  './remote': { types: './lib/typert.remote-client.d.ts', default: './lib/typert.remote-client.js' },
})) {
  const actual = manifest.exports?.[subpath]
  if (actual?.types !== expected.types || (actual.default ?? actual.import) !== expected.default) {
    throw new Error(`${subpath} must publish ${JSON.stringify(expected)} for Typert generation`)
  }
}

const workspace = new WorkspaceAnalyzer({
  root: packageDirectory,
  hostConfig: 'tsconfig.host.json',
  faces: ['host'],
  packages: [packageName],
}).analyze()

const face = workspace.faces.find(candidate => candidate.face === 'host')
if (face === undefined) throw new Error('Typert did not discover the host face')
const artifact = new FaceModelEmitter(face).emit(packageName)
if (artifact.remote === undefined) throw new Error('Typert did not generate a Remote contribution')

await mkdir(outputDirectory, { recursive: true })
await Promise.all([
  writeFile(path.join(outputDirectory, 'typert.host.js'), artifact.js),
  writeFile(path.join(outputDirectory, 'typert.host.d.ts'), artifact.dts),
  writeFile(path.join(outputDirectory, 'typert.remote-client.js'), artifact.remote.js),
  writeFile(path.join(outputDirectory, 'typert.remote-client.d.ts'), artifact.remote.dts),
])
console.log(`dsh-worktrunk: typert artifacts emitted for ${packageName}`)
```

- [ ] **Step 3d: Mount the service in `src/index.ts`**

Add to the plugin exports and to `apply`:

```ts
export { WorktrunkRemoteService } from './host/remote-service.js'

// inside apply(), after registerContextNote:
ctx.plugin(WorktrunkRemoteService, { bin: resolved.bin, labelPrefix: resolved.labelPrefix })
```

- [ ] **Step 3e: Update `package.json` and `tsconfig.json`**

```json
{
  "scripts": {
    "build": "tsc && node scripts/generate-typert.mjs && node scripts/build-client.mjs",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.test.json"
  },
  "exports": {
    ".": { "types": "./lib/index.d.ts", "default": "./lib/index.js" },
    "./client": { "types": "./lib/client/entry.d.ts", "default": "./lib/client.js" },
    "./typert": { "types": "./lib/typert.host.d.ts", "default": "./lib/typert.host.js" },
    "./remote": { "types": "./lib/typert.remote-client.d.ts", "default": "./lib/typert.remote-client.js" },
    "./package.json": "./package.json"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "inject": [
        "@deepseek-ai/dsh-client-store",
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-ui-primitives",
        "@deepseek-ai/dsh-client-ui-slots",
        "@deepseek-ai/dsh-client-ui-layout",
        "@deepseek-ai/dsh-client-ui-sidebar",
        "@deepseek-ai/dsh-api-session-controller",
        "@deepseek-ai/dsh-client-connection"
      ],
      "platform": "web"
    }
  }
}
```

Add to `tsconfig.json` `compilerOptions`: `"jsx": "react-jsx"` and `"lib": ["ES2022", "DOM", "DOM.Iterable"]`.

Add to `devDependencies` (all `0.1.5-rc.1`) and to `peerDependencies` (`*`): `@deepseek-ai/dsh-typert-protocol`, `@deepseek-ai/dsh-typert-generator`, `@deepseek-ai/dsh-client-store`, `@deepseek-ai/dsh-client-locale`, `@deepseek-ai/dsh-client-ui-primitives`, `@deepseek-ai/dsh-client-ui-slots`, `@deepseek-ai/dsh-client-ui-layout`, `@deepseek-ai/dsh-client-ui-sidebar`, `@deepseek-ai/dsh-client-connection`, `@deepseek-ai/dsh-api-session-controller`, `@deepseek-ai/dsh-session`, plus devDeps `react@^19.3.0`, `react-dom@^19.3.0`, `@types/react@~19.3.0`, `@types/react-dom@~19.3.0`, `esbuild@^0.28.2`.

- [ ] **Step 3f: Install and run the generator**

```bash
pnpm install
pnpm exec tsc -p tsconfig.json
node scripts/generate-typert.mjs
```

Expected: `lib/typert.host.js` and `lib/typert.remote-client.js` exist. If the generator reports that it did not discover the host face, run `node scripts/generate-typert.mjs` with the analyzer's printed diagnostics to see which files it read, and confirm `src/host/remote-service.ts` is inside the `tsconfig.json` program and that `@Remote` resolves through the meta bridge. **Do not hand-edit generated artifacts**; fix the face, not the output.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run`
Expected: PASS, including `tests/package-manifest.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json tsconfig.host.json scripts src/host/remote.ts src/host/remote-service.ts src/index.ts tests/package-manifest.test.ts
git commit -m "feat(worktrunk): expose the host service as a typert remote"
```

---

## Task 11: Client bundle script and the `/api` connection adapter

**Files:**
- Create: `scripts/build-client.mjs`, `src/client/connection.ts`
- Test: `tests/client-connection.test.ts`

**Interfaces:**
- Consumes: `WorktrunkRemoteResult` and every contract type.
- Produces: `WORKTRUNK_CHANNEL = '/api'`, `WORKTRUNK_ENDPOINTS`, `WorktrunkConnectionError`, `WorktrunkConnectionRpc`, `createWorktrunkConnection(rpc): WorktrunkConnection`, with one method per remote method plus `dispose()`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/client-connection.test.ts
import { describe, expect, it } from 'vitest'
import { WORKTRUNK_ENDPOINTS, createWorktrunkConnection } from '../src/client/connection.js'

function fakeRpc(result: unknown) {
  const calls: Array<{ channel: string, endpoint: string, body: unknown, signal?: AbortSignal }> = []
  return {
    calls,
    rpc: {
      call: async (channel: string, endpoint: string, body: unknown, signal?: AbortSignal) => {
        calls.push({ channel, endpoint, body, signal })
        return result
      },
    },
  }
}

const okValue = (value: unknown) => ({ ok: true, value: { ok: true, value } })

describe('worktrunk connection', () => {
  it('calls the /api channel with the documented envelope', async () => {
    const { rpc, calls } = fakeRpc(okValue({ repo: { root: '/repo' }, items: [], hooks: [] }))
    const connection = createWorktrunkConnection(rpc as never)
    const panel = await connection.readPanel({ workspaceId: 'w1' })
    expect(calls[0]?.channel).toBe('/api')
    expect(calls[0]?.endpoint).toBe(WORKTRUNK_ENDPOINTS.readPanel)
    expect(calls[0]?.body).toEqual({ args: { input: { workspaceId: 'w1' } } })
    expect(panel).toMatchObject({ repo: { root: '/repo' } })
  })

  it('turns a gateway failure into a retryable error', async () => {
    const { rpc } = fakeRpc({ ok: false, error: { code: 'GATEWAY_DOWN', message: 'gone', details: {} } })
    const connection = createWorktrunkConnection(rpc as never)
    await expect(connection.readPanel({ workspaceId: 'w1' })).rejects.toMatchObject({ code: 'GATEWAY_DOWN', retryable: true })
  })

  it('turns a domain failure into a non-retryable error carrying the code', async () => {
    const { rpc } = fakeRpc({ ok: true, value: { ok: false, error: { code: 'SESSION_WORKTREE', message: 'refused', details: {} } } })
    const connection = createWorktrunkConnection(rpc as never)
    await expect(connection.removeWorktree({ workspaceId: 'w1', branch: 'b' })).rejects.toMatchObject({ code: 'SESSION_WORKTREE', retryable: false })
  })

  it('aborts in-flight calls on dispose and rejects further ones', async () => {
    let observed: AbortSignal | undefined
    const rpc = { call: (_c: string, _e: string, _b: unknown, signal?: AbortSignal) => { observed = signal; return new Promise(() => {}) } }
    const connection = createWorktrunkConnection(rpc as never)
    void connection.readPanel({ workspaceId: 'w1' }).catch(() => undefined)
    connection.dispose()
    expect(observed?.aborted).toBe(true)
    await expect(connection.readPanel({ workspaceId: 'w1' })).rejects.toMatchObject({ code: 'CLIENT_DISPOSED' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/client-connection.test.ts`
Expected: FAIL — cannot resolve `../src/client/connection.js`.

- [ ] **Step 3: Write the connection adapter**

```ts
// src/client/connection.ts
/**
 * The one wire adapter for the browser half. Every request rides the existing
 * DSH `/api` Connection; no second transport exists, and React never learns a
 * wire name.
 */
import type { PanelSnapshot, WorktrunkRemoteResult, HookSpec, WorktreeRow } from '../contract.js'

/** The one logical channel shared by the DSH Connection and Typert Gateway. */
export const WORKTRUNK_CHANNEL = '/api' as const

/** Canonical endpoints owned by this adapter. */
export const WORKTRUNK_ENDPOINTS = Object.freeze({
	readPanel: 'worktrunkManager/readPanel',
	previewHooks: 'worktrunkManager/previewHooks',
	createWorktree: 'worktrunkManager/createWorktree',
	removeWorktree: 'worktrunkManager/removeWorktree',
	mergeWorktree: 'worktrunkManager/mergeWorktree',
	copyIgnored: 'worktrunkManager/copyIgnored',
	openWorktree: 'worktrunkManager/openWorktree',
	ensureWorktreePermission: 'worktrunkManager/ensureWorktreePermission',
} as const)

/** Deliberately narrow transport seam: the adapter only needs `call`. */
export interface WorktrunkConnectionRpc {
	call(channel: string, endpoint: string, body: unknown, signal?: AbortSignal): Promise<unknown>
}

export interface WorktrunkConnectionErrorOptions {
	readonly code: string
	readonly message: string
	readonly details?: Readonly<Record<string, unknown>>
	readonly retryable: boolean
	readonly cause?: unknown
}

/** Browser-safe error shared by transport, gateway, and domain failures. */
export class WorktrunkConnectionError extends Error {
	readonly code: string
	readonly details: Readonly<Record<string, unknown>>
	readonly retryable: boolean

	constructor(options: WorktrunkConnectionErrorOptions) {
		super(options.message, options.cause === undefined ? undefined : { cause: options.cause })
		this.name = 'WorktrunkConnectionError'
		this.code = options.code
		this.details = Object.freeze({ ...(options.details ?? {}) })
		this.retryable = options.retryable
	}
}

export interface WorktrunkCreateInput { workspaceId: string, branch: string, base?: string, skipHooks?: boolean }
export interface WorktrunkRemoveInput { workspaceId: string, branch: string, force?: boolean, forceDeleteBranch?: boolean, keepBranch?: boolean, currentCwd?: string }
export interface WorktrunkMergeInput { workspaceId: string, branch: string, target?: string, keepCommit?: boolean, keepWorktree?: boolean, currentCwd?: string }
export interface WorktrunkCopyIgnoredInput { workspaceId: string, path?: string, force?: boolean, requireInclude?: boolean }
export interface WorktrunkOpenInput { workspaceId: string, path: string, branch: string }
export interface WorktrunkCreateResult { path: string, branch: string, hooksRan: boolean, registrationWarning?: string }
export interface WorktrunkPermissionResult { status: string, preset?: string }

/** Panel-facing connection surface. */
export interface WorktrunkConnection {
	readPanel(input: { workspaceId: string }): Promise<PanelSnapshot>
	previewHooks(input: { workspaceId: string }): Promise<readonly HookSpec[]>
	createWorktree(input: WorktrunkCreateInput): Promise<WorktrunkCreateResult>
	removeWorktree(input: WorktrunkRemoveInput): Promise<void>
	mergeWorktree(input: WorktrunkMergeInput): Promise<void>
	copyIgnored(input: WorktrunkCopyIgnoredInput): Promise<void>
	openWorktree(input: WorktrunkOpenInput): Promise<{ workspaceId?: string }>
	ensureWorktreePermission(input: { sessionId: string }): Promise<WorktrunkPermissionResult>
	dispose(): void
}

type Envelope = { ok: true, value: unknown } | { ok: false, error: { code?: unknown, message?: unknown, details?: unknown } }

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asEnvelope(value: unknown): Envelope {
	if (isRecord(value) && typeof value.ok === 'boolean') return value as Envelope
	return { ok: false, error: { code: 'WORKTRUNK_INVALID_RESULT', message: '', details: {} } }
}

/** Adapt the shared DSH Connection RPC into the panel contract. */
export function createWorktrunkConnection(rpc: WorktrunkConnectionRpc): WorktrunkConnection {
	const inFlight = new Set<AbortController>()
	let disposed = false

	async function invoke<Value>(endpoint: string, input: unknown): Promise<Value> {
		if (disposed) throw new WorktrunkConnectionError({ code: 'CLIENT_DISPOSED', message: 'Worktrunk connection is disposed; reload the plugin and retry.', retryable: false })
		const controller = new AbortController()
		inFlight.add(controller)
		try {
			let raw: unknown
			try {
				raw = await rpc.call(WORKTRUNK_CHANNEL, endpoint, { args: { input } }, controller.signal)
			} catch (error) {
				if (disposed && controller.signal.aborted) throw new WorktrunkConnectionError({ code: 'CLIENT_DISPOSED', message: 'Worktrunk connection is disposed; reload the plugin and retry.', retryable: false })
				throw new WorktrunkConnectionError({
					code: 'WORKTRUNK_CONNECTION_FAILED',
					message: error instanceof Error ? error.message : String(error),
					details: { endpoint },
					retryable: true,
					cause: error,
				})
			}
			const envelope = asEnvelope(raw)
			if (!envelope.ok) {
				const error = envelope.error
				throw new WorktrunkConnectionError({
					code: typeof error.code === 'string' ? error.code : 'WORKTRUNK_GATEWAY_FAILED',
					message: typeof error.message === 'string' ? error.message : '',
					details: { endpoint, ...(isRecord(error.details) ? error.details : {}) },
					retryable: true,
				})
			}
			const inner = asEnvelope(envelope.value)
			if (!inner.ok) {
				const error = inner.error
				throw new WorktrunkConnectionError({
					code: typeof error.code === 'string' ? error.code : 'WORKTRUNK_DOMAIN_FAILED',
					message: typeof error.message === 'string' ? error.message : '',
					details: { endpoint, ...(isRecord(error.details) ? error.details : {}) },
					retryable: false,
				})
			}
			return inner.value as Value
		} finally {
			inFlight.delete(controller)
		}
	}

	return {
		readPanel: input => invoke<PanelSnapshot>(WORKTRUNK_ENDPOINTS.readPanel, input),
		previewHooks: input => invoke<readonly HookSpec[]>(WORKTRUNK_ENDPOINTS.previewHooks, input),
		createWorktree: input => invoke<WorktrunkCreateResult>(WORKTRUNK_ENDPOINTS.createWorktree, input),
		async removeWorktree(input) { await invoke<null>(WORKTRUNK_ENDPOINTS.removeWorktree, input) },
		async mergeWorktree(input) { await invoke<null>(WORKTRUNK_ENDPOINTS.mergeWorktree, input) },
		async copyIgnored(input) { await invoke<null>(WORKTRUNK_ENDPOINTS.copyIgnored, input) },
		openWorktree: input => invoke<{ workspaceId?: string }>(WORKTRUNK_ENDPOINTS.openWorktree, input),
		ensureWorktreePermission: input => invoke<WorktrunkPermissionResult>(WORKTRUNK_ENDPOINTS.ensureWorktreePermission, input),
		dispose(): void {
			if (disposed) return
			disposed = true
			for (const controller of inFlight) controller.abort()
			inFlight.clear()
		},
	}
}

export type { WorktreeRow, WorktrunkRemoteResult }
```

- [ ] **Step 4: Write the client bundle script and verify the test**

```js
// scripts/build-client.mjs
/**
 * Bundle the browser half into the closure-factory artifact DSH's client module
 * loader expects. Externals resolve through the loader's injected require table;
 * only local files are inlined.
 */
import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const EXTERNALS = [
	'react',
	'react/jsx-runtime',
	'react-dom',
	'@deepseek-ai/cordis',
	'@deepseek-ai/dsh-client-store',
	'@deepseek-ai/dsh-client-locale',
	'@deepseek-ai/dsh-client-locale/client',
	'@deepseek-ai/dsh-client-connection',
	'@deepseek-ai/dsh-client-connection/client',
	'@deepseek-ai/dsh-client-ui-primitives',
	'@deepseek-ai/dsh-client-ui-slots',
	'@deepseek-ai/dsh-client-ui-layout',
	'@deepseek-ai/dsh-client-ui-layout/client',
	'@deepseek-ai/dsh-client-ui-sidebar',
	'@deepseek-ai/dsh-client-ui-sidebar/client',
	'@deepseek-ai/dsh-api-session-controller',
	'@deepseek-ai/dsh-api-session-controller/client',
]

const banner = `window.__ModuleLoader__.load({
  id: "dsh-worktrunk",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
`
const footer = `    return module.exports;
  },
});
`

const result = await build({
	entryPoints: [resolve(root, 'src/client/entry.ts')],
	outfile: resolve(root, 'lib/client.js'),
	bundle: true,
	format: 'cjs',
	platform: 'browser',
	target: 'es2022',
	jsx: 'automatic',
	external: EXTERNALS,
	logLevel: 'warning',
	write: false,
})

const code = result.outputFiles[0].text
mkdirSync(resolve(root, 'lib'), { recursive: true })
writeFileSync(resolve(root, 'lib/client.js'), banner + code + footer)
console.log(`dsh-worktrunk client bundle: ${code.split('\n').length} lines -> lib/client.js`)
```

Run: `pnpm vitest run tests/client-connection.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/build-client.mjs src/client/connection.ts tests/client-connection.test.ts
git commit -m "feat(worktrunk): add the browser connection adapter and client bundle script"
```

---

## Task 12: Client locale and the panel store

**Files:**
- Create: `src/client/locale.ts`, `src/client/store.ts`
- Test: `tests/client-store.test.ts`

**Interfaces:**
- Consumes: `WorktrunkConnection`, `PanelSnapshot`, `WorktreeRow`, `WorktrunkConnectionError`.
- Produces: `WORKTRUNK_NS = 'worktrunk'`, `en`, `WorktrunkLocaleKey`, `PanelState`, `PanelStore`, `createPanelStore(connection)`, `worktreeErrorMessageKey(error): WorktrunkLocaleKey`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/client-store.test.ts
import { describe, expect, it } from 'vitest'
import { createPanelStore, worktreeErrorMessageKey } from '../src/client/store.js'
import { WorktrunkConnectionError } from '../src/client/connection.js'
import type { PanelSnapshot } from '../src/contract.js'

const snapshot = (branch: string): PanelSnapshot => ({
  repo: { root: '/repo', defaultBranch: 'main', forge: null },
  items: [{ path: `/wt/${branch}`, branch, isMain: false, isCurrent: false, detached: false, branchMismatch: false, duplicateBranch: false,
    head: null, changes: { staged: false, modified: false, untracked: false, renamed: false, deleted: false, conflicted: false }, upstream: null, sessions: [], registered: false }],
  hooks: [],
})

function deferred<Value>() {
  let resolve!: (value: Value) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<Value>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('panel store', () => {
  it('loads a workspace and keeps one generation per workspace', async () => {
    const store = createPanelStore({ readPanel: async () => snapshot('a') } as never)
    await store.load('w1')
    expect(store.getSnapshot().rows.map(row => row.branch)).toEqual(['a'])
    expect(store.getSnapshot().loading).toBe(false)
  })

  it('keeps ready rows when a later targeted refresh fails', async () => {
    let mode: 'ok' | 'fail' = 'ok'
    const store = createPanelStore({
      readPanel: async () => {
        if (mode === 'fail') throw new WorktrunkConnectionError({ code: 'WORKTRUNK_CONNECTION_FAILED', message: 'down', retryable: true })
        return snapshot('a')
      },
    } as never)
    await store.load('w1')
    mode = 'fail'
    await store.load('w1')
    const state = store.getSnapshot()
    expect(state.rows.map(row => row.branch)).toEqual(['a'])
    expect(state.error).toMatchObject({ code: 'WORKTRUNK_CONNECTION_FAILED' })
  })

  it('drops a stale response that settles after a newer load', async () => {
    const first = deferred<PanelSnapshot>()
    const second = deferred<PanelSnapshot>()
    const queue = [first.promise, second.promise]
    const store = createPanelStore({ readPanel: () => queue.shift() as Promise<PanelSnapshot> } as never)
    const loading = store.load('w1')
    const reloading = store.load('w1')
    second.resolve(snapshot('new'))
    await reloading
    first.resolve(snapshot('old'))
    await loading
    expect(store.getSnapshot().rows.map(row => row.branch)).toEqual(['new'])
  })

  it('maps known failure codes to locale keys and falls back to the generic one', () => {
    expect(worktreeErrorMessageKey(new WorktrunkConnectionError({ code: 'WT_NOT_INSTALLED', message: '', retryable: false }))).toBe('error.wtNotInstalled')
    expect(worktreeErrorMessageKey(new WorktrunkConnectionError({ code: 'SESSION_WORKTREE', message: '', retryable: false }))).toBe('error.sessionWorktree')
    expect(worktreeErrorMessageKey(new Error('weird'))).toBe('error.unknown')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/client-store.test.ts`
Expected: FAIL — cannot resolve `../src/client/store.js`.

- [ ] **Step 3: Write the locale and the store**

```ts
// src/client/locale.ts
import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** Locale namespace owned by this plugin. */
export const WORKTRUNK_NS = 'worktrunk' as const

/** English dictionary. Adding `zh` later is a data-only change. */
export const en = {
	'panel.label': 'Worktrees',
	'panel.title': 'Worktrees',
	'panel.refresh': 'Refresh',
	'panel.empty': 'No worktrees yet. Create one to start working in a parallel checkout.',
	'panel.loading': 'Loading worktrees…',
	'panel.retry': 'Retry',
	'panel.local': 'Local',
	'panel.detached': 'Detached HEAD',
	'panel.branchMismatch': 'Branch changed in Git',
	'panel.duplicateBranch': 'Branch checked out twice',
	'panel.dirty': 'Uncommitted changes',
	'panel.ahead': '{n} ahead',
	'panel.behind': '{n} behind',
	'panel.current': 'Current session',
	'panel.copyPath': 'Copy path',
	'panel.open': 'Open in DSH',
	'panel.newSession': 'New session here',
	'panel.syncIgnored': 'Sync gitignored files',
	'panel.merge': 'Merge into…',
	'panel.remove': 'Remove',
	'panel.create': 'Create worktree',
	'panel.sessions': 'Sessions',
	'panel.noSessions': 'No sessions yet',
	'create.title': 'Create worktree',
	'create.description': 'A new branch and worktree in {repo}. Worktrees live outside the repository.',
	'create.branch': 'New branch name',
	'create.base': 'Base branch',
	'create.baseCurrent': 'Current branch ({branch})',
	'create.hooks': 'Setup steps from .config/wt.toml',
	'create.noHooks': 'This repository configures no start hooks.',
	'create.skipHooks': 'Skip start hooks this once (no dependency install, no gitignored file copy)',
	'create.blocking': 'A pre-start hook runs before the worktree is ready and can take a while.',
	'create.submit': 'Create',
	'create.cancel': 'Cancel',
	'create.working': 'Creating worktree and running setup steps…',
	'remove.title': 'Remove worktree',
	'remove.description': 'Remove {branch} at {path} from disk? Its sessions keep their history but lose this directory.',
	'remove.dirty': 'This worktree has uncommitted changes.',
	'remove.force': 'Remove anyway, discarding uncommitted changes',
	'remove.branchUnmerged': 'The branch is not merged; deleting it needs an explicit choice.',
	'remove.forceDeleteBranch': 'Also delete the branch even though it is not merged',
	'remove.keepBranch': 'Keep the branch, remove only the worktree',
	'remove.detached': 'This worktree has a detached HEAD; no branch will be deleted.',
	'remove.submit': 'Remove',
	'remove.cancel': 'Cancel',
	'merge.title': 'Merge worktree',
	'merge.description': 'Squash and rebase {branch} into {target}, fast-forward the target, then remove the worktree.',
	'merge.target': 'Target branch',
	'merge.keepCommit': 'Preserve commit history (no squash)',
	'merge.keepWorktree': 'Keep the worktree after merging',
	'merge.hooks': 'Pre-merge hooks from .config/wt.toml',
	'merge.submit': 'Merge',
	'merge.cancel': 'Cancel',
	'permission.title': 'Enable Worktree Full access?',
	'permission.description':
		'This session works inside a git worktree, whose .git entry points at metadata in the main repository. Enabling full access disables filesystem confinement for this session only, so git writes can reach that metadata. Approval prompts stay on; network and process policy are unchanged. Target: {cwd}',
	'permission.acknowledge': 'I understand and want to continue',
	'permission.enable': 'Enable full access',
	'permission.cancel': 'Cancel',
	'permission.retained': 'The session was kept; confirm full access to retry. It was not opened.',
	'permission.userRestricted': 'Your own permission restriction was preserved; this session was not elevated.',
	'permission.unavailable': 'The permission preset is unavailable in this profile; the session was kept but full access is not confirmed.',
	'error.wtNotInstalled': 'worktrunk is not installed. Install it with `brew install worktrunk` or `cargo install worktrunk`, then restart DSH.',
	'error.notARepo': 'This workspace is not a git repository.',
	'error.noInitialCommit': 'This repository has no commit yet.',
	'error.noLocalBranch': 'This repository has no local branch yet.',
	'error.wtFailed': 'worktrunk failed: {reason}',
	'error.busy': 'Another worktrunk operation is in progress; retry shortly.',
	'error.sessionWorktree': 'That would affect the worktree this session runs inside; do it from another session.',
	'error.notFound': 'That worktree no longer exists; refresh the panel.',
	'error.hookFailed': 'A setup step failed: {reason}',
	'error.presetUnavailable': 'The worktree full-access preset is not installed in this profile.',
	'error.unknown': 'The worktree operation failed: {reason}',
} satisfies Record<string, string>

export type WorktrunkLocaleKey = keyof typeof en

declare module '@deepseek-ai/dsh-client-ui-slots' {
	interface LocaleNamespaceMap {
		worktrunk: WorktrunkLocaleKey
	}
}
```

```ts
// src/client/store.ts
/**
 * Panel state. One read at a time per workspace, one generation per workspace,
 * and a stale response may never write: that is what keeps ready rows visible
 * while a replacement read is in flight or fails.
 */
import type { PanelSnapshot, WorktreeRow } from '../contract.js'
import { WorktrunkConnectionError, type WorktrunkConnection } from './connection.js'
import type { WorktrunkLocaleKey } from './locale.js'

/** What the panel renders. */
export interface PanelState {
	readonly workspaceId: string | undefined
	readonly repo: PanelSnapshot['repo'] | undefined
	readonly rows: readonly WorktreeRow[]
	readonly hooks: PanelSnapshot['hooks']
	readonly loading: boolean
	readonly error: { code: string, retryable: boolean, message: string } | undefined
}

/** Store surface: read, subscribe, and the two browser-local selections. */
export interface PanelStore {
	getSnapshot(): PanelState
	subscribe(listener: () => void): () => void
	load(workspaceId: string): Promise<void>
	setSelection(worktreePath: string | undefined): void
	getSelection(): string | undefined
	dispose(): void
}

const EMPTY: PanelState = { workspaceId: undefined, repo: undefined, rows: [], hooks: [], loading: false, error: undefined }

/** Map a failure to the locale key the panel shows. */
export function worktreeErrorMessageKey(error: unknown): WorktrunkLocaleKey {
	const candidate = error instanceof WorktrunkConnectionError
		? error.code
		: (error as { code?: unknown } | undefined)?.code
	const code = typeof candidate === 'string' ? candidate : undefined
	switch (code) {
		case 'WT_NOT_INSTALLED': return 'error.wtNotInstalled'
		case 'NOT_A_REPO': return 'error.notARepo'
		case 'NO_INITIAL_COMMIT': return 'error.noInitialCommit'
		case 'NO_LOCAL_BRANCH': return 'error.noLocalBranch'
		case 'WT_FAILED': return 'error.wtFailed'
		case 'WT_BUSY': return 'error.busy'
		case 'SESSION_WORKTREE': return 'error.sessionWorktree'
		case 'NOT_FOUND': return 'error.notFound'
		case 'HOOK_FAILED': return 'error.hookFailed'
		case 'PRESET_UNAVAILABLE': return 'error.presetUnavailable'
		default: return 'error.unknown'
	}
}

/** Create the panel store over one connection. */
export function createPanelStore(connection: WorktrunkConnection): PanelStore {
	let state: PanelState = EMPTY
	let selection: string | undefined
	let disposed = false
	const generations = new Map<string, number>()
	const listeners = new Set<() => void>()

	const publish = (next: Partial<PanelState>): void => {
		state = { ...state, ...next }
		for (const listener of listeners) listener()
	}

	return {
		getSnapshot: () => state,
		subscribe(listener) {
			listeners.add(listener)
			return () => { listeners.delete(listener) }
		},
		async load(workspaceId) {
			if (disposed) return
			const generation = (generations.get(workspaceId) ?? 0) + 1
			generations.set(workspaceId, generation)
			const firstRead = state.repo === undefined
			publish({ workspaceId, loading: firstRead, error: undefined })
			try {
				const snapshot = await connection.readPanel({ workspaceId })
				if (disposed || generations.get(workspaceId) !== generation) return
				publish({ workspaceId, repo: snapshot.repo, rows: snapshot.items, hooks: snapshot.hooks, loading: false, error: undefined })
			} catch (error) {
				if (disposed || generations.get(workspaceId) !== generation) return
				publish({
					loading: false,
					error: {
						code: error instanceof WorktrunkConnectionError ? error.code : 'UNKNOWN',
						retryable: error instanceof WorktrunkConnectionError ? error.retryable : true,
						message: error instanceof Error ? error.message : String(error),
					},
				})
			}
		},
		setSelection(worktreePath) { selection = worktreePath },
		getSelection: () => selection,
		dispose() { disposed = true; listeners.clear() },
	}
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/client-store.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/client/locale.ts src/client/store.ts tests/client-store.test.ts
git commit -m "feat(worktrunk): add the panel store and locale dictionary"
```

---

## Task 13: Panel rows, header, and states

**Files:**
- Create: `src/client/panel/rows.tsx`, `src/client/panel/WorktreePanel.tsx`, `src/client/PanelIcon.tsx`
- Test: `tests/client-panel-render.test.ts`

**Interfaces:**
- Consumes: `PanelStore`, `WorkturkLocaleKey` (via `PropsLocale`), `worktreeErrorMessageKey`, `WorktreeRow`, `PropsRuntime`.
- Produces: `WorktreeRowView(props)`, `PanelIcon(props)`, `WorktreePanel(props)`, `rowChips(row, t): string[]`, `sessionLabel(entry, snapshot)`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/client-panel-render.test.ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { rowChips } from '../src/client/panel/rows.js'
import { WorktreePanel } from '../src/client/panel/WorktreePanel.js'
import { createPanelStore } from '../src/client/store.js'
import type { PanelSnapshot } from '../src/contract.js'

const t = (key: string, params?: Record<string, unknown>) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`)

const snapshot: PanelSnapshot = {
  repo: { root: '/repo', defaultBranch: 'main', forge: 'https://github.com/acme/repo' },
  items: [
    { path: '/repo', branch: 'main', isMain: true, isCurrent: false, detached: false, branchMismatch: false, duplicateBranch: false,
      head: { sha: 'a'.repeat(40), shortSha: 'aaaaaaa', subject: 'init', committedAt: null },
      changes: { staged: false, modified: false, untracked: false, renamed: false, deleted: false, conflicted: false }, upstream: null, sessions: [], registered: true },
    { path: '/wt/a', branch: 'feature/a', isMain: false, isCurrent: false, detached: false, branchMismatch: true, duplicateBranch: false,
      head: null, changes: { staged: false, modified: true, untracked: true, renamed: false, deleted: false, conflicted: false },
      upstream: { remote: 'origin', branch: 'feature/a', ahead: 2, behind: 0 }, sessions: [{ id: 's1', cwd: '/wt/a' }], registered: true },
  ],
  hooks: [],
}

describe('panel rendering', () => {
  it('describes a row through chips', () => {
    expect(rowChips(snapshot.items[1]!, t as never)).toEqual(['panel.dirty', 'panel.branchMismatch', 'panel.ahead:{"n":2}'])
    expect(rowChips(snapshot.items[0]!, t as never)).toEqual([])
  })

  it('renders the repository header, the local row, and the sessions count', () => {
    const store = createPanelStore({ readPanel: async () => snapshot } as never)
    const html = renderToStaticMarkup(createElement(WorktreePanel, {
      store: { getSnapshot: () => ({ workspaceId: 'w1', repo: snapshot.repo, rows: snapshot.items, hooks: [], loading: false, error: undefined }), subscribe: () => () => {}, load: async () => {}, setSelection: () => {}, getSelection: () => undefined, dispose: () => {} } as never,
      connection: {} as never,
      t: t as never,
      currentSessionCwd: '/wt/a',
      openSession: () => undefined,
      onCreate: () => undefined,
    }))
    expect(html).toContain('panel.title')
    expect(html).toContain('main')
    expect(html).toContain('feature/a')
    expect(html).toContain('panel.sessions')
  })

  it('renders the empty state, and the retryable error instead of an empty list', () => {
    const empty = renderToStaticMarkup(createElement(WorktreePanel, {
      store: { getSnapshot: () => ({ workspaceId: 'w1', repo: snapshot.repo, rows: [], hooks: [], loading: false, error: undefined }), subscribe: () => () => {}, load: async () => {}, setSelection: () => {}, getSelection: () => undefined, dispose: () => {} } as never,
      connection: {} as never, t: t as never, openSession: () => undefined, onCreate: () => undefined,
    }))
    expect(empty).toContain('panel.empty')

    const failed = renderToStaticMarkup(createElement(WorktreePanel, {
      store: { getSnapshot: () => ({ workspaceId: 'w1', repo: undefined, rows: [], hooks: [], loading: false, error: { code: 'WT_NOT_INSTALLED', retryable: true, message: '' } }), subscribe: () => () => {}, load: async () => {}, setSelection: () => {}, getSelection: () => undefined, dispose: () => {} } as never,
      connection: {} as never, t: t as never, openSession: () => undefined, onCreate: () => undefined,
    }))
    expect(failed).toContain('error.wtNotInstalled')
    expect(failed).toContain('panel.retry')
    expect(failed).not.toContain('panel.empty')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/client-panel-render.test.ts`
Expected: FAIL — cannot resolve `../src/client/panel/rows.js`.

- [ ] **Step 3: Write the components**

```tsx
// src/client/panel/rows.tsx
/** Presentational rows: one worktree, its chips, and its sessions. */
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorktreeRow } from '../../contract.js'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'

/** Status chips for one row, in a stable order. */
export function rowChips(row: WorktreeRow, t: Translate): string[] {
	const chips: string[] = []
	if (row.detached) chips.push(t('panel.detached'))
	if (row.branchMismatch) chips.push(t('panel.branchMismatch'))
	if (row.duplicateBranch) chips.push(t('panel.duplicateBranch'))
	const dirty = Object.values(row.changes).some(Boolean)
	if (dirty) chips.push(t('panel.dirty'))
	if (row.upstream !== null && row.upstream.ahead > 0) chips.push(t('panel.ahead', { n: row.upstream.ahead }))
	if (row.upstream !== null && row.upstream.behind > 0) chips.push(t('panel.behind', { n: row.upstream.behind }))
	return chips
}

export interface WorktreeRowViewProps {
	readonly row: WorktreeRow
	readonly t: Translate
	readonly expanded: boolean
	readonly selected: boolean
	readonly isCurrentSession: boolean
	readonly sessionLabel: (sessionId: SessionId) => string
	readonly onToggle: () => void
	readonly onSelect: () => void
	readonly onOpenSession: (sessionId: SessionId) => void
	readonly onNewSession: () => void
	readonly onCopyPath: () => void
	readonly onSyncIgnored: () => void
	readonly onMerge: () => void
	readonly onRemove: () => void
}

/** One worktree row with `[current]`, HEAD, chips, and its session list. */
export function WorktreeRowView(props: WorktreeRowViewProps): ReactElement {
	const { row, t } = props
	const label = row.isMain ? t('panel.local') : row.branch
	return (
		<div className="wt-row" data-current={props.isCurrentSession ? 'true' : undefined} data-selected={props.selected ? 'true' : undefined}>
			<button type="button" className="wt-row-main" onClick={props.onSelect} aria-expanded={props.expanded}>
				<span className="wt-row-label">{label}</span>
				{props.isCurrentSession ? <span className="wt-row-mark">{t('panel.current')}</span> : null}
				{row.head === null ? null : <span className="wt-row-head">{`${row.head.shortSha} ${row.head.subject}`}</span>}
			</button>
			<button type="button" className="wt-row-toggle" aria-label={t('panel.sessions')} onClick={props.onToggle}>
				{`${t('panel.sessions')} (${row.sessions.length})`}
			</button>
			<div className="wt-row-chips">
				{rowChips(row, t).map(chip => <span className="wt-chip" key={chip}>{chip}</span>)}
			</div>
			<div className="wt-row-actions">
				<button type="button" onClick={props.onNewSession}>{t('panel.newSession')}</button>
				<button type="button" onClick={props.onCopyPath}>{t('panel.copyPath')}</button>
				<button type="button" onClick={props.onSyncIgnored}>{t('panel.syncIgnored')}</button>
				{row.detached ? null : <button type="button" onClick={props.onMerge}>{t('panel.merge')}</button>}
				{row.isMain ? null : <button type="button" onClick={props.onRemove}>{t('panel.remove')}</button>}
			</div>
			{props.expanded
				? (
					<ul className="wt-sessions">
						{row.sessions.length === 0 ? <li className="wt-session-empty">{t('panel.noSessions')}</li> : null}
						{row.sessions.map(session => (
							<li key={session.id}>
								<button type="button" onClick={() => props.onOpenSession(session.id as SessionId)}>{props.sessionLabel(session.id as SessionId)}</button>
							</li>
						))}
					</ul>
				)
				: null}
		</div>
	)
}
```

```tsx
// src/client/PanelIcon.tsx
/** The sidebar glyph for the worktruck panel entry. */
import type { ReactElement } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

/** Renders the branch glyph at the sidebar-requested size. */
export function PanelIcon({ size, active }: PropsRuntime<'sidebar.panellist'>): ReactElement {
	return (
		<svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" data-active={active ? 'true' : undefined}>
			<path d="M4 2v9a2 2 0 0 0 2 2h3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
			<circle cx="4" cy="2.5" r="1.5" fill="currentColor" />
			<circle cx="11" cy="13" r="1.5" fill="currentColor" />
			<circle cx="11" cy="5.5" r="1.5" fill="currentColor" />
			<path d="M11 7v4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
		</svg>
	)
}
```

```tsx
// src/client/panel/WorktreePanel.tsx
/**
 * Panel body: header, worktree list, and the empty/loading/error states. Dialogs
 * are owned by the routing component in `entry.ts`; this file renders rows.
 */
import { useState, useSyncExternalStore, type ReactElement } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorktrunkConnection } from '../connection.js'
import { worktreeErrorMessageKey, type PanelStore } from '../store.js'
import { WorktreeRowView } from './rows.js'

export interface WorktreePanelProps {
	readonly store: PanelStore
	readonly connection: WorktrunkConnection
	readonly t: Translate
	readonly currentSessionCwd?: string
	readonly sessionLabel?: (sessionId: SessionId) => string
	readonly openSession: (sessionId: SessionId) => void
	readonly onCreate: () => void
	readonly onMerge?: (row: unknown) => void
	readonly onRemove?: (row: unknown) => void
	readonly onNewSession?: (row: unknown) => void
	readonly onSyncIgnored?: (row: unknown) => void
}

/** Panel body. */
export function WorktreePanel(props: WorktreePanelProps): ReactElement {
	const state = useSyncExternalStore(props.store.subscribe, props.store.getSnapshot, props.store.getSnapshot)
	const [expanded, setExpanded] = useState<readonly string[]>([])

	if (state.loading && state.repo === undefined) return <div className="wt-panel-loading">{props.t('panel.loading')}</div>
	if (state.error !== undefined && state.rows.length === 0) {
		return (
			<div className="wt-panel-error">
				<p>{props.t(worktreeErrorMessageKey(state.error), { reason: state.error.message })}</p>
				{state.error.retryable && state.workspaceId !== undefined
					? <button type="button" onClick={() => { void props.store.load(state.workspaceId as string) }}>{props.t('panel.retry')}</button>
					: null}
			</div>
		)
	}

	return (
		<div className="wt-panel">
			<header className="wt-panel-header">
				<h2>{state.repo?.forge ?? state.repo?.root ?? props.t('panel.title')}</h2>
				<span className="wt-panel-default">{state.repo?.defaultBranch ?? ''}</span>
				{state.workspaceId === undefined ? null : (
					<button type="button" onClick={() => { void props.store.load(state.workspaceId as string) }}>{props.t('panel.refresh')}</button>
				)}
				<button type="button" onClick={props.onCreate}>{props.t('panel.create')}</button>
			</header>
			{state.error !== undefined && state.rows.length > 0
				? <p className="wt-panel-stale">{props.t(worktreeErrorMessageKey(state.error), { reason: state.error.message })}</p>
				: null}
			{state.rows.length === 0
				? <p className="wt-panel-empty">{props.t('panel.empty')}</p>
				: null}
			<ul className="wt-rows">
				{state.rows.map(row => (
					<li key={row.path}>
						<WorktreeRowView
							row={row}
							t={props.t}
							expanded={expanded.includes(row.path)}
							selected={props.store.getSelection() === row.path}
							isCurrentSession={props.currentSessionCwd !== undefined && (props.currentSessionCwd === row.path || props.currentSessionCwd.startsWith(`${row.path}/`))}
							sessionLabel={props.sessionLabel ?? (sessionId => String(sessionId))}
							onToggle={() => setExpanded(current => (current.includes(row.path) ? current.filter(path => path !== row.path) : [...current, row.path]))}
							onSelect={() => props.store.setSelection(row.path)}
							onOpenSession={props.openSession}
							onNewSession={() => props.onNewSession?.(row)}
							onCopyPath={() => { void navigator.clipboard?.writeText(row.path) }}
							onSyncIgnored={() => props.onSyncIgnored?.(row)}
							onMerge={() => props.onMerge?.(row)}
							onRemove={() => props.onRemove?.(row)}
						/>
					</li>
				))}
			</ul>
		</div>
	)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/client-panel-render.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/client/panel src/client/PanelIcon.tsx tests/client-panel-render.test.ts
git commit -m "feat(worktrunk): render the worktree panel"
```

---

## Task 14: Create dialog with the hook preview

**Files:**
- Create: `src/client/panel/CreateDialog.tsx`
- Test: `tests/client-create-dialog.test.ts`

**Interfaces:**
- Consumes: `HookSpec`, `Translate`, `WorktrunkConnection`.
- Produces: `CreateDialog(props)`, `createDialogSummary(hooks, t): { title: string, lines: readonly string[], blocking: boolean }`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/client-create-dialog.test.ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CreateDialog, createDialogSummary } from '../src/client/panel/CreateDialog.js'
import type { HookSpec } from '../src/contract.js'

const t = (key: string, params?: Record<string, unknown>) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`)

const hooks: readonly HookSpec[] = [
  { name: 'install', type: 'pre-start', template: 'mise install', source: 'project', needsApproval: true },
  { name: 'copy', type: 'post-start', template: 'wt step copy-ignored', source: 'project', needsApproval: true },
]

describe('create dialog', () => {
  it('summarizes pre-start hooks as blocking and lists every hook', () => {
    const summary = createDialogSummary(hooks, t as never)
    expect(summary.blocking).toBe(true)
    expect(summary.lines).toEqual(['pre-start install: mise install', 'post-start copy: wt step copy-ignored'])
  })

  it('reports no blocking step for post-start-only configuration', () => {
    expect(createDialogSummary([hooks[1]!], t as never).blocking).toBe(false)
  })

  it('renders the skip toggle and every hook command, and omits the toggle when nothing is configured', () => {
    const withHooks = renderToStaticMarkup(createElement(CreateDialog, {
      repo: { root: '/repo', defaultBranch: 'main', forge: null }, hooks, defaultBranch: 'main', currentBranch: 'main',
      t: t as never, onCancel: () => undefined, onSubmit: () => undefined,
    }))
    expect(withHooks).toContain('create.skipHooks')
    expect(withHooks).toContain('mise install')
    expect(withHooks).toContain('wt step copy-ignored')
    expect(withHooks).toContain('create.blocking')

    const withoutHooks = renderToStaticMarkup(createElement(CreateDialog, {
      repo: { root: '/repo', defaultBranch: 'main', forge: null }, hooks: [], defaultBranch: 'main',
      t: t as never, onCancel: () => undefined, onSubmit: () => undefined,
    }))
    expect(withoutHooks).toContain('create.noHooks')
    expect(withoutHooks).not.toContain('create.skipHooks')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/client-create-dialog.test.ts`
Expected: FAIL — cannot resolve `../src/client/panel/CreateDialog.js`.

- [ ] **Step 3: Write the dialog**

```tsx
// src/client/panel/CreateDialog.tsx
/**
 * Create form. The hook list is the approval step `wt` would otherwise prompt
 * for, because creation runs with `--yes`; the toggle maps to `--no-hooks`.
 */
import { useState, type ReactElement } from 'react'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type { HookSpec, RepoFacts } from '../../contract.js'

/** Hook preview summary: one line per hook, plus whether creation will block. */
export function createDialogSummary(
	hooks: readonly HookSpec[],
	t: Translate,
): { title: string, lines: readonly string[], blocking: boolean } {
	return {
		title: hooks.length === 0 ? t('create.noHooks') : t('create.hooks'),
		lines: hooks.map(hook => `${hook.type} ${hook.name}: ${hook.template}`),
		blocking: hooks.some(hook => hook.type === 'pre-start'),
	}
}

export interface CreateDialogProps {
	readonly repo: RepoFacts
	readonly hooks: readonly HookSpec[]
	readonly defaultBranch: string
	readonly currentBranch?: string
	readonly t: Translate
	readonly pending?: boolean
	readonly errorKey?: string
	readonly onCancel: () => void
	readonly onSubmit: (input: { branch: string, base?: string, skipHooks: boolean }) => void
}

/** Create-worktree dialog. */
export function CreateDialog(props: CreateDialogProps): ReactElement {
	const { t, hooks } = props
	const [branch, setBranch] = useState('')
	const [base, setBase] = useState(props.defaultBranch)
	const [skipHooks, setSkipHooks] = useState(false)
	const summary = createDialogSummary(hooks, t)
	const canSubmit = branch.trim() !== '' && props.pending !== true

	return (
		<form
			className="wt-dialog wt-dialog-create"
			onSubmit={(event) => {
				event.preventDefault()
				if (!canSubmit) return
				const base2 = base.trim()
				props.onSubmit({ branch: branch.trim(), ...(base2 === '' ? {} : { base: base2 }), skipHooks })
			}}
		>
			<h3>{t('create.title')}</h3>
			<p>{t('create.description', { repo: props.repo.forge ?? props.repo.root })}</p>
			<label>
				{t('create.branch')}
				<input value={branch} onChange={event => setBranch(event.target.value)} placeholder="feature/next" autoFocus />
			</label>
			<label>
				{t('create.base')}
				<select value={base} onChange={event => setBase(event.target.value)}>
					{props.currentBranch === undefined ? null : <option value={props.currentBranch}>{t('create.baseCurrent', { branch: props.currentBranch })}</option>}
					<option value={props.defaultBranch}>{props.defaultBranch}</option>
				</select>
			</label>
			<section className="wt-hooks">
				<h4>{summary.title}</h4>
				{summary.lines.length === 0 ? null : (
					<ul>{summary.lines.map(line => <li key={line}><code>{line}</code></li>)}</ul>
				)}
				{summary.blocking ? <p className="wt-hooks-blocking">{t('create.blocking')}</p> : null}
				{hooks.length === 0 ? null : (
					<label className="wt-hooks-skip">
						<input type="checkbox" checked={skipHooks} onChange={event => setSkipHooks(event.target.checked)} />
						{t('create.skipHooks')}
					</label>
				)}
			</section>
			{props.pending === true ? <p className="wt-dialog-working">{t('create.working')}</p> : null}
			{props.errorKey === undefined ? null : <p className="wt-dialog-error">{t(props.errorKey)}</p>}
			<footer>
				<button type="button" onClick={props.onCancel}>{t('create.cancel')}</button>
				<button type="submit" disabled={!canSubmit}>{t('create.submit')}</button>
			</footer>
		</form>
	)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/client-create-dialog.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/client/panel/CreateDialog.tsx tests/client-create-dialog.test.ts
git commit -m "feat(worktrunk): create dialog with the wt.toml hook preview"
```

---

## Task 15: Remove dialog with the wt gates

**Files:**
- Create: `src/client/panel/RemoveDialog.tsx`
- Test: `tests/client-remove-dialog.test.ts`

**Interfaces:**
- Consumes: `WorktreeRow`, `Translate`.
- Produces: `removeDialogFacts(row, t): { lines: readonly string[], needsForce: boolean, canDeleteBranch: boolean }`, `RemoveDialog(props)`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/client-remove-dialog.test.ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RemoveDialog, removeDialogFacts } from '../src/client/panel/RemoveDialog.js'
import type { WorktreeRow } from '../src/contract.js'

const t = (key: string, params?: Record<string, unknown>) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`)
const clean = { staged: false, modified: false, untracked: false, renamed: false, deleted: false, conflicted: false }
const row = (overrides: Partial<WorktreeRow> = {}): WorktreeRow => ({
  path: '/wt/a', branch: 'feature/a', isMain: false, isCurrent: false, detached: false, branchMismatch: false, duplicateBranch: false,
  head: null, changes: clean, upstream: null, sessions: [], registered: true, ...overrides,
})

describe('remove dialog', () => {
  it('requires force for a dirty worktree and names the changes', () => {
    const facts = removeDialogFacts(row({ changes: { ...clean, modified: true, untracked: true } }), t as never)
    expect(facts.needsForce).toBe(true)
    expect(facts.canDeleteBranch).toBe(true)
    expect(facts.lines).toContain('remove.dirty')
  })

  it('never offers branch deletion for a detached HEAD', () => {
    const facts = removeDialogFacts(row({ detached: true }), t as never)
    expect(facts.canDeleteBranch).toBe(false)
    expect(facts.lines).toContain('remove.detached')
  })

  it('renders the path, the branch, and the unmerged-branch choice', () => {
    const html = renderToStaticMarkup(createElement(RemoveDialog, {
      row: row({ changes: { ...clean, modified: true } }), unmerged: true, t: t as never, onCancel: () => undefined, onSubmit: () => undefined,
    }))
    expect(html).toContain('/wt/a')
    expect(html).toContain('feature/a')
    expect(html).toContain('remove.force')
    expect(html).toContain('remove.forceDeleteBranch')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/client-remove-dialog.test.ts`
Expected: FAIL — cannot resolve `../src/client/panel/RemoveDialog.js`.

- [ ] **Step 3: Write the dialog**

```tsx
// src/client/panel/RemoveDialog.tsx
/**
 * Removal confirmation. `wt` owns the gates; this dialog only states them, so
 * the two choices it offers map one-to-one onto `--force` and `--force-delete`.
 */
import { useState, type ReactElement } from 'react'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorktreeRow } from '../../contract.js'

/** What the dialog must tell the user, and which gates apply. */
export function removeDialogFacts(
	row: WorktreeRow,
	t: Translate,
): { lines: readonly string[], needsForce: boolean, canDeleteBranch: boolean } {
	const lines: string[] = []
	const dirty = Object.values(row.changes).some(Boolean)
	if (dirty) lines.push(t('remove.dirty'))
	if (row.detached) lines.push(t('remove.detached'))
	if (row.branchMismatch) lines.push(t('panel.branchMismatch'))
	if (row.sessions.length > 0) lines.push(t('panel.sessions'))
	return { lines, needsForce: dirty, canDeleteBranch: !row.detached }
}

export interface RemoveDialogProps {
	readonly row: WorktreeRow
	readonly unmerged: boolean
	readonly t: Translate
	readonly pending?: boolean
	readonly errorKey?: string
	readonly onCancel: () => void
	readonly onSubmit: (input: { force: boolean, forceDeleteBranch: boolean, keepBranch: boolean }) => void
}

/** Remove-worktree dialog. */
export function RemoveDialog(props: RemoveDialogProps): ReactElement {
	const { row, t } = props
	const facts = removeDialogFacts(row, t)
	const [force, setForce] = useState(false)
	const [forceDeleteBranch, setForceDeleteBranch] = useState(false)
	const [keepBranch, setKeepBranch] = useState(false)
	const blocked = facts.needsForce && !force

	return (
		<form
			className="wt-dialog wt-dialog-remove"
			onSubmit={(event) => {
				event.preventDefault()
				if (blocked) return
				props.onSubmit({ force, forceDeleteBranch, keepBranch })
			}}
		>
			<h3>{t('remove.title')}</h3>
			<p>{t('remove.description', { branch: row.branch, path: row.path })}</p>
			{facts.lines.length === 0 ? null : <ul>{facts.lines.map(line => <li key={line}>{line}</li>)}</ul>}
			{facts.needsForce
				? (
					<label>
						<input type="checkbox" checked={force} onChange={event => setForce(event.target.checked)} />
						{t('remove.force')}
					</label>
				)
				: null}
			{facts.canDeleteBranch && props.unmerged
				? (
					<label>
						<input type="checkbox" checked={forceDeleteBranch} onChange={event => setForceDeleteBranch(event.target.checked)} />
						{t('remove.forceDeleteBranch')}
					</label>
				)
				: null}
			{facts.canDeleteBranch && !props.unmerged
				? (
					<label>
						<input type="checkbox" checked={keepBranch} onChange={event => setKeepBranch(event.target.checked)} />
						{t('remove.keepBranch')}
					</label>
				)
				: null}
			{props.errorKey === undefined ? null : <p className="wt-dialog-error">{t(props.errorKey)}</p>}
			<footer>
				<button type="button" onClick={props.onCancel}>{t('remove.cancel')}</button>
				<button type="submit" disabled={blocked || props.pending === true}>{t('remove.submit')}</button>
			</footer>
		</form>
	)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/client-remove-dialog.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/client/panel/RemoveDialog.tsx tests/client-remove-dialog.test.ts
git commit -m "feat(worktrunk): remove dialog with the wt force gates"
```

---

## Task 16: Merge dialog

**Files:**
- Create: `src/client/panel/MergeDialog.tsx`
- Test: `tests/client-merge-dialog.test.ts`

**Interfaces:**
- Consumes: `HookSpec`, `WorktreeRow`, `Translate`.
- Produces: `mergeHooks(hooks, t): readonly string[]`, `MergeDialog(props)`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/client-merge-dialog.test.ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MergeDialog, mergeHooks } from '../src/client/panel/MergeDialog.js'
import type { HookSpec, WorktreeRow } from '../src/contract.js'

const t = (key: string, params?: Record<string, unknown>) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`)
const clean = { staged: false, modified: false, untracked: false, renamed: false, deleted: false, conflicted: false }
const row: WorktreeRow = { path: '/wt/a', branch: 'feature/a', isMain: false, isCurrent: false, detached: false, branchMismatch: false, duplicateBranch: false,
  head: null, changes: clean, upstream: null, sessions: [], registered: true }
const hooks: readonly HookSpec[] = [
  { name: 'test', type: 'pre-merge', template: 'pnpm test', source: 'project', needsApproval: true },
  { name: 'install', type: 'pre-start', template: 'mise install', source: 'project', needsApproval: true },
]

describe('merge dialog', () => {
  it('lists only pre-merge hooks', () => {
    expect(mergeHooks(hooks, t as never)).toEqual(['pre-merge test: pnpm test'])
  })

  it('renders the default target, both keep options, and the pre-merge hook', () => {
    const html = renderToStaticMarkup(createElement(MergeDialog, {
      row, defaultBranch: 'main', hooks, isCurrentSessionWorktree: true, t: t as never, onCancel: () => undefined, onSubmit: () => undefined,
    }))
    expect(html).toContain('main')
    expect(html).toContain('merge.keepCommit')
    expect(html).toContain('merge.keepWorktree')
    expect(html).toContain('pnpm test')
    expect(html).toContain('merge.hooks')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/client-merge-dialog.test.ts`
Expected: FAIL — cannot resolve `../src/client/panel/MergeDialog.js`.

- [ ] **Step 3: Write the dialog**

```tsx
// src/client/panel/MergeDialog.tsx
/**
 * Merge form. `wt merge` runs with the worktree as cwd, squashes and rebases,
 * fast-forwards the target, and removes the worktree unless told to keep it.
 */
import { useState, type ReactElement } from 'react'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type { HookSpec, WorktreeRow } from '../../contract.js'

/** One line per pre-merge hook. */
export function mergeHooks(hooks: readonly HookSpec[], t: Translate): readonly string[] {
	return hooks.filter(hook => hook.type === 'pre-merge').map(hook => `${hook.type} ${hook.name}: ${hook.template}`)
}

export interface MergeDialogProps {
	readonly row: WorktreeRow
	readonly defaultBranch: string
	readonly hooks: readonly HookSpec[]
	readonly isCurrentSessionWorktree: boolean
	readonly t: Translate
	readonly pending?: boolean
	readonly errorKey?: string
	readonly onCancel: () => void
	readonly onSubmit: (input: { target: string, keepCommit: boolean, keepWorktree: boolean }) => void
}

/** Merge-worktree dialog. */
export function MergeDialog(props: MergeDialogProps): ReactElement {
	const { row, t } = props
	const lines = mergeHooks(props.hooks, t)
	const [target, setTarget] = useState(props.defaultBranch)
	const [keepCommit, setKeepCommit] = useState(false)
	const [keepWorktree, setKeepWorktree] = useState(props.isCurrentSessionWorktree)

	return (
		<form
			className="wt-dialog wt-dialog-merge"
			onSubmit={(event) => {
				event.preventDefault()
				props.onSubmit({ target: target.trim() === '' ? props.defaultBranch : target.trim(), keepCommit, keepWorktree })
			}}
		>
			<h3>{t('merge.title')}</h3>
			<p>{t('merge.description', { branch: row.branch, target })}</p>
			<label>
				{t('merge.target')}
				<input value={target} onChange={event => setTarget(event.target.value)} />
			</label>
			<label>
				<input type="checkbox" checked={keepCommit} onChange={event => setKeepCommit(event.target.checked)} />
				{t('merge.keepCommit')}
			</label>
			<label>
				<input type="checkbox" checked={keepWorktree} onChange={event => setKeepWorktree(event.target.checked)} />
				{t('merge.keepWorktree')}
			</label>
			{lines.length === 0 ? null : (
				<section className="wt-hooks">
					<h4>{t('merge.hooks')}</h4>
					<ul>{lines.map(line => <li key={line}><code>{line}</code></li>)}</ul>
				</section>
			)}
			{props.errorKey === undefined ? null : <p className="wt-dialog-error">{t(props.errorKey)}</p>}
			<footer>
				<button type="button" onClick={props.onCancel}>{t('merge.cancel')}</button>
				<button type="submit" disabled={props.pending === true}>{t('merge.submit')}</button>
			</footer>
		</form>
	)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/client-merge-dialog.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/client/panel/MergeDialog.tsx tests/client-merge-dialog.test.ts
git commit -m "feat(worktrunk): merge dialog with pre-merge hook preview"
```

---

## Task 17: Permission dialog, session flow, and slot registration

**Files:**
- Create: `src/client/panel/PermissionDialog.tsx`
- Create: `src/client/entry.ts`
- Test: `tests/client-entry.test.ts`

**Interfaces:**
- Consumes: `WorktreePanel`, `CreateDialog`, `RemoveDialog`, `MergeDialog`, `PermissionDialog`, `PanelIcon`, `createWorktrunkConnection`, `createPanelStore`, `WORKTRUNK_NS`, `en`.
- Produces: `name = 'dsh-worktrunk-client'`, `inject`, `apply(ctx)`, `describePermissionOutcome(status): { key: string, openSession: boolean, retryable: boolean }`, `PermissionDialog(props)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/client-entry.test.ts
import { describe, expect, it } from 'vitest'
import { apply, describePermissionOutcome, inject, name } from '../src/client/entry.js'

function fakeClientCtx() {
  const registered: Array<{ name: string, options: Record<string, unknown> }> = []
  const effects: Array<() => void> = []
  const ctx = {
    connection: { call: async () => ({ ok: true, value: { ok: true, value: {} } }) },
    locale: { register: () => () => undefined, bind: () => (key: string) => key },
    sessions: { list: { getSnapshot: () => ({ sessions: [] }), subscribe: () => () => undefined }, create: async () => 's1', open: () => undefined },
    workspaces: { list: { getSnapshot: () => ({ workspaces: [] }), subscribe: () => () => undefined } },
    effect: (fn: () => (() => void)) => { effects.push(fn()) },
    slots: {
      inject: (slot: string, callback: () => unknown) => { void slot; callback() },
      register: (options: Record<string, unknown>) => { registered.push({ name: String(options.name), options }); return () => undefined },
    },
  }
  return { ctx, registered, effects }
}

describe('client entry', () => {
  it('registers the panel icon and the keyed main panel under one id', () => {
    const { ctx, registered } = fakeClientCtx()
    apply(ctx as never)
    const names = registered.map(entry => entry.name)
    expect(names).toEqual(['sidebar.panellist', 'main'])
    expect(registered[0]?.options.id).toBe('worktrunk')
    expect(registered[1]?.options.key).toBe('worktrunk')
    expect(typeof registered[0]?.options.label).toBe('function')
  })

  it('declares the services it needs and a plugin name', () => {
    expect(name).toBe('dsh-worktrunk-client')
    expect(inject).toEqual(expect.arrayContaining(['connection', 'locale', 'slots', 'sessions']))
  })

  it('decides what each permission outcome means for opening the session', () => {
    expect(describePermissionOutcome('applied')).toEqual({ key: 'permission.applied', openSession: true, retryable: false })
    expect(describePermissionOutcome('already-full-access')).toEqual({ key: 'permission.applied', openSession: true, retryable: false })
    expect(describePermissionOutcome('user-restricted')).toEqual({ key: 'permission.userRestricted', openSession: true, retryable: false })
    expect(describePermissionOutcome('unavailable')).toEqual({ key: 'permission.unavailable', openSession: false, retryable: true })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/client-entry.test.ts`
Expected: FAIL — cannot resolve `../src/client/entry.js`.

- [ ] **Step 3a: Write the permission dialog**

```tsx
// src/client/panel/PermissionDialog.tsx
/**
 * The acknowledgement step before a session inside a worktree is elevated. It
 * states the mechanism, the blast radius, and what does not change.
 */
import { useState, type ReactElement } from 'react'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'

export interface PermissionDialogProps {
	readonly cwd: string
	readonly t: Translate
	readonly onCancel: () => void
	readonly onConfirm: () => void
}

/** Full-access acknowledgement dialog. */
export function PermissionDialog(props: PermissionDialogProps): ReactElement {
	const { t } = props
	const [acknowledged, setAcknowledged] = useState(false)
	return (
		<form
			className="wt-dialog wt-dialog-permission"
			onSubmit={(event) => {
				event.preventDefault()
				if (acknowledged) props.onConfirm()
			}}
		>
			<h3>{t('permission.title')}</h3>
			<p>{t('permission.description', { cwd: props.cwd })}</p>
			<label>
				<input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />
				{t('permission.acknowledge')}
			</label>
			<footer>
				<button type="button" onClick={props.onCancel}>{t('permission.cancel')}</button>
				<button type="submit" disabled={!acknowledged}>{t('permission.enable')}</button>
			</footer>
		</form>
	)
}
```

- [ ] **Step 3b: Write the entry**

```ts
// src/client/entry.ts
/**
 * Browser half of dsh-worktrunk. It registers one sidebar panel entry and the
 * matching keyed main panel, and it owns the panel's dialog routing, session
 * creation, and the full-access confirmation flow.
 */
import { createElement, useEffect, useState } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from './locale.js'
import { WORKTRUNK_NS, en } from './locale.js'
import { createWorktrunkConnection } from './connection.js'
import { createPanelStore, worktreeErrorMessageKey, type PanelStore } from './store.js'
import { WorktreePanel } from './panel/WorktreePanel.js'
import { CreateDialog } from './panel/CreateDialog.js'
import { RemoveDialog } from './panel/RemoveDialog.js'
import { MergeDialog } from './panel/MergeDialog.js'
import { PermissionDialog } from './panel/PermissionDialog.js'
import { PanelIcon } from './PanelIcon.js'
import type { HookSpec, PanelSnapshot, WorktreeRow } from '../contract.js'

/** Panel identity shared by the sidebar entry and the main-column occupant. */
export const WORKTRUNK_PANEL_ID = 'worktrunk' as const
/** Sidebar row order, after the shipped entries. */
export const WORKTRUNK_PANEL_ORDER = 20

/** What a permission outcome means for the session. */
export function describePermissionOutcome(status: string): { key: string, openSession: boolean, retryable: boolean } {
	switch (status) {
		case 'applied':
		case 'already-full-access':
			return { key: 'permission.applied', openSession: true, retryable: false }
		case 'user-restricted':
			return { key: 'permission.userRestricted', openSession: true, retryable: false }
		default:
			return { key: 'permission.unavailable', openSession: false, retryable: true }
	}
}

export const name = 'dsh-worktrunk-client'
export const inject = ['connection', 'locale', 'slots', 'sessions', 'workspaces']

/** Register both slots and wire the panel. */
export function apply(ctx: ClientContext): void {
	const t = ctx.locale.bind(WORKTRUNK_NS) as Translate
	ctx.effect(() => ctx.locale.register(WORKTRUNK_NS, 'en', en), 'dsh-worktrunk: locale dictionary')

	const connection = createWorktrunkConnection(ctx.connection as never)
	ctx.effect(() => () => connection.dispose(), 'dsh-worktrunk: connection disposal')

	const store = createPanelStore(connection)
	ctx.effect(() => () => store.dispose(), 'dsh-worktrunk: panel store disposal')

	const currentWorkspaceId = (): string | undefined => {
		const snapshot = ctx.workspaces.list.getSnapshot() as unknown as { current?: { id?: string }, workspaces?: readonly { id: string }[] }
		return snapshot.current?.id ?? snapshot.workspaces?.[0]?.id
	}
	const currentSessionCwd = (): string | undefined => {
		const snapshot = ctx.sessions.list.getSnapshot() as unknown as { current?: { cwd?: string } }
		return snapshot.current?.cwd
	}
	const sessionLabel = (sessionId: SessionId): string => {
		const snapshot = ctx.sessions.list.getSnapshot() as unknown as { sessions?: readonly { id: string, title?: string }[] }
		return snapshot.sessions?.find(session => session.id === sessionId)?.title ?? String(sessionId)
	}

	const Body = () => {
		const [dialog, setDialog] = useState<{ kind: 'none' } | { kind: 'create' } | { kind: 'remove', row: WorktreeRow, unmerged: boolean } | { kind: 'merge', row: WorktreeRow } | { kind: 'permission', cwd: string, sessionId: string }>({ kind: 'none' })
		const [hooks, setHooks] = useState<readonly HookSpec[]>([])
		const [errorKey, setErrorKey] = useState<string | undefined>(undefined)

		useEffect(() => {
			const workspaceId = currentWorkspaceId()
			if (workspaceId !== undefined) void store.load(workspaceId)
		}, [])

		const submitCreate = (input: { branch: string, base?: string, skipHooks: boolean }) => {
			const workspaceId = currentWorkspaceId()
			if (workspaceId === undefined) return
			setErrorKey(undefined)
			void connection.createWorktree({ workspaceId, ...input })
				.then(() => store.load(workspaceId))
				.then(() => setDialog({ kind: 'none' }))
				.catch(error => setErrorKey(worktreeErrorMessageKey(error)))
		}

		const startSession = (worktreePath: string) => {
			setDialog({ kind: 'permission', cwd: worktreePath, sessionId: '' })
		}

		const confirmPermission = (cwd: string) => {
			void (async () => {
				try {
					const sessionId = String(await (ctx.sessions as unknown as { create(input: { cwd: string }): Promise<unknown> }).create({ cwd }))
					const result = await connection.ensureWorktreePermission({ sessionId })
					const outcome = describePermissionOutcome(result.status)
					setErrorKey(outcome.key === 'permission.applied' ? undefined : outcome.key)
					if (outcome.openSession) (ctx.sessions as unknown as { open(id: SessionId): void }).open(sessionId as SessionId)
				} catch (error) {
					setErrorKey(worktreeErrorMessageKey(error))
				} finally {
					setDialog({ kind: 'none' })
				}
			})()
		}

		return createElement('div', { className: 'wt-panel-host' },
			createElement(WorktreePanel, {
				store,
				connection,
				t,
				currentSessionCwd: currentSessionCwd(),
				sessionLabel,
				openSession: sessionId => (ctx.sessions as unknown as { open(id: SessionId): void }).open(sessionId),
				onCreate: () => {
					const workspaceId = currentWorkspaceId()
					if (workspaceId === undefined) return
					void connection.previewHooks({ workspaceId }).then(setHooks).catch(() => setHooks([]))
					setDialog({ kind: 'create' })
				},
				onNewSession: row => startSession((row as WorktreeRow).path),
				onSyncIgnored: row => {
					const workspaceId = currentWorkspaceId()
					if (workspaceId !== undefined) void connection.copyIgnored({ workspaceId, path: (row as WorktreeRow).path })
				},
				onMerge: row => setDialog({ kind: 'merge', row: row as WorktreeRow }),
				onRemove: row => setDialog({ kind: 'remove', row: row as WorktreeRow, unmerged: false }),
			}),
			dialog.kind === 'create'
				? createElement(CreateDialog, {
					repo: (store.getSnapshot().repo ?? { root: '', defaultBranch: 'main', forge: null }) as PanelSnapshot['repo'],
					hooks,
					defaultBranch: store.getSnapshot().repo?.defaultBranch ?? 'main',
					t,
					errorKey,
					onCancel: () => setDialog({ kind: 'none' }),
					onSubmit: submitCreate,
				})
				: null,
			dialog.kind === 'remove'
				? createElement(RemoveDialog, {
					row: dialog.row,
					unmerged: dialog.unmerged,
					t,
					errorKey,
					onCancel: () => setDialog({ kind: 'none' }),
					onSubmit: (input) => {
						const workspaceId = currentWorkspaceId()
						if (workspaceId === undefined) return
						void connection.removeWorktree({ workspaceId, branch: dialog.row.branch, ...input, currentCwd: currentSessionCwd() })
							.then(() => store.load(workspaceId))
							.then(() => setDialog({ kind: 'none' }))
							.catch(error => setErrorKey(worktreeErrorMessageKey(error)))
					},
				})
				: null,
			dialog.kind === 'merge'
				? createElement(MergeDialog, {
					row: dialog.row,
					defaultBranch: store.getSnapshot().repo?.defaultBranch ?? 'main',
					hooks: store.getSnapshot().hooks,
					isCurrentSessionWorktree: currentSessionCwd() === dialog.row.path,
					t,
					errorKey,
					onCancel: () => setDialog({ kind: 'none' }),
					onSubmit: (input) => {
						const workspaceId = currentWorkspaceId()
						if (workspaceId === undefined) return
						void connection.mergeWorktree({ workspaceId, branch: dialog.row.branch, ...input, currentCwd: currentSessionCwd() })
							.then(() => store.load(workspaceId))
							.then(() => setDialog({ kind: 'none' }))
							.catch(error => setErrorKey(worktreeErrorMessageKey(error)))
					},
				})
				: null,
			dialog.kind === 'permission'
				? createElement(PermissionDialog, {
					cwd: dialog.cwd,
					t,
					onCancel: () => setDialog({ kind: 'none' }),
					onConfirm: () => confirmPermission(dialog.cwd),
				})
				: null,
			errorKey !== undefined && store.getSnapshot().error !== undefined
				? createElement('p', { className: 'wt-panel-notice' }, t(errorKey as never))
				: null,
		)
	}

	ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
		name: 'sidebar.panellist',
		id: WORKTRUNK_PANEL_ID,
		order: WORKTRUNK_PANEL_ORDER,
		label: () => t('panel.label'),
	}, PanelIcon as never))

	ctx.slots.inject('main', () => ctx.slots.register({
		name: 'main',
		key: WORKTRUNK_PANEL_ID,
		locale: WORKTRUNK_NS,
		inject: () => ({ store }),
	}, Body as never))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run` then `pnpm build`
Expected: PASS for the whole suite; `pnpm build` emits `lib/index.js`, `lib/client.js`, `lib/typert.host.js`, `lib/typert.remote-client.js`.

- [ ] **Step 5: Commit**

```bash
git add src/client/entry.ts src/client/panel/PermissionDialog.tsx tests/client-entry.test.ts
git commit -m "feat(worktrunk): register the panel and the full-access session flow"
```

---

## Task 18: Module boundary test, README, and end-to-end verification

**Files:**
- Test: `tests/module-boundary.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: `tests/module-boundary.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/module-boundary.test.ts
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const files = (dir: string): string[] => readdirSync(dir).flatMap(name => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? files(path) : path.endsWith('.ts') || path.endsWith('.tsx') ? [path] : []
})

const source = (path: string) => readFileSync(path, 'utf8')
const clientFiles = files('src/client')
const hostFiles = files('src/host')

describe('module boundaries', () => {
  it('keeps contract.ts free of imports', () => {
    expect(source('src/contract.ts')).not.toMatch(/^import /m)
  })

  it('keeps the browser half out of host and wt code', () => {
    for (const path of clientFiles) {
      expect(source(path), path).not.toMatch(/from '\.\.\/(host|wt)\.js'/)
    }
  })

  it('keeps the host half out of the browser half', () => {
    for (const path of hostFiles) {
      expect(source(path), path).not.toMatch(/from '\.\.\/client\//)
    }
  })

  it('never spawns a process or calls git from the browser half', () => {
    for (const path of clientFiles) {
      const text = source(path)
      expect(text, path).not.toMatch(/\bchild_process\b/)
      expect(text, path).not.toMatch(/['"`]git['"`]/)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails, then passes**

Run: `pnpm vitest run tests/module-boundary.test.ts`
Expected: PASS once the boundaries hold. If a boundary fails, move the offending import rather than relaxing the test.

- [ ] **Step 3: Correct the README**

Replace the setup-step section and add the two new sections:

````markdown
## Setup steps: `.config/wt.toml` (per repository, committed)

The plugin ships **no** setup logic of its own — worktrunk's hook system is the mechanism.
With `wt v0.77` the project config lives at **`<repo>/.config/wt.toml`**; a repository-root
`wt.toml` is ignored. Location of worktrees is user config, scoped per repository:

```toml
# ~/.config/worktrunk/config.toml
[projects."github.com/you/repo"]
worktree-path = "{{ repo_path }}/../wt-{{ branch | sanitize }}"
```

```toml
# <repo>/.config/wt.toml — runs once at worktree creation, blocking later steps
[pre-start]
install = "mise install"

# runs in the background after creation: copy gitignored files into the worktree
[post-start]
copy = "wt step copy-ignored"
```

The Worktrees panel reads these hooks with `wt hook show --format=json` and lists them in the
Create and Merge dialogs before you confirm, with a "skip start hooks this once" toggle that
maps to `--no-hooks`. Because the plugin runs `wt` with `--yes`, that dialog is the hook
approval.

## Worktrees panel

The Sidebar panel list gains a **Worktrees** entry (a native main panel, not an overlay). It
shows every worktree of the current workspace's repository from `wt list --format=json`:
branch, path, HEAD, dirty/detached/branch-changed chips, ahead/behind, and the sessions whose
working directory is that worktree. Row actions: New session here · Copy path · Sync gitignored
files · Merge into… · Remove.

- Nothing is stored: `wt` is the source of truth, so the panel always shows real Git state.
- Removing is a single `wt remove` behind a confirmation that names the dirty state, the
  detached HEAD, and whether deleting an unmerged branch needs an explicit choice.
- Removing or merging the worktree the current session runs inside is refused.

## Permissions in a worktree session

A worktree's `.git` is a file pointing at the main repository's `.git/worktrees/<name>`, so git
writes made from a session whose workspace is the worktree reach outside the session directory
and are blocked under `workspace-write`. The bundle patch adds a **Worktree Full Access**
preset (`danger-full-access` + `ask`). When the panel starts a session in a worktree, a
confirmation dialog explains that mechanism; on acknowledgement the preset is applied to that
session only, keeping approval prompts on and leaving network and process policy unchanged.
An explicit restriction you chose yourself in DSH's native Access UI is preserved rather than
re-applied, and if the preset is unavailable the panel says so instead of claiming full access.
````

- [ ] **Step 4: Run the full verification**

```bash
pnpm typecheck
pnpm test
pnpm build
grep -c "worktrunkManager/" lib/typert.remote-client.js
head -1 lib/client.js
```

Expected: typecheck clean; all tests pass; `lib/typert.remote-client.js` mentions `worktrunkManager` at least once; `lib/client.js` starts with `window.__ModuleLoader__.load({`.

Then load it in the running GUI:

```bash
dsh plugin --profile web add /Users/ivan/github/casualjim/dsh-plugins/dsh-worktrunk
# restart the profile, then in the GUI: sidebar panel list shows "Worktrees"
```

Expected in the GUI: the Worktrees entry appears in the sidebar panel list; opening it lists the
`dsh-plugins` repository's worktrees with the Local row first; Create opens a dialog that lists
`.config/wt.toml` hooks (or says none are configured); a session started on a worktree row runs
`wt` and reports the `worktree-full-access` outcome. Record the exact observed values in the
task's completion note.

- [ ] **Step 5: Commit**

```bash
git add tests/module-boundary.test.ts README.md
git commit -m "docs(worktrunk): document the panel, permissions, and .config/wt.toml"
```

---

## Self-Review

**Spec coverage.** §4 architecture → Tasks 1–2, 4–8, 11–13, 17. §5 contract → Task 1. §6 host API → Tasks 6–8, 10. §7 panel/seat/refresh/browser-local → Tasks 12–13, 17. §8 session+permission flow → Tasks 6, 9, 17. §9 setup steps → Tasks 3, 14, 16, 18. §10 docs → Task 18. §11 degradation → Tasks 5, 7, 12. §12 testing → every task's test step plus Tasks 18. §13 build wiring → Tasks 10, 11. §14 out of scope → nothing in the plan adds a sidecar, import, archive, ordering, fork binding, overlay, or `zh`. §15 verifications → Task 10 (typert generation) and Task 13 (`sessionLabel` reads title from the native snapshot and invents no status).

**Placeholder scan.** No TBD/TODO. The only deliberate deferral was the mutation-method block in Task 7, which Task 8 replaces with full code, and every task's code blocks are complete.

**Type consistency.** `WtEntry` gains `detached`/`branchMismatch`/`duplicateBranch`/`head`/`changes`/`upstream` in Task 2 and those exact names are used in Tasks 7–8 and the contract in Task 1. `WorktreeSessionRef { id, cwd }` is produced by Task 5 and consumed by Task 7. `WorktrunkService` method signatures in Task 7 match Task 8's implementations and Task 10's projection and `@Remote` methods. `WorktrunkConnection` in Task 11 matches the client calls in Task 12 and Task 17. `PanelStore` in Task 12 matches its use in Task 13 and 17. Locale keys used in components (`panel.*`, `create.*`, `remove.*`, `merge.*`, `permission.*`, `error.*`) all exist in Task 12's dictionary.
