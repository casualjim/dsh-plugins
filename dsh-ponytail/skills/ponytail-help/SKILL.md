---
name: ponytail-help
description: >
  Quick-reference card for all ponytail modes, skills, and commands.
  One-shot display, not a persistent mode. Trigger: /ponytail-help,
  "ponytail help", "what ponytail commands", "how do I use ponytail".
---

# Ponytail Help

Display this reference card when invoked. One-shot, do NOT change mode,
write flag files, or persist anything.

## Levels

| Level | Trigger | What change |
|-------|---------|-------------|
| **Lite** | `/ponytail lite` | Build what's asked, name the lazier alternative in one line. |
| **Full** | `/ponytail` | The ladder enforced: YAGNI → reuse → stdlib → native → installed dep → one line → minimum. Default. |
| **Ultra** | `/ponytail ultra` | YAGNI extremist. Deletion before addition. Challenges requirements before building. |
| **Off** | `/ponytail off` | Deactivate ponytail for this session. |

Level sticks until changed or session end.

## Skills

| Skill | Trigger | What it does |
|-------|---------|--------------|
| **ponytail** | `/ponytail` | Lazy mode itself. Simplest solution that works. |
| **ponytail-review** | `/ponytail-review` | Over-engineering review: `L42: yagni: factory, one product. Inline.` |
| **ponytail-audit** | `/ponytail-audit` | Whole-repo over-engineering audit: ranked list of what to delete. |
| **ponytail-debt** | `/ponytail-debt` | Harvest `ponytail:` shortcut comments into a tracked ledger. |
| **ponytail-gain** | `/ponytail-gain` | Measured-impact scoreboard: less code, less cost, more speed. |
| **ponytail-help** | `/ponytail-help` | This card. |

## Deactivate

Say "stop ponytail" or "normal mode". Resume anytime with `/ponytail`.
`/ponytail off` also works.

## Configure Default Mode

Default mode = `full`, auto-active every session. In dsh-ponytail the default
is set on the plugin row in your agent-preset composition, not via env var or
config file:

```yaml
- id: dsh-ponytail
  name: dsh-ponytail
  config:
    alwaysOn: true        # inject the ponytail ruleset every session (default)
    defaultMode: full     # off | lite | full | ultra
```

Set `alwaysOn: false` to deactivate auto-activation; activate manually with
`/ponytail` when wanted. Set `defaultMode: off` to keep the row mounted but
start sessions inactive.

Resolution order inside the plugin: row `config.defaultMode`, then the
`PONYTAIL_DEFAULT_MODE` environment variable, then `full`.

## More

Full docs + examples: https://github.com/DietrichGebert/ponytail