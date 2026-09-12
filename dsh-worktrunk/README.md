# dsh-worktrunk

[worktrunk](https://github.com/max-sixty/worktrunk) (`wt`) git worktree management for DeepSeek Harness — create, list, merge, and remove worktrees from the chat, with worktrunk's own setup-step machinery (`.config/wt.toml` hooks) doing the heavy lifting: dependency installs (`mise install`), env generation, and copying gitignored files (secrets, local config) into fresh worktrees.

## What it gives a profile

| Worktrunk CLI | dsh-worktrunk equivalent |
|---|---|
| `wt switch --create <branch>` | agent tool `worktrunk_create`, or `/wt create <branch> [<base>]` |
| `wt list --format=json` | agent tool `worktrunk_list`, or `/wt` / `/wt list` |
| `wt merge [<target>]` | agent tool `worktrunk_merge`, or `/wt merge <branch> [<target>] [--keep-commit] [--keep-worktree]` |
| `wt remove <branch>` | agent tool `worktrunk_remove`, or `/wt remove <branch> [--force]` |
| `wt step copy-ignored` | agent tool `worktrunk_copy_ignored`, or `/wt copy-ignored` |

Lifecycle: `create` → work → `merge` → `remove`. Merge squashes & rebases into the target (default: repository default branch), fast-forwards it, and removes the worktree; `--keep-commit` preserves history (`--no-squash`), `--keep-worktree` keeps the checkout (`--no-remove`). Merge runs the repo's `.config/wt.toml` pre-merge hooks; failures append recovery guidance (`git merge --continue` / `git merge --abort`).

- Worktrees are created through the harness subprocess service (never the agent bash tool), so they work regardless of the session's sandbox mode.
- Created/opened worktrees are registered via `ctx.workspaceRegistry`, so a new session can start **inside** the worktree. Since worktrees live outside the repository (worktrunk default: sibling directories), opening the worktree as the session workspace is what places it inside the session's `workspace-write` boundary.
- When a session runs inside a worktree, the agent is told once (branch, path, HEAD, and the `copy-ignored` escape hatch).
- `/wt open <branch>` prints the path and (re-)registers it as a workspace.
- Safety: removing or (non-keep) merging the worktree that contains the current session is refused. Dirty worktree removal needs `--force`; deleting an **unmerged** branch additionally needs `forceDeleteBranch` (`wt remove --force-delete`) — these gates stay with `wt`, the plugin never bundles them.

## Requirements

- [worktrunk](https://worktrunk.dev/) on the host: `brew install worktrunk` (or `cargo install worktrunk`).
- A DSH profile with the `tools`, `commands`, and `subprocess` services (the `web` profile provides all three via `dsh-base`).

## Install

```sh
# 1. make the plugin available to your profile
dsh plugin --profile web add <path-to-dsh-worktrunk>

# 2. activate it in the profile's patch layer (~/.dsh/profiles/web/cordis.patch.yml)
#    (installing from the bundle manifest usually adds this row for you)
#    - insert:
#        - id: dsh-worktrunk
#          name: dsh-worktrunk

# 3. restart the profile (e.g. restart `dsh web`)
```

### Configuration (all optional)

```yaml
- insert:
    - id: dsh-worktrunk
      name: dsh-worktrunk
      config:
        bin: wt            # binary name or absolute path (default: wt)
        labelPrefix: '[wt]' # workspace label prefix (default: [wt])
```

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

`wt step copy-ignored` copies gitignored files between the main checkout and the worktree; existing destination files are skipped (safe to re-run), `--force` overwrites. Add `--require-include` to restrict copying to a Claude Code-style `.worktreeinclude` manifest.

Create from the currently checked-out branch instead of the default branch: `/wt create <branch> @` (worktrunk's `--base @`).

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

`tests/client-bundle.test.ts` loads the built `lib/client.js` headlessly and asserts both
registrations; seeing the Worktrees entry in a running GUI after the profile restart in
[Install](#install) step 3 is still a manual check.

## Permissions in a worktree session

A worktree's `.git` is a file pointing at the main repository's `.git/worktrees/<name>`, so git
writes made from a session whose workspace is the worktree reach outside the session directory
and are blocked under `workspace-write`. The bundle patch adds a **Worktree Full Access**
preset (`danger-full-access` + `ask`). When the panel starts a session in a worktree, a
confirmation dialog explains that mechanism; on acknowledgement the preset is applied to that
session only, keeping approval prompts on and leaving network and process policy unchanged.
An explicit restriction you chose yourself in DSH's native Access UI is preserved rather than
re-applied, and if the preset is unavailable the panel says so instead of claiming full access.

## Sandbox note

Worktrees live **outside** the repository, so a session sitting in the main checkout cannot write into them under `workspace-write` — by design. Create (`worktrunk_create`) and manage (`/wt`) worktrees from the main-repo session; then start a new session with the worktree as its workspace to work inside it. The plugin registers every created/opened worktree in the workspace list for exactly this.

## License

MIT — see [LICENSE](LICENSE).
