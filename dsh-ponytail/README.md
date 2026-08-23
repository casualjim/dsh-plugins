# dsh-ponytail

DeepSeek Harness port of [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail): the lazy-senior-dev build discipline that stops at the first rung of the YAGNI ladder that holds.

> He says nothing. He writes one line. It works.

## What this ports

Upstream ponytail ships skills, slash commands, and lifecycle hooks. dsh-ponytail maps each to the matching DSH seam:

| Upstream | dsh-ponytail |
|---|---|
| `skills/*/SKILL.md` (6) | registered on `ctx.skills` (`source: bundled`) |
| `commands/*.toml` (6) | slash commands on `ctx.commands` from `prompts/*.md` |
| `ponytail-activate.js` SessionStart hook (emits ruleset every session) | `systemPrompt` section `ponytail:always-on`, active by default |
| `ponytail-subagent.js` SubagentStart hook (injects ruleset into every spawned child) | the same global section reaches spawned subagents — a child's `persona` is a scoped shadow over the global prompt layer, never a replacement, so the build rule rides through to children |
| `ponytail-mode-tracker.js` UserPromptSubmit hook (per-turn reinforcement + `/ponytail` switching) | `/ponytail [lite\|full\|ultra\|off]` command sends a follow-up re-asserting the level; the persistent section is the no-drift reminder |
| `PONYTAIL_DEFAULT_MODE` env var + config-file resolution | row `config.defaultMode`, then the env var, then `full` |
| statusline badge | not ported (the web GUI has no statusline seam) |

The ladder:

```
1. Does this need to exist?   → no: skip it (YAGNI)
2. Already in this codebase?  → reuse it, don't rewrite
3. Stdlib does it?            → use it
4. Native platform feature?   → use it
5. Installed dependency?      → use it
6. One line?                  → one line
7. Only then: the minimum that works
```

Lazy about the solution, never about reading. Trust-boundary validation, data-loss handling, security, and accessibility are never on the chopping block.

## Install

```sh
dsh plugin --profile web add <path-or-package>
```

Row config in the profile composition:

```yaml
- id: dsh-ponytail
  name: dsh-ponytail
  config:
    alwaysOn: true        # inject the ruleset every session + every subagent (default true)
    defaultMode: full     # off | lite | full | ultra  (env: PONYTAIL_DEFAULT_MODE)
```

Set `alwaysOn: false` to mount the skills and commands without auto-activation (activate manually with `/ponytail`). Set `defaultMode: off` to keep the row mounted but start sessions inactive. Resolution: row `defaultMode` → `PONYTAIL_DEFAULT_MODE` env var → `full`.

## Skills

Registers six skills on `ctx.skills`:

| Skill | What it does |
|---|---|
| `ponytail` | Core lazy-build mode: the ladder, intensity levels, persistence |
| `ponytail-review` | Over-engineering review of the current changes: `L42: yagni: factory, one product. Inline.` |
| `ponytail-audit` | Whole-repo over-engineering audit: ranked list of what to delete |
| `ponytail-debt` | Harvest `ponytail:` shortcut comments into a tracked ledger |
| `ponytail-gain` | Measured-impact scoreboard: less code, less cost, more speed |
| `ponytail-help` | Quick-reference card for levels, skills, and commands |

## Commands

Registers six slash commands on `ctx.commands` (from `prompts/*.md`; `{{args}}` interpolates raw input):

| Command | Purpose |
|---|---|
| `/ponytail [lite\|full\|ultra\|off]` | Switch intensity / deactivate |
| `/ponytail-review` | Review current changes for over-engineering |
| `/ponytail-audit` | Audit the whole repo for over-engineering |
| `/ponytail-debt` | Harvest `ponytail:` comments into a ledger |
| `/ponytail-gain` | Show the measured-impact scoreboard |
| `/ponytail-help` | Show the quick-reference card |

Deactivate with `/ponytail off`, "stop ponytail", or "normal mode". Resume anytime with `/ponytail`.

## Intensity

| Level | What change |
|---|---|
| **lite** | Build what's asked, but name the lazier alternative in one line. User picks. |
| **full** | The ladder enforced. Stdlib and native first. Shortest diff, shortest explanation. Default. |
| **ultra** | YAGNI extremist. Deletion before addition. Ship the one-liner and challenge the rest of the requirement. |

The always-on ruleset is the `ponytail` SKILL.md body filtered to the active level's intensity row and worked example — a direct port of upstream's `ponytail-instructions.js`, so edits to the skill source propagate without a duplicated ruleset.

## Develop

```sh
pnpm install
pnpm --filter dsh-ponytail build
pnpm --filter dsh-ponytail test
pnpm --filter dsh-ponytail typecheck
```

## License

MIT, inherited from upstream ponytail.