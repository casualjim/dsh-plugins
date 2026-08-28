# dsh-heimdall-sandbox

DSH sandbox provider (`ctx.sandbox`) delegating confinement to the
[heimdall-sandbox](https://github.com/casualjim/heimdall-sandbox) binary
(>= 0.1.45).

## Mapping

| DSH mode | heimdall policy |
|---|---|
| `read-only` | declared-empty `filesystem` block — reads kept, writes denied except platform temps + `/dev/null` |
| `workspace-write` | `filesystem.writable: [session-cwd, ...configured]`; platform temps granted by profile defaults |
| `danger-full-access` | never reaches the provider |

`filesystem.deny` passes through in pi-heimdall's own syntax (`~/x`,
absolute, ordered `!negations`); denied beats writable.

## Config

The config format is the pi-heimdall policy fragment, verbatim — the same
property names across agent harnesses, no renamed aliases.

```yaml
- id: sandbox
  name: dsh-heimdall-sandbox
  config:
    binaryPath: ""            # empty: npm wrapper, then PATH
    filesystem:
      writable: []            # beyond the session workspace
      deny: []                # verbatim pi-heimdall deny syntax
      virtual: {}             # in-sandbox path -> host path mounts
    network: host             # "host" (default) or "none"
    proc: default             # "default" or "none"
    env:                      # parent env filter
      allow: []
      deny: []
    sshAgent: false           # mount agent sockets (linux bwrap)
    gpgAgent: false
    ageAgent: false
    projects:                 # per-workspace overrides, longest key wins
      /path/to/project:
        filesystem:
          writable: []
          deny: []
```

## Layers

Policy layers, each merging over the previous (lists append, scalars take the
most specific layer, absent fields stay at binary defaults):

1. plugin definition `cordis.patch.yml` (this package's shipped defaults)
2. `~/.dsh/profiles/<profile>/cordis.patch.yaml` — the DSH loader merges 1+2
   into the provider config the plugin receives
3. `~/.dsh/heimdall.json` — `sandbox` section, user-global
4. `<workspaceRoot>/.dsh/heimdall.json` — `sandbox` section, per-workspace

The `projects` map lives in layers 1–2 (deployment config) and is matched by
workspace root between the config layers and the file layers.

Every policy field (except `binaryPath`) is valid inside a `projects` entry
and inside both files' `sandbox` sections. The files are multi-plugin: they
may also carry other plugins' sections (e.g. dsh-heimdall's
`commandPolicies`); this provider reads only `sandbox`. The workspace
file's existence is the opt-in — committing it lets that repo widen its own
writables to any path not covered by the global deny corpus. Global deny
still beats every writable. Malformed JSON fails loudly.



## Notes

- One policy JSON file per `confine()` call under a fresh private temp dir;
  removed when the provider stops. A crashed server leaks small files until
  OS temp sweeps.
- The in-process fs fence (`read`/`write`/`edit` tools) still enforces DSH's
  own workspace containment and does not see `filesystem.deny`/extras — only
  spawned processes go through this provider.
- Enforcement reported `full` (Seatbelt on macOS, bubblewrap on Linux).
