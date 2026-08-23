---
name: setup-pstack
description: Verify the current project can prove its behavior before pstack workflows run. Use for /setup-pstack or "set up pstack".
disable-model-invocation: true
---

# Set up pstack

DSH children inherit the parent model, so pstack has no role-to-model mapping to configure. What remains: make sure this project can prove its behavior.

## Verification check

Look for a way to prove app behavior in the current project: a project-local `verify-*` skill or a recognized test harness (vitest, jest, playwright, cypress, pytest, cargo, go, a `package.json` `test` script, a `Makefile` `test:` target, and similar).

- Found → report it and stop. Setup is done.
- None found → tell the user, and offer to generate a project verification skill via the `create-verification-skill` skill. Accept and that skill takes over; decline and setup moves on. You can run the `create-verification-skill` skill yourself any time.

## Rules

- Never claim verification exists without checking.
- Nothing here is repository configuration; nothing gets committed.
