# dsh-pstack

DeepSeek Harness port of `pi-pstack` (a pi-mimir fork of [Cursor's pstack](https://github.com/cursor/plugins/tree/main/pstack)): all 44 skills, sticky Poteto Mode, and the bundled `poteto-agent` / `comment-sicko` agent personas, adapted to what DSH supports.

## What's included

- **44 skills** under `skills/` — pstack's playbooks, principles, and workflow skills, registered as bundled DSH skills. Skill directories are the resource base, so `references/` and `playbooks/` paths inside skill bodies resolve.
- **`/poteto-mode [task]` and `/poteto-mode off`** — sticky session mode. While enabled, a system-prompt section instructs the agent to follow the `poteto-mode` workflow. Enabling with a task also routes that task through the skill.
- **`/setup-pstack`** — checks the current project has a way to prove app behavior (a `verify-*` skill or test harness) and offers to generate one via `create-verification-skill`.
- **`poteto_agent` and `comment_sicko`** — the bundled agent personas as DSH subagent tools (one-shot, spawn provider). `comment_sicko` ships a tool allowlist (`read`, `grep`, `glob`, `bash`); `poteto_agent` keeps the full tool set.

## What's dropped vs upstream

- **`subagent` tool registration.** DSH's `subagent` tool already exists; the bundled personas are separate tools instead, and skills call them by tool name.
- **`pstack_todo` / `pstack_sessions` / `pstack_config`.** DSH has native `todo_write`, `session_search` / `session_event_search`, and model selection belongs to the runtime. Skills were rewritten to use the native tools; children inherit the parent model.
- **Role-to-model mapping** (`~/.pi/agent/pstack/models.json`). DSH tool-subagent children have no per-call model routing; workflow skills use distinct critical lenses instead of distinct models.
- **Shell-confirmation guard.** DSH's sandbox and approval stack gate external and irreversible commands natively.
- **`poteto-mode/scripts`** (bun-based orch/watch-pr tooling). Playbooks now use DSH background bash jobs and `job_output` polling instead.
- **Graphite / `gt`.** Shipping, babysit, autopilot-stack, and orchestrate playbooks were rewritten for host-CLI workflows: `tea` on Gitea, `gh` on GitHub (detected from `git remote get-url origin`), with bottom-up manual or auto-merge instead of a Graphite merge queue, and `git rebase` instead of `gt restack`.

## Install

```sh
dsh plugin --profile web add <path-to-dsh-pstack>
```

Row config (all optional): `provider` (subagent provider, default `spawn`), `enableAgents` (default `true`), `enablePotetoSection` (default `true`).
