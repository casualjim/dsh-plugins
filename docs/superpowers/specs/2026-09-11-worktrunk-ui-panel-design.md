# dsh-worktrunk UI panel and worktree-full-access permissions — design

Date: 2026-09-11
Status: approved in brainstorming, pending implementation plan
Package: `dsh-worktrunk`
Reference implementation studied: `@cerbur/clutch-dsh-worktree` (`~/github/Cerbur/clutch-dsh/packages/clutch-dsh-worktree`)

## 1. Context

`dsh-worktrunk` today is a two-file plugin (708 source lines): `src/wt.ts` builds `wt`
argv and normalizes `wt list --format=json`; `src/index.ts` registers five agent tools
(`worktrunk_create`, `worktrunk_list`, `worktrunk_merge`, `worktrunk_remove`,
`worktrunk_copy_ignored`), the human `/wt` command, workspace registration for created or
opened worktrees, and a once-per-session context note.

It has no Web UI and no permission handling. A worktree's `.git` is a file pointing into
the main repository's `.git/worktrees/<name>`, so git writes made from a session whose
workspace is the worktree touch metadata outside the session directory and are blocked
under `workspace-write`. `clutch-dsh-worktree` solved that with a named
`worktree-full-access` preset plus an explicit confirmation flow, and it built a full
sidebar Worktree mode with its own Git stack, sidecar index, and session bindings.

This design adopts that plugin's **permissions and UI ideas** while keeping three things
fixed:

1. worktrunk (`wt`) remains the only worktree engine — no raw `git worktree` in plugin code;
2. the repo's `wt.toml` hooks remain the setup-step mechanism, surfaced but not replaced;
3. nothing that exists today is removed — all five tools and every `/wt` verb stay.

## 2. Decisions taken

| # | Decision | Rejected alternative and why |
|---|---|---|
| 1 | Panel is a native **`sidebar.panellist` icon + keyed `main` panel** | `shell.overlay` (theirs) needs anchor measurement, `ResizeObserver`, and ~1.2k lines of geometry; DSH 0.1.2-rc.1 had no panel seat, 0.1.5-rc.1 does |
| 2 | **Single package** with a `./client` export | Split `dsh-worktrunk` + `dsh-worktrunk-ui` only pays off if the host can be installed without the UI; it cannot |
| 3 | **Stateless**: `wt list --format=json` is the source of truth | A sidecar index (theirs) buys archive/unarchive/import/order that this scope does not include |
| 4 | Delete = **one `wt remove` behind a rich confirm dialog** | Archive-then-delete (theirs) needs a persistent store; our `wt` model has no archive state |
| 5 | Permissions = **preset row + our own confirmation dialog** on session open | Preset-only leaves the default broken until the user notices; full parity includes an icon renderer and fallback branches we do not need |
| 6 | Session rows **grouped by session header `cwd`** | A binding sidecar (theirs) exists to survive DSH not exposing membership; `cwd` is already readable host-side |
| 7 | Setup steps surfaced by **`wt hook show --format=json`** + skip toggle | A hand-written TOML parser duplicates a first-class `wt` command |
| 8 | Client→host over **Typert remote on the existing `/api`** channel | Hand-written webserver routes (our `dsh-fleet` pattern) are untyped and non-canonical |
| 9 | `en` locale only in v1 | `zh` is a data-only change later; no code path holds strings |
| 10 | **Merge ships in v1**, as a row action and dialog | Shipping create+remove without merge would send the human back to `/wt merge` for the one action that finishes a worktree; the merge dialog reuses the create dialog's hook-preview and confirmation shapes, so it costs one component |

## 3. Verified facts this design rests on

- Installed DSH is `0.1.5-rc.1`. `@deepseek-ai/dsh-client-runtime` no longer exists, so the
  client halves of our `dsh-headroom` / `dsh-fleet` are on a superseded contract and are not
  the pattern to copy.
- `@deepseek-ai/dsh-client-ui-layout` declares `main` as a **keyed** root slot: the reserved
  `conversation` key hosts the Conversation, other keys receive no session binding.
  `sidebar.panellist` is a list slot whose entries address the matching main panel, and
  `ctx.layout.selectPanel(id)` switches to a registered key.
- `@deepseek-ai/dsh-permission-presets` exposes `names`, `current(sessionOrEvents)`,
  `resolve(name)`, `set(session, name)`. Presets come from configuration, so defining one
  requires a patch row; a plugin can then apply it to a session.
- A host plugin can read `ctx.sessions.list()` (live headers) and
  `ctx.sessionPersistence.list()` (persisted headers) — `cwd` is readable without loading a
  transcript.
- `wt v0.77.0` facts, verified by running it:
  - `wt list --format=json` (schema 2) reports `worktree.detached`, `worktree.branch_mismatch`,
    `worktree.duplicate_branch`, `worktree.changes.{staged,modified,untracked,renamed,deleted,conflicted}`,
    `upstream.{ahead,behind}`, `repo.default_branch`, forge metadata, and `head.{sha,short_sha,subject,committed_at}`.
  - `wt hook show --format=json` returns `[{ name, needs_approval, source, template, type }]`,
    so hook preview needs no TOML parser.
  - `wt config show --format=json` and `wt step copy-ignored` exist.
- **Correction to our own docs:** the project config is `<repo>/.config/wt.toml`. A repo-root
  `wt.toml` is ignored by v0.77 (verified: hooks defined there do not appear in `wt hook show`).
  `worktree-path` now belongs in *user* config, scoped per repo via `[projects."<id>"]`; wt warns
  and ignores it in project config. `README.md`'s root-`wt.toml` example is stale and moves.

## 4. Architecture

One package, three planes, one dependency direction.

```text
dsh-worktrunk/
├── cordis.patch.yml          patch layer: permission presets + host row
├── package.json              exports ".", "./client", "./typert", "./remote"; dsh.client + dsh.bundle
├── scripts/
│   ├── generate-typert.mjs   Typert host + remote artifacts from the host face
│   └── build-client.mjs      browser closure-factory bundle
├── src/
│   ├── wt.ts                 argv builders, JSON normalization, runWt/runWtOk, WtError (gains additive fields; existing tool behaviour unchanged)
│   ├── index.ts              apply(): tools + /wt + session context note (unchanged behaviour)
│   ├── contract.ts           wire vocabulary; imports nothing
│   ├── host/
│   │   ├── service.ts        WorktrunkService: the only wt execution path for the UI
│   │   ├── remote.ts         Typert remote projection of the service
│   │   ├── sessions.ts       session header index: cwd → worktree → WorktreeSessionRef[]
│   │   ├── permission.ts     permissionPresets adapter: read, apply, report
│   │   └── workspace.ts      repo/workspace resolution + workspace registration refresh
│   └── client/
│       ├── entry.ts          slot registration + wiring
│       ├── index.ts          browser-safe exports
│       ├── connection.ts     the single /api adapter and error normalizer
│       ├── store.ts          panel store: rows, selection, refresh generation, late-result guard
│       └── panel/            WorktreePanel, WorktreeRow, session rows, dialogs
└── tests/                    vitest
```

Dependency rules, enforced by a module-boundary test:

- `contract.ts` imports nothing from `host/`, `client/`, or `wt.ts`.
- `host/*` may import `contract.ts` and `wt.ts`. `wt.ts` imports nothing.
- `client/*` may import `contract.ts` only. It never imports `host/`, never spawns a process,
  never reads a file.
- Only `host/service.ts` executes `wt` for UI paths, and it does so through the same
  `runWt` / `runWtOk` the agent tools already use — one runner, one error type.

## 5. Contract (`src/contract.ts`)

```ts
type WorktreeHealth = 'ready' | 'missing' | 'detached' | 'branch-mismatch' | 'unavailable'

interface WorktreeRow {
  path: string
  branch: string
  isMain: boolean
  isCurrent: boolean
  detached: boolean
  branchMismatch: boolean
  duplicateBranch: boolean
  head: { sha: string; shortSha: string; subject: string; committedAt: string } | null
  changes: { staged: boolean; modified: boolean; untracked: boolean; renamed: boolean; deleted: boolean; conflicted: boolean }
  upstream: { ahead: number; behind: number } | null
  sessions: WorktreeSessionRef[]
  registered: boolean          // already a DSH workspace
}

interface WorktreeSessionRef {
  id: string
  cwd: string
}

interface HookSpec {
  name: string
  type: 'pre-start' | 'post-start' | 'pre-merge' | string
  template: string
  source: 'project' | 'user'
  needsApproval: boolean
}

interface PanelSnapshot {
  repo: { root: string; defaultBranch: string; forge: string | null }
  items: WorktreeRow[]
  hooks: HookSpec[]
}

type WorktreeErrorCode =
  | 'WT_NOT_INSTALLED' | 'NOT_A_REPO' | 'NO_INITIAL_COMMIT' | 'NO_LOCAL_BRANCH'
  | 'WT_FAILED' | 'WT_BAD_JSON' | 'WT_BUSY' | 'SESSION_WORKTREE'
  | 'PRESET_UNAVAILABLE' | 'PERMISSION_UNVERIFIED' | 'HOOK_FAILED' | 'NOT_FOUND'
```

Existing `WtError` (with its `code`) is reused rather than replaced; `WorktreeErrorCode`
names the codes the client may branch on, and a test asserts exhaustiveness.

## 6. Host API

Channel: the plugin's Typert remote on DSH's existing `/api`, methods namespaced
`worktrunkManager/<method>`.

| Method | Input | Output | Notes |
|---|---|---|---|
| `readPanel` | `{ workspaceId }` | `PanelSnapshot` | one `wt list --format=json` + one `wt hook show --format=json` + session header merge |
| `previewHooks` | `{ workspaceId }` | `{ hooks: HookSpec[] }` | dialog may refresh preview independently |
| `createWorktree` | `{ workspaceId, branch, base?, skipHooks? }` | `{ path, branch, hooksRan, registrationWarning? }` | `wt switch --create <branch> [--base <base>] [--no-hooks] --yes`; then register/refresh the workspace and re-read for the path |
| `removeWorktree` | `{ workspaceId, branch, force?, forceDeleteBranch?, keepBranch? }` | `{ removed: true }` | `wt remove […] --foreground --yes <branch>`; refuses the session's own worktree |
| `mergeWorktree` | `{ workspaceId, branch, target?, keepCommit?, keepWorktree? }` | `{ merged: true }` | runs `wt merge` **with cwd set to the worktree path**; refuses when the target worktree holds the current session unless `keepWorktree` |
| `copyIgnored` | `{ workspaceId, path?, force?, requireInclude? }` | `{ ok: true }` | `wt step copy-ignored` |
| `openWorktree` | `{ workspaceId, path }` | `{ workspaceId }` | re-registers/refreshes the DSH workspace for the path |
| `ensureWorktreePermission` | `{ sessionId }` | `{ status, preset? }` | `status: 'applied' \| 'already-full-access' \| 'user-restricted' \| 'unavailable'` |

The service never mutates DSH-owned data beyond applying a permission preset to one session
and refreshing workspace registration — both of which the plugin already does today.

The host resolves each worktree's `sessions` from live `ctx.sessions` headers merged with
`ctx.sessionPersistence.list()` (headers only — never a transcript) and matches them by `cwd`.
So the host owns **membership** (session id + cwd) and the client owns **presentation** (title,
relative time, status) by joining those ids against the native session-list snapshot. A session
appears under its worktree because it actually runs there, including sessions started from the
native sidebar.

## 7. Panel (client)

### Seat

- `sidebar.panellist`: one entry, `id: 'worktrunk'`, ascending `order` after shipped entries,
  label from the `worktrunk` locale namespace.
- `main` keyed slot: `{ name: 'main', key: 'worktrunk' }` renders the panel.
- `ctx.layout.selectPanel('worktrunk')` is used only for programmatic entry after an action
  succeeds.

No `shell.overlay`, no positioning code, no anchor dependency: the framework owns column
sizing, scrolling, selection, and focus.

### Layout

- Header: repository name, default branch, refresh action, `+ Create worktree`.
- Worktree rows: main row fixed first; each row shows branch, path, `HEAD short-sha subject`,
  dirty / detached / branch-mismatch / ahead-behind chips, and a current marker.
- Expanded worktree: session rows (title, relative time, status dot); selecting one calls the
  native session open.
- Row menu: New session here · Open in DSH · Copy path · Sync gitignored files · Merge into… ·
  Remove.
- Empty, loading, and error states: first entry shows a loading state; a failed targeted refresh
  keeps ready rows and shows a retryable error; "no worktrees" is its own empty state that
  offers creation.

### Refresh discipline

One read per workspace, keyed by workspace identity, with a generation counter. `readPanel`
results merge into the existing projection; a stale generation may never write. Mutation
success invalidates exactly the affected workspace. Global refresh is reserved for first entry
and explicit retry — the panel never blanks ready content on the way to a new state.

### Browser-local state

Expanded worktree ids and the active selection, in memory plus `localStorage` for expansion.
Nothing else. No sidecar file, no DSH data writes.

## 8. Session creation and the permission flow

1. "New session here" → `ctx.sessions.create({ cwd: worktreePath })` through the native session
   controller (client side), which keeps the plugin's existing model: the worktree is the
   session's workspace root.
2. `ensureWorktreePermission({ sessionId })`:
   - `already-full-access` → open.
   - `user-restricted` → open, keep the restriction, do not re-elevate. This covers the case
     where the session previously ran as `worktree-full-access` and the user then narrowed it in
     native Access; the host detects that history and reports `user-restricted`.
   - `applied` → open.
   - `unavailable` / `PRESET_UNAVAILABLE` → keep the session and binding, do not open, show a
     retryable notice carrying the session id, and never claim full access.
3. Confirmation dialog (our own component, shown before step 2 when the session is not already
   full-access): states the linked-git-metadata reason, the exact worktree path, that filesystem
   confinement is disabled **for this session only**, and that approval prompts stay on while
   network and process policy are unchanged. An acknowledgement checkbox gates the confirm
   button. Cancel keeps the session and changes nothing.

Host side, the adapter reads `permissionPresets.current(session)` and `resolve(name)`, applies
`set(session, 'worktree-full-access')` only after the client's confirmation, and reports which
outcome occurred. Absence of the preset (a profile whose patch replaced the presets) yields
`PRESET_UNAVAILABLE`, never a silent downgrade.

### Preset patch row

`cordis.patch.yml` gains a `permission` row. A patch row replaces the whole config, so the
upstream preset table is copied verbatim (`read-only`, `workspace-write`, `danger-full-access`)
and one entry is added:

```yaml
worktree-full-access:
  sandbox: danger-full-access
  approval: ask
  name: Worktree Full Access
  description: Full file access for linked Git metadata while keeping approval prompts enabled.
```

A test asserts the row still contains all four presets, so an upstream preset added later fails
loudly instead of disappearing.

## 9. Setup steps

Setup steps remain `wt`'s own hook machinery, declared in the repository's
`<repo>/.config/wt.toml`; the plugin renders them and never runs its own setup logic.

- Create dialog calls `previewHooks` and lists each `pre-start` / `post-start` hook with its
  type, name, source, and command template before the user confirms. Because the plugin passes
  `--yes`, this dialog **is** the hook approval that `needs_approval` would otherwise prompt for.
- A "skip start hooks this once" checkbox maps to `--no-hooks` and states what is skipped
  (dependency install, env generation, gitignored file copy).
- The dialog warns when a `pre-start` hook will block creation until it finishes.
- Merge dialog lists `pre-merge` hooks the same way.
- Failure surfaces:
  - wt missing → `WT_NOT_INSTALLED` with `brew install worktrunk` / `cargo install worktrunk`
    guidance and no command block;
  - not a repo / no initial commit / no local branch → `NOT_A_REPO`, `NO_INITIAL_COMMIT`,
    `NO_LOCAL_BRANCH` with copyable commands; the plugin runs nothing;
  - hook failure → `HOOK_FAILED` with the wt output tail and a recovery hint;
  - concurrent mutation → `WT_BUSY`.

## 10. Documentation corrections shipped with this work

- `README.md`: the project config path becomes `<repo>/.config/wt.toml`; the `worktree-path`
  option moves to a user-config example; the setup-step section reflects `wt hook show` as the
  way the UI previews hooks.
- The README table gains the panel as an additional surface alongside the CLI mapping, and the
  permission flow gets its own subsection.
- The sandbox note stays: worktrees live outside the repository by design.

## 11. Errors and degradation

- The host half works without the client half: tools and `/wt` are unaffected if the panel
  never mounts, and if the profile lacks the panel system the client half simply does not load
  (declared inject list).
- `readPanel` failures surface as retryable panel errors; they are never rendered as an empty
  worktree list.
- A recognized wt readiness failure (not a repo, no commits, no branch, wt absent) is a
  workspace-scoped setup state, not a transport error.
- The plugin never deletes a DSH session, never removes a workspace registration that it did
  not create, and refuses destructive operations against the worktree the current session runs
  inside.

## 12. Testing

vitest, in the style of the existing `tests/wt.test.ts` (no fixtures beyond captured command
output):

- `host/service`: argv for create/remove/merge/copy-ignored; `--no-hooks` mapping; merge cwd is
  the worktree path; session-worktree refusal for remove and merge; force/force-delete/keep
  flags; error-code mapping; wt-missing path.
- `host/service` hook preview: parse a captured `wt hook show --format=json` payload.
- `host/service` panel read: normalize a schema-2 `wt list --format=json` payload including
  detached, branch-mismatch, duplicate-branch, dirty, and upstream cases.
- `host/sessions`: cwd→worktree grouping, nested worktree path, main checkout excluded,
  detached worktree, two sessions in one worktree.
- `host/permission`: the four outcomes, preserve-user-restriction, preset missing.
- `contract`: every wire type round-trips; error-code list is exhaustive.
- module boundary: client never imports host or `wt.ts`; `contract.ts` imports nothing.
- client `store`: a stale generation cannot overwrite newer rows; a failed targeted refresh
  preserves ready rows.
- package manifest: exports, `dsh.client`, `dsh.bundle.patch`, and that the build emits
  `lib/client.js`, `lib/typert.host.js`, `lib/typert.remote-client.js`.
- patch layer: the `permission` row keeps all four presets.

## 13. Build wiring

- `pnpm build` = `tsc` → `lib/`, `node scripts/generate-typert.mjs` → `lib/typert.host.js` +
  `lib/typert.remote-client.js`, `node scripts/build-client.mjs` → `lib/client.js`.
- `scripts/generate-typert.mjs` mirrors the reference plugin's script: it asserts the
  `./typert` and `./remote` exports match, then emits the host face and its remote contribution.
  devDependency `@deepseek-ai/dsh-typert-generator@0.1.5-rc.1` (published; matches installed
  DSH).
- `scripts/build-client.mjs` emits DSH's closure handoff
  `window.__ModuleLoader__.load({ id, factory })` with only `react`, `react/jsx-runtime`, and
  the `@deepseek-ai/*` client modules external.
- `dsh.client.inject`: `dsh-client-store`, `dsh-client-locale`, `dsh-client-ui-primitives`,
  `dsh-client-ui-slots`, `dsh-client-ui-layout`, `dsh-client-ui-sidebar`,
  `dsh-api-session-controller`, `dsh-client-connection`; `platform: web`.
- Peer/dev dependency versions pin the installed `0.1.5-rc.1` contract family.

## 14. Out of scope

- import of externally created worktrees (they already appear in `wt list`; no import concept is
  needed under decision 3);
- archive / unarchive / clean-disk-separate-from-remove lifecycle and the `Archived` group;
- session↔worktree binding sidecar, browser membership projection, fork binding, session drag
  ordering, session promotion;
- drag reordering of worktrees, five-row session overflow, hover detail cards, `shell.overlay`
  geometry, the Hero/composer context chips, and the native permission-icon renderer;
- `zh` locale, npm publishing, plugin-market packaging;
- out of scope: any behaviour change to the five tools or the existing `/wt` verbs, and any
  structural change to `wt.ts` beyond additive fields and new read functions.

Each excluded item is a separate future initiative, not a placeholder in this one.

## 15. Verification steps owned by the implementation plan

These are confirmations to perform while implementing, not unresolved requirements:

- Generate the Typert host and remote artifacts from this package (not, as the reference plugin
  does, from inside the DSH monorepo) and confirm the loader accepts them on `0.1.5-rc.1`.
- Read the actual shape of the client session-list snapshot before rendering a session row's
  status. If that snapshot exposes a status comparable to the native session dot, render it;
  otherwise render title and relative time only, and add the dot as a follow-up. Session rows
  never invent a status the snapshot does not carry.
