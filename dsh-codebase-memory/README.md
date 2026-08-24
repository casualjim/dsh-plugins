# dsh-codebase-memory

[codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) knowledge-graph
integration as a DeepSeek Harness bundle. Function-level port of upstream's client
integrations onto native DSH carriers — every agent integration upstream covers the same
six capabilities; this bundle maps them 1:1:

| Upstream capability (`agent_clients.h`) | DSH carrier |
|---|---|
| MCP graph access | `@deepseek-ai/dsh-mcp-client` row → tools surface as `mcp__codebase-memory-mcp__search_graph` etc. (same shape Claude Code uses) |
| INSTRUCTIONS | `systemPrompt` section: graph-first discovery rule |
| SKILL | `skills/codebase-memory/SKILL.md` (ported verbatim) |
| AGENT ×3 tiers | native subagents via `dsh-tool-subagent`: `codebase_memory_scout`, `codebase_memory` (verify), `codebase_memory_auditor` |
| HOOK ×4 behaviors | typed events: `agent/session-start` reminder, grep/glob/read discovery gate + CLI augmentation, `subagent/start` reminder |
| PLUGIN behavior layer | this plugin |

Tier allow-lists are enforced by the tool registry, not prompt convention: the scout child
physically cannot call `query_graph` or `detect_changes`.

## Access modes

Upstream renders two graph access modes per dialect; both map to a one-line difference in
the child tool filter:

- `tierAccess: 'direct'` (default) — tier children call the `mcp__codebase-memory-mcp__*`
  tools themselves.
- `tierAccess: 'handoff'` — children get only `read/grep/glob`; the parent supplies graph
  evidence and the child cross-checks exact source.

## Install

```sh
cd ~/github/casualjim/dsh-plugins && pnpm install
# then add "dsh-codebase-memory": "link:<abs path>" to your profile package.json deps,
# "dsh-codebase-memory" to dsh.profile.bundles, and pnpm install in the profile.
```

Requires `codebase-memory-mcp` on disk (default `~/.local/bin/codebase-memory-mcp`, override
with `binPath` or the `CBM_BIN_PATH` env var).

## Config

| Field | Default | Description |
|---|---|---|
| `binPath` | `~/.local/bin/codebase-memory-mcp` | CBM binary for the augment CLI calls |
| `provider` | `spawn` | `ctx.subagents` provider tier children run on |
| `enableTiers` | `true` | Register the three tier subagents |
| `tierAccess` | `direct` | `direct` or `handoff` (see above) |
| `enableSubagentReminder` | `true` | Inject the session reminder into spawned subagents |
| `enableAugment` | `true` | Gate + post-result graph-hit context on grep/glob/read |
| `augmentBudgetMs` | `300` | Per-attempt CLI budget; fail-open on expiry |
| `alwaysOn` | `true` | Register the graph-first instructions section |

## Troubleshooting

- **Tier mount fails with unknown tool names** — the `mcp__codebase-memory-mcp__*` names
  were not registered before the tiers loaded (binary missing at activation?). Either fix
  the binary path or set `tierAccess: 'handoff'`. The patch inserts the mcp row first on
  purpose; keep that order.
- **No augment context appears** — by design it is silent unless the graph returns hits.
  Check `<binPath> cli search_graph '{"project":"<dir-name>","name_pattern":".*X.*","limit":5}'`
  manually; the project name must match an indexed CBM project.

## Upstream installer note

The natural upstream contribution is a DeepSeek Harness client profile in
`src/cli/agent_clients.c` that appends this bundle's patch row to
`~/.dsh/profiles/<profile>/cordis.patch.yml` — the same move the installer makes on
`~/.claude.json` today.
