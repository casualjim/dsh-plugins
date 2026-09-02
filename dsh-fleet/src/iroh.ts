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
}

export class FleetNode {
  private endpoint?: Endpoint;
  private readonly peers = new Map<string, Peer>();
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
    void this.reconnectLoop();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    for (const peer of this.peers.values()) peer.gatewayServer?.close();
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

  private async connectPeer(ticket: string): Promise<void> {
    if (this.stopped || this.endpoint === undefined) return;
    const addr = EndpointTicket.fromString(ticket.trim()).endpointAddr();
    const id = addr.id().toString();
    if (id === this.selfId) return;
    if (this.peers.get(id)?.conn !== undefined) return;

    const conn = await this.endpoint.connect(addr, ALPN);
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
    void this.ctrlLoop(remoteId, bi.recv);
    void this.pingLoop(remoteId, bi.send);
    void this.tunnelAcceptLoop(remoteId, conn);
    this.log("connected " + String(hello.name ?? remoteId));
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
      if (typeof entry.ticket === "string") void this.connectPeer(entry.ticket).catch(() => {});
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
    const hello = JSON.parse(line) as { t?: string; name?: string; dsh_port?: number; proof?: string };
    if (hello.t !== "hello" || !this.verify(remoteId, String(hello.proof ?? ""))) {
      await conn.close(1n, Array.from(new TextEncoder().encode("bad proof")));
      return;
    }
    this.upsertPeer(remoteId, String(hello.name ?? "peer"), Number(hello.dsh_port ?? 3080), conn, undefined);
    await writeLine(ctrl.send, this.selfHello());
    await writeLine(ctrl.send, this.rosterFrame());
    void this.ctrlLoop(remoteId, ctrl.recv);
    void this.tunnelAcceptLoop(remoteId, conn);
    this.log("peer " + String(hello.name ?? remoteId) + " connected");
  }

  private upsertPeer(id: string, name: string, dshPort: number, conn: Connection, ticket?: string): void {
    const peer = this.peers.get(id) ?? { id, name, dshPort };
    peer.name = name;
    peer.dshPort = dshPort;
    peer.conn = conn;
    if (ticket !== undefined) peer.ticket = ticket;
    this.peers.set(id, peer);
  }

  // ---------- shared loops ----------

  private async ctrlLoop(id: string, recv: RecvStream): Promise<void> {
    try {
      for (;;) {
        const line = await readLine(recv);
        const frame = JSON.parse(line) as { t?: string };
        if (frame.t === "roster") {
          await this.mergeRoster(frame as { peers?: Array<{ id?: string; name?: string; dsh_port?: number; ticket?: string | null }> });
        }
      }
    } catch {
      const peer = this.peers.get(id);
      if (peer !== undefined) peer.conn = undefined;
    }
  }

  private async pingLoop(id: string, send: SendStream): Promise<void> {
    for (;;) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        await writeLine(send, JSON.stringify({ t: "ping" }));
      } catch {
        const peer = this.peers.get(id);
        if (peer !== undefined) peer.conn = undefined;
        return;
      }
    }
  }

  private async tunnelAcceptLoop(id: string, conn: Connection): Promise<void> {
    try {
      for (;;) {
        const bi = await conn.acceptBi();
        const socket = await net.connect({ host: "127.0.0.1", port: this.config.dsh_port });
        pump(socket, bi.send, bi.recv);
      }
    } catch {
      const peer = this.peers.get(id);
      if (peer !== undefined) peer.conn = undefined;
    }
  }

  private async reconnectLoop(): Promise<void> {
    for (;;) {
      await new Promise((r) => setTimeout(r, 5000));
      if (this.stopped) return;
      for (const peer of this.peers.values()) {
        if (peer.conn === undefined && peer.ticket !== undefined) {
          void this.connectPeer(peer.ticket).catch(() => {});
        }
      }
      for (const ticket of this.config.peers) {
        void this.connectPeer(ticket).catch(() => {});
      }
    }
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
