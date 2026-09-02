# dsh-fleet

DSH fleet: an iroh mesh of DeepSeek Harness web instances with a sidebar
dropdown to switch between them. Pure TypeScript — the iroh node runs
in-process in the plugin host via [`@number0/iroh`](https://www.npmjs.com/package/@number0/iroh)
(napi bindings, platform binaries from npm). No sidecar binary, no Rust build.

## How it works

- **Host** (`src/iroh.ts` `FleetNode`): one iroh endpoint per machine, persistent
  keypair at `~/.dsh/dsh-fleet/identity.json` (0600). Peers join by **invite
  ticket** (`GET /api/dsh-fleet/invite` — EndpointTicket string carrying id +
  relay URL + direct addrs). n0 relays holepunch; pkarr DNS resolves where
  available.
- **Wire** (ALPN `dsh-fleet/1`): first bi stream is CTRL (newline JSON); first
  frame must be `hello` with `HMAC-SHA256(fleet_secret, sender_id)` — anything
  else closes the connection. `roster` frames spread member tickets (full mesh
  from one join), `ping` keeps liveness (5s). Every later bi stream is a raw
  tunnel piped to `127.0.0.1:<dsh_port>` on the receiving side.
- **Gateway**: per-peer loopback TCP port (7900+) — the whole remote GUI
  (assets, apiproxy HTTP + WebSocket) works unchanged through it.
- **Browser** (`src/client/index.ts`): dropdown row injected below the sidebar
  New Session button (css-modules anchor `[class$="_newSession"]`), listing
  members with online dots. Picking one dials its gateway and navigates the
  tab there. The plugin runs on every member, so remote GUIs carry the same
  dropdown — pick "local" to come back.

## Pairing devices (Settings page)

1. Install the plugin on both machines and restart `dsh web`.
2. On machine A: open **Settings → Fleet**, copy the **pairing code**.
3. On machine B: **Settings → Fleet → Pair a device**, paste A's code, **Pair**.

B adopts A's fleet (name + secret) while unpaired, joins by ticket, and both
dropdowns list both machines within a few seconds. Third+ machines pair the
same way against *any* existing member — rosters spread, so one paste each is
all it takes. Removing a device: **Devices → Remove** on any member's page.

The pairing code is base64url `{v, f, n, t, s}` — fleet name, machine name,
invite ticket, fleet secret. It carries full fleet membership; treat it like
a password. Pairing into a different existing fleet is refused.

CLI equivalent: `GET /api/dsh-fleet/pairing` → code; on the other machine
`POST /api/dsh-fleet/pair {"code"}`. `POST /api/dsh-fleet/remove {"id"}`.

Config (`~/.dsh/dsh-fleet/config.json`): `fleet`, `secret` (hex64),
`dsh_port` (default 3080), `gateway_base` (7900), `name`, `peers` (tickets).

## Routes (loopback-only)

| route | purpose |
| --- | --- |
| `GET /api/dsh-fleet/status` | self + peers, online state, gateway ports |
| `GET /api/dsh-fleet/invite` | join ticket + fleet name |
| `POST /api/dsh-fleet/dial {id}` | allocate/return peer gateway port |
| `POST /api/dsh-fleet/peers {ticket}` | join peer (persisted) |

## Security model

- iroh = authenticated encrypted QUIC end to end; relays shuttle ciphertext only.
- Membership gate = fleet secret (HMAC proof in `hello`; unproven connections
  closed before any tunnel stream).
- Gateways bind 127.0.0.1 only. A switched-to remote GUI has **full** DSH
  control on that machine — treat the fleet secret like SSH key access.

## Status / limitations (v0)

- No settings card — config via file; dropdown shows `fleet · n/m`.
- Collapsed sidebar rail shows the row compact; wide-mode polish later.
- `@number0/iroh` streams take `Array<number>` (napi), so the pump converts
  per chunk — fine for GUI traffic, revisit for bulk transfers.
- Bare-id dial (pkarr discovery, no ticket) failed inside the dev sandbox and
  is not relied upon; tickets are the join path.
