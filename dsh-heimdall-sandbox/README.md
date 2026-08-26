# dsh-heimdall-sandbox

DSH sandbox provider (`ctx.sandbox`) delegating confinement to the
[heimdall-sandbox](https://github.com/casualjim/heimdall-sandbox) binary
(>= 0.1.45).

## Mapping

| DSH mode | heimdall policy |
|---|---|
| `read-only` | declared-empty `filesystem` block — reads kept, writes denied except platform temps + `/dev/null` |
| `workspace-write` | `writable: [session-cwd, ...extraWritableRoots]`; platform temps granted by profile defaults |
| `danger-full-access` | never reaches the provider |

`deniedPaths` passes through in heimdall's own syntax (`~/x`, absolute,
ordered `!negations`); denied beats writable.

## Config

```yaml
- id: sandbox
  name: dsh-heimdall-sandbox
  config:
    binaryPath: ""            # empty: npm wrapper, then PATH
    extraWritableRoots: []    # beyond the session workspace
    deniedPaths: []           # verbatim heimdall deny syntax
```

## Notes

- One policy JSON file per `confine()` call under a fresh private temp dir;
  removed when the provider stops. A crashed server leaks small files until
  OS temp sweeps.
- The in-process fs fence (`read`/`write`/`edit` tools) still enforces DSH's
  own workspace containment and does not see `deniedPaths`/extras — only
  spawned processes go through this provider.
- Enforcement reported `full` (Seatbelt on macOS, bubblewrap on Linux).
