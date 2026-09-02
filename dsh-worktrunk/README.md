# dsh-worktrunk

[worktrunk](https://github.com/max-sixty/worktrunk) (`wt`) git worktree management for DeepSeek Harness — create, list, merge, and remove worktrees from the chat, with worktrunk's own setup-step machinery (`wt.toml` hooks) doing the heavy lifting: dependency installs (`mise install`), env generation, and copying gitignored files (secrets, local config) into fresh worktrees.

## What it gives a profile

| Worktrunk CLI | dsh-worktrunk equivalent |
|---|---|
| `wt switch --create <branch>` | agent tool `worktrunk_create`, or `/wt create <branch> [<base>]` |
| `wt list --format=json` | agent tool `worktrunk_list`, or `/wt` / `/wt list` |
| `wt merge [<target>]` | agent tool `worktrunk_merge`, or `/wt merge <branch> [<target>] [--keep-commit] [--keep-worktree]` |
| `wt remove <branch>` | agent tool `worktrunk_remove`, or `/wt remove <branch> [--force]` |
| `wt step copy-ignored` | agent tool `worktrunk_copy_ignored`, or `/wt copy-ignored` |

Lifecycle: `create` → work → `merge` → `remove`. Merge squashes & rebases into the target (default: repository default branch), fast-forwards it, and removes the worktree; `--keep-commit` preserves history (`--no-squash`), `--keep-worktree` keeps the checkout (`--no-remove`). Merge runs the repo's `wt.toml` pre-merge hooks; failures append recovery guidance (`git merge --continue` / `git merge --abort`).

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

## Setup steps: wt.toml (per repository, committed)

The plugin intentionally ships **no** setup logic of its own — worktrunk's hook system is the mechanism. Example `wt.toml` at the repository root:

```toml
# Location of worktrees (default: siblings of the repo, e.g. ../repo.feat)
worktree-path = "{{ repo_path }}/../wt-{{ branch | sanitize }}"

# Runs once at worktree creation, blocking later steps: dependency install
[pre-start]
install = "mise install"

# Runs in the background after creation: copy gitignored files (secrets,
# local config) from the main checkout into the new worktree
[post-start]
copy = "wt step copy-ignored"
```

`wt step copy-ignored` copies gitignored files between the main checkout and the worktree; existing destination files are skipped (safe to re-run), `--force` overwrites. Add `--require-include` to restrict copying to a Claude Code-style `.worktreeinclude` manifest.

The usual flow: `mise install` in `pre-start` (must finish before anything depends on it), `copy-ignored` in `post-start` (non-blocking).

Create from the currently checked-out branch instead of the default branch: `/wt create <branch> @` (worktrunk's `--base @`).

## Sandbox note

Worktrees live **outside** the repository, so a session sitting in the main checkout cannot write into them under `workspace-write` — by design. Create (`worktrunk_create`) and manage (`/wt`) worktrees from the main-repo session; then start a new session with the worktree as its workspace to work inside it. The plugin registers every created/opened worktree in the workspace list for exactly this.

## License

MIT — see [LICENSE](LICENSE).
