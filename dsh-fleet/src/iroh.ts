/**
 * dsh-fleet — in-process iroh fleet node (@number0/iroh).
 *
 * One endpoint per machine, persistent keypair. Peers join by invite ticket
 * (EndpointTicket string: id + relay URL + direct addrs). Wire protocol on
 * ALPN "dsh-fleet/1": first bi stream on a connection is CTRL (newline JSON;
 * first frame must be hello with HMAC-SHA256(fleet_secret, sender_id));
 * every later bi stream is a raw tunnel piped to 127.0.0.1:<dsh_port> on
 * the receiving side. Per-peer loopback gateway ports expose the tunnels to
 * the browser.
 *
 * ponytail: writeAll takes Array<number> (napi), so pump converts per chunk —
 * fine for GUI traffic; revisit if bulk transfers matter.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import net from "node:net";
import { Endpoint, EndpointTicket, SecretKey } from "@number0/iroh";
import type { Connection, RecvStream, SendStream } from "@number0/iroh";

const ALPN = Array.from(new TextEncoder().encode("dsh-fleet/1"));

export interface FleetConfig {
  fleet: string;
  secret: string;
  dsh_port: number;
  gateway_base: number;
  name: string;
  peers: string[]; // invite tickets
}

export function fleetHome(): string {
  return process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== ""
    ? join(process.env.DSH_HOME, "dsh-fleet")
    : join(process.env.HOME ?? ".", ".dsh", "dsh-fleet");
}

export function defaultConfig(): FleetConfig {
  return {
    fleet: "default",
    secret: randomBytes(32).toString("hex"),
    dsh_port: 3080,
    gateway_base: 7900,
    name: hostname(),
    peers: [],
  };
}

export function loadConfig(): FleetConfig {
  const path = join(fleetHome(), "config.json");
  if (existsSync(path)) {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<FleetConfig>;
    return { ...defaultConfig(), ...parsed };
  }
  const config = defaultConfig();
  saveConfig(config);
  return config;
}

export function saveConfig(config: FleetConfig): void {
  mkdirSync(fleetHome(), { recursive: true });
  writeFileSync(join(fleetHome(), "config.json"), JSON.stringify(config, null, 2) + "\n");
}

interface Peer {
  id: string;
  name: string;
  dshPort: number;
  ticket?: string;
  conn?: Connection;
  gatewayPort?: number;
  gatewayServer?: net.Server;
  retryTimer?: ReturnType<typeof setTimeout>;
  backoffMs?: number;
}

export class FleetNode {
  private endpoint?: Endpoint;
  private readonly peers = new Map<string, Peer>();
  private readonly dialing = new Map<string, Promise<void>>();
  private selfId = "";
  private stopped = false;

  constructor(private readonly config: FleetConfig, private readonly log: (...a: unknown[]) => void) {}

  private proof(id: string): string {
    return createHmac("sha256", Buffer.from(this.config.secret, "hex")).update(id).digest("hex");
  }

  private verify(id: string, proof: string): boolean {
    const expected = this.proof(id);
    const a = Buffer.from(expected);
    const b = Buffer.from(String(proof));
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private selfHello(): string {
    return JSON.stringify({
      t: "hello", id: this.selfId, name: this.config.name,
      dsh_port: this.config.dsh_port, proof: this.proof(this.selfId),
      ticket: this.invite(),
    });
  }

  async start(): Promise<void> {
    const dir = fleetHome();
    mkdirSync(dir, { recursive: true });
    const idPath = join(dir, "identity.json");
    let secretHex: string;
    if (existsSync(idPath)) {
      secretHex = (JSON.parse(readFileSync(idPath, "utf8")) as { secret: string }).secret;
    } else {
      secretHex = Buffer.from(SecretKey.generate().toBytes()).toString("hex");
      writeFileSync(idPath, JSON.stringify({ secret: secretHex }, null, 2) + "\n", { mode: 0o600 });
    }
    const key = Buffer.from(secretHex, "hex");
    if (key.length !== 32) throw new Error("bad identity secret");

    this.endpoint = await Endpoint.bind({ secretKey: Array.from(key), alpns: [ALPN] });
    await this.endpoint.online();
    this.selfId = this.endpoint.id().toString();
    this.log("up; fleet '" + this.config.fleet + "' id " + this.endpoint.id().fmtShort());

    void this.acceptLoop();
    for (const ticket of this.config.peers) void this.connectPeer(ticket).catch(() => {});
  }

  async stop(): Promise<void> {
    this.stopped = true;
    for (const peer of this.peers.values()) {
      if (peer.retryTimer !== undefined) clearTimeout(peer.retryTimer);
      peer.gatewayServer?.close();
    }
    await this.endpoint?.close();
  }

  invite(): string {
    if (this.endpoint === undefined) throw new Error("not started");
    return EndpointTicket.fromAddr(this.endpoint.addr()).toString();
  }

  status(): Record<string, unknown> {
    const peers = [...this.peers.values()].map((p) => ({
      id: p.id, name: p.name, dsh_port: p.dshPort,
      online: p.conn !== undefined, gateway_port: p.gatewayPort ?? null,
    }));
    return { self: { id: this.selfId, name: this.config.name, dsh_port: this.config.dsh_port }, peers };
  }

  async addPeer(ticket: string): Promise<void> {
    const trimmed = ticket.trim();
    const addr = EndpointTicket.fromString(trimmed).endpointAddr();
    const id = addr.id().toString();
    if (id === this.selfId) return;
    if (!this.config.peers.includes(trimmed)) {
      this.config.peers = [...this.config.peers, trimmed];
      saveConfig(this.config);
    }
    const existing = this.peers.get(id);
    this.peers.set(id, {
      id, name: existing?.name ?? "peer", dshPort: existing?.dshPort ?? 3080, ticket: trimmed,
      ...(existing?.conn !== undefined ? { conn: existing.conn } : {}),
    });
    await this.connectPeer(trimmed);
  }

  /** Pairing code: base64url JSON {v, f, n, t, s} — ticket + fleet secret. */
  pairingCode(): string {
    if (this.endpoint === undefined) throw new Error("not started");
    const payload = {
      v: 1, f: this.config.fleet, n: this.config.name,
      t: EndpointTicket.fromAddr(this.endpoint.addr()).toString(), s: this.config.secret,
    };
    return Buffer.from(JSON.stringify(payload)).toString("base64url");
  }

  /**
   * Pair from another machine's code. Adopts the incoming fleet (name +
   * secret) only while unpaired; refuses to silently re-key an existing
   * fleet. Then joins by ticket.
   */
  async pair(code: string): Promise<void> {
    const parsed = JSON.parse(Buffer.from(code.trim(), "base64url").toString("utf8")) as {
      v?: number; f?: string; n?: string; t?: string; s?: string;
    };
    if (parsed.v !== 1 || typeof parsed.t !== "string" || typeof parsed.s !== "string") {
      throw new Error("not a fleet pairing code");
    }
    const theirAddr = EndpointTicket.fromString(parsed.t.trim()).endpointAddr();
    if (theirAddr.id().toString() === this.selfId) throw new Error("that is your own pairing code");
    const paired = this.config.peers.length > 0;
    if (paired && parsed.s !== this.config.secret) {
      throw new Error("already paired with a different fleet (rotate secrets manually to switch)");
    }
    if (!paired && parsed.s !== this.config.secret) {
      this.config.secret = parsed.s;
      if (typeof parsed.f === "string" && parsed.f !== "") this.config.fleet = parsed.f;
    }
    await this.addPeer(parsed.t);
  }

  /** Drop a device: peer entry, gateway, persisted ticket. */
  removePeer(id: string): void {
    const peer = this.peers.get(id);
    if (peer === undefined) return;
    peer.gatewayServer?.close();
    this.peers.delete(id);
    this.config.peers = this.config.peers.filter((ticket) => {
      try { return EndpointTicket.fromString(ticket).endpointAddr().id().toString() !== id; }
      catch { return false; }
    });
    saveConfig(this.config);
    this.log("removed " + peer.name);
  }

  async dial(id: string): Promise<number> {
    const peer = this.peers.get(id);
    if (peer === undefined) throw new Error("unknown peer");
    if (peer.conn === undefined) throw new Error("peer offline");
    if (peer.gatewayPort !== undefined && peer.gatewayServer !== undefined) return peer.gatewayPort;
    const port = await this.findFreePort();
    const conn = peer.conn;
    const server = net.createServer((socket) => {
      void (async () => {
        try {
          const bi = await conn.openBi();
          pump(socket, bi.send, bi.recv);
        } catch { socket.destroy(); }
      })();
    });
    await new Promise<void>((resolve, reject) => {
      // persistent handler: an unhandled 'error' event on a listening server
      // is an uncaught exception and takes the whole dsh web process down.
      server.on("error", (err) => { this.log("gateway error:", String(err)); });
      server.listen(port, "127.0.0.1", () => { resolve(); });
    });
    peer.gatewayPort = port;
    peer.gatewayServer = server;
    this.log("gateway " + peer.name + " on 127.0.0.1:" + String(port));
    return port;
  }

  private async findFreePort(): Promise<number> {
    for (let port = this.config.gateway_base; port < this.config.gateway_base + 100; port++) {
      const free = await new Promise<boolean>((resolve) => {
        const probe = net.connect(port, "127.0.0.1");
        probe.once("error", () => { resolve(true); });
        probe.once("connect", () => { probe.destroy(); resolve(false); });
      });
      if (free) return port;
    }
    throw new Error("no free gateway port");
  }

  // ---------- outbound ----------

  /**
   * Event-driven liveness: resolves when the connection closes; clears state
   * only if this conn is still the current one, then arms a retry.
   */
  private watchConn(id: string, conn: Connection): void {
    void conn.closed().then(() => {
      const peer = this.peers.get(id);
      if (peer === undefined || peer.conn !== conn) return;
      peer.conn = undefined;
      if (peer.ticket !== undefined) this.scheduleRetry(peer.ticket, id);
    }).catch(() => {});
  }

  /** Exponential retry (1s doubling to 30s) while a peer is unreachable. */
  private scheduleRetry(ticket: string, id: string): void {
    if (this.stopped) return;
    const peer = this.peers.get(id);
    if (peer === undefined || peer.retryTimer !== undefined) return;
    const delay = peer.backoffMs === undefined ? 1000 : Math.min(peer.backoffMs * 2, 30000);
    peer.backoffMs = delay;
    peer.retryTimer = setTimeout(() => {
      peer.retryTimer = undefined;
      if (this.stopped || peer.conn !== undefined) return;
      void this.connectPeer(ticket).catch(() => {});
    }, delay);
    this.log("retry " + peer.name + " in " + String(delay) + "ms");
  }

  /** One dial in flight per peer — pair() and retry chains share it. */
  private connectPeer(ticket: string): Promise<void> {
    let id = "";
    try { id = EndpointTicket.fromString(ticket.trim()).endpointAddr().id().toString(); } catch { return Promise.resolve(); }
    const inFlight = this.dialing.get(id);
    if (inFlight !== undefined) return inFlight;
    const dial = this.dialPeer(ticket, id).finally(() => { this.dialing.delete(id); });
    this.dialing.set(id, dial);
    return dial;
  }

  private async dialPeer(ticket: string, id: string): Promise<void> {
    if (this.stopped || this.endpoint === undefined) return;
    if (id === this.selfId) return;
    if (this.peers.get(id)?.conn !== undefined) return;
    const addr = EndpointTicket.fromString(ticket.trim()).endpointAddr();

    let conn: Connection;
    try {
      conn = await this.endpoint.connect(addr, ALPN);
      const bi = await conn.openBi();
      await writeLine(bi.send, this.selfHello());
      const line = await readLine(bi.recv);
      const hello = JSON.parse(line) as { t?: string; name?: string; dsh_port?: number; proof?: string };
      const remoteId = conn.remoteId().toString();
      if (hello.t !== "hello" || !this.verify(remoteId, String(hello.proof ?? ""))) {
        await conn.close(1n, Array.from(new TextEncoder().encode("bad proof")));
        throw new Error("peer hello rejected");
      }
      this.upsertPeer(remoteId, String(hello.name ?? "peer"), Number(hello.dsh_port ?? 3080), conn, ticket.trim());
      await writeLine(bi.send, this.rosterFrame());
      void this.ctrlLoop(remoteId, bi.recv, conn);
      void this.tunnelAcceptLoop(remoteId, conn);
      const peer = this.peers.get(remoteId);
      if (peer !== undefined) peer.backoffMs = undefined;
      this.watchConn(remoteId, conn);
      this.log("connected " + String(hello.name ?? remoteId));
    } catch (error) {
      this.scheduleRetry(ticket.trim(), id);
      throw error;
    }
  }

  private rosterFrame(): string {
    const peers = [...this.peers.values()]
      .filter((p) => p.conn !== undefined)
      .map((p) => ({ id: p.id, name: p.name, dsh_port: p.dshPort, ticket: p.ticket ?? null }));
    return JSON.stringify({ t: "roster", peers });
  }

  private async mergeRoster(frame: { peers?: Array<{ id?: string; name?: string; dsh_port?: number; ticket?: string | null }> }): Promise<void> {
    for (const entry of frame.peers ?? []) {
      const id = entry.id;
      if (id === undefined || id === this.selfId || this.peers.has(id)) continue;
      this.peers.set(id, {
        id, name: String(entry.name ?? "peer"), dshPort: Number(entry.dsh_port ?? 3080),
        ...(typeof entry.ticket === "string" ? { ticket: entry.ticket } : {}),
      });
      if (typeof entry.ticket === "string") {
        this.persistTicket(entry.ticket);
        void this.connectPeer(entry.ticket).catch(() => {});
      }
    }
  }

  // ---------- inbound ----------

  private async acceptLoop(): Promise<void> {
    while (!this.stopped && this.endpoint !== undefined) {
      const incoming = await this.endpoint.acceptNext();
      if (incoming === null) break;
      void (async () => {
        const accepting = await incoming.accept();
        const conn = await accepting.connect();
        await this.handleConn(conn);
      })().catch(() => {});
    }
  }

  private async handleConn(conn: Connection): Promise<void> {
    const remoteId = conn.remoteId().toString();
    const ctrl = await conn.acceptBi();
    const line = await readLine(ctrl.recv);
    const hello = JSON.parse(line) as { t?: string; name?: string; dsh_port?: number; proof?: string; ticket?: string };
    if (hello.t !== "hello" || !this.verify(remoteId, String(hello.proof ?? ""))) {
      await conn.close(1n, Array.from(new TextEncoder().encode("bad proof")));
      return;
    }
    // the dialer's own ticket rides the hello — persist it so pairing is
    // symmetric (one operation) and the acceptor can redial after restart.
    const ticket = typeof hello.ticket === "string" ? hello.ticket : undefined;
    if (ticket !== undefined) this.persistTicket(ticket);
    this.upsertPeer(remoteId, String(hello.name ?? "peer"), Number(hello.dsh_port ?? 3080), conn, ticket);
    await writeLine(ctrl.send, this.selfHello());
    await writeLine(ctrl.send, this.rosterFrame());
    void this.ctrlLoop(remoteId, ctrl.recv, conn);
    void this.tunnelAcceptLoop(remoteId, conn);
    const peer = this.peers.get(remoteId);
    if (peer !== undefined) peer.backoffMs = undefined;
    this.watchConn(remoteId, conn);
    this.log("peer " + String(hello.name ?? remoteId) + " connected");
  }

  /** Persist a peer ticket once (idempotent; survives restarts). */
  private persistTicket(ticket: string): void {
    if (this.config.peers.includes(ticket)) return;
    this.config.peers = [...this.config.peers, ticket];
    saveConfig(this.config);
  }

  private upsertPeer(id: string, name: string, dshPort: number, conn: Connection, ticket?: string): void {
    const peer = this.peers.get(id) ?? { id, name, dshPort };
    peer.name = name;
    peer.dshPort = dshPort;
    const replaced = peer.conn;
    peer.conn = conn;
    if (ticket !== undefined) peer.ticket = ticket;
    this.peers.set(id, peer);
    // a newer connection replaced this one — shut the old down so its
    // teardown cannot mark the fresh conn offline (loop guards also check).
    if (replaced !== undefined && replaced !== conn) { try { void replaced.close(0n, []); } catch { /* already closed */ } }
  }

  // ---------- per-connection streams ----------
  // These loops are await-driven frame pumps, not timers. Online state is
  // owned solely by watchConn() (conn.closed()); stream errors just end the
  // pump — a closed connection fires the closed() watcher.

  private async ctrlLoop(_id: string, recv: RecvStream, _conn: Connection): Promise<void> {
    try {
      for (;;) {
        const line = await readLine(recv);
        const frame = JSON.parse(line) as { t?: string };
        if (frame.t === "roster") {
          await this.mergeRoster(frame as { peers?: Array<{ id?: string; name?: string; dsh_port?: number; ticket?: string | null }> });
        }
      }
    } catch { /* stream ended; watchConn() owns state */ }
  }

  private async tunnelAcceptLoop(_id: string, conn: Connection): Promise<void> {
    try {
      for (;;) {
        const bi = await conn.acceptBi();
        const socket = await net.connect({ host: "127.0.0.1", port: this.config.dsh_port });
        pump(socket, bi.send, bi.recv);
      }
    } catch { /* stream ended; watchConn() owns state */ }
  }
}

// ---------- stream plumbing ----------

async function writeLine(send: SendStream, line: string): Promise<void> {
  const bytes = new TextEncoder().encode(line + "\n");
  await send.writeAll(Array.from(bytes));
}

async function readLine(recv: RecvStream): Promise<string> {
  const out: number[] = [];
  for (;;) {
    const chunk = await recv.read(1);
    if (chunk.length === 0) throw new Error("ctrl closed");
    const byte = chunk[0];
    if (byte === 10) break;
    out.push(byte);
    if (out.length > 8192) throw new Error("ctrl line too long");
  }
  return new TextDecoder().decode(Uint8Array.from(out));
}

function pump(socket: net.Socket, send: SendStream, recv: RecvStream): void {
  socket.on("data", (chunk: Buffer) => {
    void send.writeAll(Array.from(chunk)).catch(() => { socket.destroy(); });
  });
  socket.on("end", () => { void send.finish().catch(() => {}); });
  socket.on("error", () => { socket.destroy(); });
  void (async () => {
    try {
      for (;;) {
        const chunk = await recv.read(65536);
        if (chunk.length === 0) break;
        if (!socket.write(Buffer.from(chunk))) {
          await new Promise<void>((r) => { socket.once("drain", () => { r(); }); });
        }
      }
      socket.end();
    } catch { socket.destroy(); }
  })();
}
