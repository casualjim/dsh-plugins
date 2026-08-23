# dsh-caveman

DeepSeek Harness port of [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman): ultra-compressed agent output ("why use many token when few do trick") plus the cavecrew delegation personas.

Two upstream products exist; this bundle ports the **skill/output** side. The BSL-licensed proxy/engine (input-token compression runtime) is a separate product and is not ported.

## Install

```sh
dsh plugin --profile web add <path-or-package>
```

Optional row config in the profile composition:

```yaml
- id: dsh-caveman
  name: dsh-caveman
  config:
    alwaysOn: true      # inject core caveman rule every session + every subagent (default true; upstream SessionStart hook analog)
    defaultMode: full   # lite | full | ultra | wenyan-lite | wenyan-full | wenyan-ultra
    provider: spawn     # ctx.subagents provider for cavecrew (spawn | fork)
    enableCavecrew: true
```

`alwaysOn` defaults to `true`, matching upstream caveman which is active on every session at `full`. Set it `false` to mount the skills and commands without auto-activation (the `caveman` skill still triggers on its phrases and `/caveman` switches mode explicitly). The section is registered on the shared `systemPrompt` service, so it rides through to spawned subagents — a child's `persona` shadows the global prompt layer, never replaces it.

## Skills

Registers six skills on `ctx.skills` (source `bundled`, resource base per skill directory):

| Skill | What it does |
|---|---|
| `caveman` | Core compressed-output mode: intensity levels, persistence, auto-clarity |
| `caveman-commit` | Terse Conventional-Commits message generator |
| `caveman-review` | One-line code-review comments (`L42: 🔴 bug: ...`) |
| `caveman-help` | Quick-reference card for modes, skills, cavecrew tools |
| `caveman-compress` | Compress natural-language memory files; out-of-tree `.original.md` backup |
| `cavecrew` | Decision guide: when to delegate to which cavecrew tool |

## Commands

Registers five slash commands on `ctx.commands` (from `prompts/*.md`; `{{args}}` interpolates raw input):

```text
/caveman [lite|full|ultra|wenyan-lite|wenyan-full|wenyan-ultra|off]
/caveman-commit
/caveman-review
/caveman-help
/caveman-compress <filepath>
```

`/caveman` falls back to the configured `defaultMode` when no level is given.

## Cavecrew delegation personas

The three upstream `agents/cavecrew-*.md` personas ship as `agents/*.md` (dsh-adapted) and are mounted at apply time as three `@deepseek-ai/dsh-tool-subagent` child fibers:

| Tool | Persona | Tool allowlist |
|---|---|---|
| `cavecrew_investigator` | Read-only code locator, `file:line` table output | `read grep glob bash` |
| `cavecrew_builder` | Surgical ≤2-file edit, diff receipt, refuses 3+ | `read edit write grep glob` |
| `cavecrew_reviewer` | Severity-tagged one-line diff findings | `read grep glob bash` |

The child gets the persona text (shadowing `deployment:persona`) and a `toolFilter.allow` allowlist — the allowlist also removes every other tool, including the delegation tools, so cavecrew children cannot spawn grandchildren. Background mode is `one-shot`: foreground by default, `run_in_background: true` returns a job id.

The `subagents` registry and its providers stay host-side; this bundle only mounts the delegation tool rows (same plane as the shipped preset's `tool-subagent` rows).

## Not ported

- **`caveman-stats`** — upstream is computed by a Claude Code hook reading the session log (`decision: "block"` injection). No dsh analog; a real port needs the session-query/token-accounting seam.
- **`caveman-init`** — writes per-repo IDE rule files for other agents (`src/tools/caveman-init.js`); not dsh-facing.
- **CLI-suite skills** (`caveman-discover`, `-explore`, `-learn`, `-manage`, `-optimize`, `-evidence-review`) and workflow packs (`investigate-first`, `lean-build`, `safe-refactor`, `surgical-patch`, `verify-and-stop`, `migration`) — delivered by the `@caveman-ai/cli` ecosystem, not the Claude plugin surface this port mirrors. Candidates for later ports.
- **Proxy / engine / cacheengine / rewriter / shrink** — the BSL input-compression product.
- Upstream persona `model: haiku` pinning — model routing is deployment-specific in dsh; add an `agentOptions` row config if you want it.

## Port notes

- Upstream's Claude Code `SessionStart` auto-activation hook maps to the optional `alwaysOn` row config, which registers a `systemPrompt` section (order `1`, right after the deployment persona) carrying the core rule. Off by default; the `caveman` skill's trigger phrases and `/caveman` cover activation without it.
- Codex/Gemini TOML command stubs (`commands/*.toml`) map to `prompts/*.md`: `description` frontmatter becomes the command description, `argument-hint` the input hint, and the TOML `prompt` body the handler's user message with `{{args}}` interpolated.
- `caveman-compress` upstream runs Python scripts that call the Claude API. Here the agent is the compressor: the skill carries the same remove/preserve/compress rules, backup location, validation checklist, and 2-retry bound.
- Cavecrew personas are adapted, not mirrored: Claude tool names (`Read`/`Grep`/`Glob`/`Edit`/`Write`/`Bash`) become dsh names in both the allowlists and the body text, `model:` pins drop, and refusal routing names the `cavecrew_builder` tool. Persona text must contain no `{{…}}` (strict per-child interpolation).
- Tool descriptions of the three cavecrew tools stay the generic delegation wording (`dsh-tool-subagent` derives them from the provider); the `cavecrew` skill carries the routing knowledge and output contracts, mirroring upstream where the skill is the decision guide.
