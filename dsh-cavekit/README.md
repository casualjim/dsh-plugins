# dsh-cavekit

DeepSeek Harness port of [JuliusBrussee/cavekit](https://github.com/JuliusBrussee/cavekit): a compact `SPEC.md` workflow for spec-driven development.

Cavekit keeps one durable project artifact at repo root:

```text
SPEC.md
```

The bundle ships upstream Cavekit `FORMAT.md` as the reference for that file's sections, addressing rules, pipe tables, and caveman-style spec encoding. The archive workflow copies exact full pre-trim `SPEC.md` to `.cavekit/archive/` before trimming.

## Install

```sh
dsh plugin --profile web add <path-or-package>
```

## Commands

Registers eight slash commands on `ctx.commands` (upstream `/ck:*` names, `:` → `-` because dsh command names forbid colons). Each command feeds the agent a user message that routes to its skill with the raw arguments:

```text
/ck-spec [bug: <description> | amend <§X.n> | from-code | <idea>]
/ck-build [§T.n | --next | --all]
/ck-check [§V | §I | §T | --all]
/ck-grill [idea | "grill me"]
/ck-research [topic | "best lib for X"]
/ck-review [§T.n | --all]
/ck-deepen [module/path | "improve the design"]
/ck-archive (no args needed)
```

## Skills

Registers nine skills on `ctx.skills` (source `bundled`, resource base per skill directory so `../../FORMAT.md` references resolve). Upstream `/ck:*` command names map to skill names:

| Upstream command | Skill |
|---|---|
| `/ck:spec` | `cavekit-spec` — create, distill, amend, or backprop project `SPEC.md` |
| `/ck:build` | `cavekit-build` — plan and execute selected §T tasks |
| `/ck:check` | `cavekit-check` — read-only drift detector |
| `/ck:grill` | `cavekit-grill` — calibrated interrogation of a fuzzy idea |
| `/ck:research` | `cavekit-research` — external knowledge distilled into §R |
| `/ck:review` | `cavekit-review` — adversarial senior review before code |
| `/ck:deepen` | `cavekit-deepen` — optional design-improvement pass |
| `/ck:archive` | `cavekit-archive` — archive oversized SPEC.md content |
| — | `cavekit-backprop` — bug-to-spec protocol |

## Port notes

- Pi prompt templates (`prompts/ck:*.md`) are ported as `ctx.commands` registrations: dsh's command registry is the analog of pi's prompt templates. The `argument-hint` frontmatter becomes the command's input hint; the body's routing text becomes the handler's user message.
- Skill content is dsh-adapted: `/ck:*` command references become `/ck-*` (dsh command names forbid colons), and the pi-only `codebase-memory` fallback is dropped. `cavecrew-investigator` references stay soft: they activate when a compatible investigator subagent is present (e.g. from the `dsh-caveman` port), complementary to this bundle.
- Pi package tests are not ported: they assert pi package-manifest loading, which does not exist in dsh.
