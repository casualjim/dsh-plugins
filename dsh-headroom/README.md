# dsh-headroom

DeepSeek Harness port of the [noheadroom](https://github.com/raquezha/nothing/tree/main/packages/noheadroom) Pi extension: [Headroom](https://github.com/headroomlabs-ai/headroom) context compression as a DSH Cordis bundle.

## What it does

- **Tool-result compression** — before each model step, the current session surface is sent to a Headroom proxy (`/v1/compress` via the `headroom-ai` SDK client) and oversized tool results are replaced with their compressed forms. Only `tool/result` content mutates; user prompts, assistant text, tool-call metadata and tool ids are preserved, exactly like noheadroom's Pi policy.
- **CCR retrieval** — `headroom_retrieve` model tool fetches full originals for hashes in compression markers.
- **Stats & control** — `/headroom status|on|off|health|stats|mode <normal|quiet|silent>|run`.
- **Graceful degrade** — the proxy is a configured URL, never spawned or managed by this bundle. Unset or unreachable → compression is a no-op with a one-time warning; everything else keeps working.

## Install

```sh
dsh plugin --profile web add <path-to-this-package>
```

Run a Headroom proxy yourself (or point at an existing one):

```sh
headroom proxy --port 8787
```

## Configuration

Cordis row config (see `cordis.patch.yml`), environment second, defaults last.

| key | env | default | meaning |
|---|---|---|---|
| `baseUrl` | `DSH_HEADROOM_URL` → `HEADROOM_URL` → `HEADROOM_BASE_URL` | `null` | proxy URL; `null` degrades |
| `enabled` | `DSH_HEADROOM_ENABLED` | `true` | compression on at boot |
| `mode` | `DSH_HEADROOM_MODE` | `normal` | `normal`/`quiet`/`silent` output |
| `minContextTokens` | `DSH_HEADROOM_MIN_CONTEXT_TOKENS` | `20000` | skip passes below this surface token estimate |
| `minMessageChars` | `DSH_HEADROOM_MIN_MESSAGE_CHARS` | `2000` | per-tool-result candidate floor |
| `timeoutMs` | `DSH_HEADROOM_TIMEOUT_MS` | `30000` | per proxy call |
| `throttleMs` | `DSH_HEADROOM_THROTTLE_MS` | `3000` | minimum gap between passes |
| `allowRemote` | `DSH_HEADROOM_ALLOW_REMOTE` | `false` | refuse non-localhost URLs unless `true` |
| `renameToolCalls` | `DSH_HEADROOM_RENAME_TOOL_CALLS` | `true` | defeat Headroom's protected-tool exclusions (`read`, `bash`, …) |
| `maxSeenFingerprints` | `DSH_HEADROOM_MAX_SEEN_FINGERPRINTS` | `512` | seen-content FIFO cap |

## How it integrates (no proxy reliance, no interception)

DSH has no pre-LLM-call message interception seam; instead this bundle rewrites the durable session surface, the same pattern as the built-in `@deepseek-ai/dsh-compaction-tool-result-pruner`:

1. `agent/pre-step` fires → gates check (enabled, throttle, surface tokens ≥ `minContextTokens`).
2. Surface snapshot → converted to OpenAI wire messages (tool results as candidates, user/assistant as context; tool-call names renamed to `pi_tool_result` so Headroom's `DEFAULT_EXCLUDE_TOOLS` doesn't skip large reads).
3. `POST /v1/compress` → result validated per message (count, roles, tool_call ids unchanged).
4. Each applied tool result lands as a replacement `tool/result` node (`surfaceOp: replace`) preceded by the shared `compaction/prune` shadow-price event, so token accounting subtracts the shadowed node's price.
5. Loop prevention (ported from noheadroom): reentrancy flag, 3s throttle, input/output/candidate fingerprint trio, seen-content FIFO (original + applied hashes), guard-skip recording.

## What Headroom offers that this bundle does NOT cover

Headroom's full surface was investigated against the upstream repo (v0.36.4):

- **Memory** (`--memory`, cross-agent store) — proxy-side feature that only operates when chat requests pass THROUGH the proxy in passthrough mode. DSH sends chat directly to its provider and only calls `/v1/compress`, so the proxy's memory injection is unreachable. There is no memory HTTP endpoint.
- **Codebase indexing** (`--code-graph`) — not Headroom at all: it downloads and runs the third-party `codebase-memory-mcp` binary and watches files for it. No HTTP endpoint; not usable from a compression client.
- **`headroom learn`** — Python CLI that mines agent session logs and shells out to the `claude` CLI. Not exposed over HTTP.
- **Output token reduction** — implemented inside the proxy's passthrough path only.
- **Kompress-v2 ML model** — runs in the proxy's Rust core; we get it for free by talking to the proxy.

All of the above are proxy-side capabilities; this bundle consumes only the client-facing surface: `/v1/compress`, `/v1/retrieve`, `/stats`, `/health`.

## Port notes

- `bridge.ts` is a faithful port of noheadroom's `bridge.ts` (payload build, apply-back, alignment validation, marker naturalization, cheap token estimate) re-typed against `@deepseek-ai/dsh-llm` messages.
- `client.ts` + `proxy-manager.ts` from noheadroom are replaced by `transport.ts`: same HTTP endpoints via the official `headroom-ai` SDK client. No proxy process management exists.
- noheadroom's settings.json persistence is replaced by the cordis row config + env; `/headroom on|off|mode` mutate live state only.
- Markers are naturalized to name the `headroom_retrieve` tool (noheadroom named Pi's `read` tool; DSH has no fixed read tool).
- Token numbers in stats/footer text are the cheap `ceil(len/4)` estimate, not provider metering.
