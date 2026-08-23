# dsh-plugins

pnpm workspace of DeepSeek Harness plugin bundles. Each package is a Cordis bundle installable into a profile:

```sh
dsh plugin --profile web add <path-or-package>
```

## Packages

- `dsh-cavekit` — Cavekit SPEC.md workflow (ported from pi-cavekit: 9 skills + 8 /ck-* commands + FORMAT.md)
- `dsh-caveman` — Caveman compressed-output skills + commands + cavecrew delegation personas (ported from caveman: 6 skills + 5 /caveman* commands + 3 subagent tools)
- `dsh-ponytail` — TODO
- `dsh-headroom` — Headroom context compression over a configured proxy URL (ported from noheadroom: tool-result compression + /headroom command + headroom_retrieve tool, graceful degrade without proxy)
- `dsh-pstack` — Pstack skills + Poteto Mode + bundled agent personas (ported from pi-pstack: 44 skills + /poteto-mode + /setup-pstack commands + poteto_agent/comment_sicko subagent tools)
