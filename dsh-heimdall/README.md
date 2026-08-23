# dsh-heimdall

Guardian plugin for DeepSeek Harness that protects against accidental secret
exposure through tool calls. Ported from
[pi-heimdall](https://github.com/casualjim/pi-mimir/tree/main/packages/pi-heimdall).

The **sandbox-guard half is intentionally omitted**: DSH owns a native sandbox
seam (`ctx.sandbox`, fail-closed, approval escalation). This bundle ships only
the secret-hygiene guards pi's sandbox does not cover.

## Guards

| Guard | Type | Tool | Blocks / redacts |
|---|---|---|---|
| `env-protect` | opt-out | `read` | Reading `.env`, `.env.*`, `.envrc`, `*.env` — except `.env.example`, `.env.sample`, `.env.template`, `.env.dist`, `.env.defaults` |
| `kubectl-secret-guard` | opt-out | `bash` | `kubectl get secrets`, `kubectl patch ... finalizers`, `kubectl exec` dumping env / `/var/run/secrets` / `app.ini` |
| `sops-secret-guard` | opt-out | `bash` | `sops decrypt`, `sops -d`, `sops --decrypt`, `sops exec-env`, `sops exec-file`, `sops edit`, bare `sops <file>` |
| `command-policy-guard` | opt-out | `bash` | Commands that violate repo policy (see below) |
| `secret-guard` | opt-out | all text results | Commands referencing secret env var names from `.env.json`; redacts their values from tool result text before the model sees it (plaintext, base64, rot13, reversed, hex, hexdump) |

When a guard blocks a call the reason is delivered back to the model as the
tool result. It instructs the model to ask the user to run the command directly
and never to attempt a bypass.

## Install

```sh
dsh plugin --profile <name> add link:/path/to/dsh-plugins/dsh-heimdall
```

Restart the profile for the host row to activate.

## Configuration

Row config (in `cordis.patch.yml`) is deep-merged over the project-level
`.pi/heimdall.jsonc` at the session workspace root (`.json` fallback; JSONC
comments and trailing commas allowed). Later levels override earlier values
and append arrays.

```jsonc
{
  // These guard ids are opt-out.
  "disabled": ["env-protect", "kubectl-secret-guard"],
  "commandPolicies": [],
  "dotenv": ".env.json"
}
```

### command-policy-guard

Repo-specific command policies from `.pi/heimdall.jsonc`:

```jsonc
{
  "commandPolicies": [
    {
      "name": "no-cargo-test",
      "blocked": ["cargo", "test"],
      "message": "Use `mise test` instead of `cargo test`."
    },
    {
      "name": "bare-kubectl-apply",
      "blocked": ["kubectl", "apply"],
      "bare": true,
      "message": "kubectl apply must run bare; no pipe or redirect."
    }
  ]
}
```

`blocked` tokens prefix-match each shell segment after tokenization with bypass
hardening (env prefixes, wrappers, shell groups, `-c` recursion, quotes,
heredocs, multiline scripts). `bare: true` blocks the command only when its
output is piped or redirected. Known gaps (no full shell interpreter):
`timeout 60 cargo test`, `docker run ...`, indirect execution.

### secret-guard

`.env.json` at the workspace root listing environment variables treated as
secret. Values in the JSON are ignored — only the keys matter; actual values
are captured from `process.env` when a call runs. A `sops` key is skipped.

```json
{
  "GITHUB_TOKEN": "",
  "OPENAI_API_KEY": ""
}
```

Even without `.env.json`, bash output still gets generic trailing-pattern
redaction for `*(SECRET|KEY|TOKEN|PASSWORD|PASS|APIKEY|CREDENTIAL|PRIVATE)=...`.

### Scope notes (differences from pi)

- `env-protect` covers the `read` tool only, like pi — bash `cat .env` is not
  blocked by it (sandbox filesystem deny patterns are the DSH-native layer for
  that; see `sandbox-local` policy).
- Redaction runs on the `tools/post-execute` waterfall for every tool result
  with text content (`bash`, `read`, `grep`, `job_output`, `job_list`,
  `web_search`, `web_fetch`, ...), so secrets never reach the model-facing
  `tools/result` snapshot or the durable transcript. Raw output already stored
  by an earlier listener (e.g. a spill policy) is not retroactively redacted on
  disk.

## Development

```sh
pnpm install
pnpm build
pnpm test
```
