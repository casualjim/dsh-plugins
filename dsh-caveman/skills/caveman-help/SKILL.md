---
name: caveman-help
description: >
  Quick-reference card for all caveman modes, skills, and commands.
  One-shot display, not a persistent mode. Trigger: /caveman-help,
  "caveman help", "what caveman commands", "how do I use caveman".
---

# Caveman Help

Display this reference card when invoked. One-shot — do NOT change mode, write flag files, or persist anything. Output in caveman style.

## Modes

| Mode | Trigger | What change |
|------|---------|-------------|
| **Lite** | `/caveman lite` | Drop filler. Keep sentence structure. |
| **Full** | `/caveman` | Drop articles, filler, pleasantries, hedging. Fragments OK. Default. |
| **Ultra** | `/caveman ultra` | Extreme compression. Bare fragments. Tables over prose. |
| **Wenyan-Lite** | `/caveman wenyan-lite` | Classical Chinese style, light compression. |
| **Wenyan-Full** | `/caveman wenyan` | Full 文言文. Maximum classical terseness. |
| **Wenyan-Ultra** | `/caveman wenyan-ultra` | Extreme. Ancient scholar on a budget. |

Mode stick until changed or session end.

## Skills

| Skill | Trigger | What it do |
|-------|---------|-----------|
| **caveman** | `/caveman` | Core mode. Terse responses, technical substance intact. |
| **caveman-commit** | `/caveman-commit` | Terse commit messages. Conventional Commits. ≤50 char subject. |
| **caveman-review** | `/caveman-review` | One-line PR comments: `L42: bug: user null. Add guard.` |
| **caveman-compress** | `/caveman-compress <file>` | Compress .md files to caveman prose. Saves ~46% input tokens. |
| **cavecrew** | "use cavecrew", "spawn investigator/builder/reviewer" | Delegate to compressed cavecrew subagents. |
| **caveman-help** | `/caveman-help` | This card. |

## Cavecrew delegation tools

| Tool | Job |
|------|-----|
| `cavecrew_investigator` | Read-only code locator. `file:line` table for "where is X". |
| `cavecrew_builder` | Surgical 1-2 file edit. Refuses 3+ files. |
| `cavecrew_reviewer` | Diff/branch/file review. Severity-tagged one-liners. |

## Deactivate

Say "stop caveman" or "normal mode". Resume anytime with `/caveman`.

## Language

Keep user's language by default. User write Portuguese → reply Portuguese caveman. Compress the style, not the language. Technical terms, code, commands, commit types, and exact error strings stay verbatim unless user ask for translation.

## Configure Default Mode

Default mode = `full`. Change it in the `dsh-caveman` row config of the profile's composition:

```yaml
- id: dsh-caveman
  name: dsh-caveman
  config:
    defaultMode: ultra
    alwaysOn: true   # inject core rule every session (upstream auto-activation)
```

`alwaysOn: true` = every session start caveman-active. Without it, mode activates on trigger phrases or `/caveman`.

## More

Full docs: https://github.com/JuliusBrussee/caveman
