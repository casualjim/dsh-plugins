---
name: cavecrew
description: >
  Decision guide for delegating to caveman-style subagents. Tells the main
  thread WHEN to spawn cavecrew_investigator (locate code), cavecrew_builder
  (1-2 file edit), or cavecrew_reviewer (diff review) instead of doing the
  work inline or using the generic subagent tool. Subagent output is
  caveman-compressed so the tool-result injected back into main context is
  ~60% smaller — main context lasts longer across long sessions.
  Trigger: "delegate to subagent", "use cavecrew", "spawn investigator/builder/reviewer",
  "save context", "compressed agent output".
---

Cavecrew = three delegation tools that run caveman-persona subagents. Same job as the generic `subagent` tool; difference is the tool-result they return is compressed, so main context shrinks per delegation.

## When to use cavecrew vs alternatives

| Task | Use |
|---|---|
| "Where is X defined / what calls Y / list uses of Z" | `cavecrew_investigator` |
| Same but you also want suggestions/architecture commentary | `subagent` (generic) |
| Surgical edit, ≤2 files, scope obvious | `cavecrew_builder` |
| New feature / 3+ files / cross-cutting refactor | Main thread or generic `subagent` |
| Review diff, branch, or file for bugs | `cavecrew_reviewer` |
| Deep code review with rationale + alternatives | `subagent` (generic) |
| One-line answer you already know | Main thread, no subagent |

Rule of thumb: **if you'd want the subagent's output in 1/3 the tokens, pick cavecrew. If you'd want prose, pick the generic subagent.**

## Why this exists (the real win)

Subagent tool results get injected into main context verbatim. A generic subagent that returns 2k tokens of prose costs 2k tokens of main-context budget every time. The same finding from `cavecrew_investigator` returns ~700 tokens. Across 20 delegations in one session that's the difference between context exhaustion and finishing the task.

## Output contracts

What main thread can rely on per tool:

**`cavecrew_investigator`**
```
<Header>:
- path:line — `symbol` — short note
totals: <counts>.
```
Or `No match.` Always file-path-first, line-number-attached, backticked symbols. Safe to grep with `path:\d+`.

**`cavecrew_builder`**
```
<path:line-range> — <change ≤10 words>.
verified: <re-read OK | mismatch @ path:line>.
```
Or one of: `too-big.` / `needs-confirm.` / `ambiguous.` / `regressed.` (terminal first token).

**`cavecrew_reviewer`**
```
path:line: <emoji> <severity>: <problem>. <fix>.
totals: N🔴 N🟡 N🔵 N❓
```
Or `No issues.` Findings sorted file → line ascending.

## Chaining patterns

**Locate → fix → verify** (most common):
1. `cavecrew_investigator` returns site list.
2. Main thread picks 1-2 sites, hands paths to `cavecrew_builder`.
3. `cavecrew_reviewer` audits the diff.

**Parallel scout** (when investigation is broad):
Spawn 2-3 `cavecrew_investigator` calls in one message (different angles: defs vs callers vs tests). Aggregate in main thread.

**Single-shot edit** (when site is already known):
Skip investigator. Hand exact path:line to `cavecrew_builder` directly.

## What NOT to do

- Don't use `cavecrew_builder` when you don't already know the file. Spawn investigator first or main thread will eat tokens passing context.
- Don't chain `cavecrew_investigator` → `cavecrew_builder` for a 5-file refactor. Builder will return `too-big.` and you'll have wasted a turn.
- Don't ask `cavecrew_reviewer` for "general feedback" — it returns findings only, no architecture opinions. Use the generic subagent for that.
- Don't expect prose. Cavecrew output is structured, sometimes terse to the point of cryptic. If a human will read it directly, paraphrase.

## Auto-clarity (inherited)

Cavecrew children drop caveman → normal English for security warnings, irreversible-action confirmations, and any output where fragment ambiguity could be misread. Resume caveman after.
