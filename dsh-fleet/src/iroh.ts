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
import { errorMessage } from "../shared/host-utils.js";
import { makeRoutes } from "./routes.ts";

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
  token?: string;
  retryTimer?: ReturnType<typeof setTimeout>;
  backoffMs?: number;
}

export class FleetNode {
  private endpoint?: Endpoint;
  private readonly peers = new Map<string, Peer>();
  private readonly dialing = new Map<string, Promise<void>>();
  private selfId = "";
  private stopped = false;
  /** Local dispatcher for intercepted gateway requests — the browser runs
   * on this machine, so its fleet API must be served here, not tunneled. */
  readonly routes: ReturnType<typeof makeRoutes>;

  constructor(
    private readonly config: FleetConfig,
    private readonly log: (...a: unknown[]) => void,
    private readonly launchToken?: () => string | undefined,
  ) {
    this.routes = makeRoutes({ node: () => this, config: this.config });
  }

  /** Set once the connection service loads; undefined before that. */
  private homeUrl(): string | undefined {
    const token = this.launchToken?.();
    return token === undefined ? undefined : "http://127.0.0.1:" + String(this.config.dsh_port) + "/?token=" + token;
  }

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
      token: this.launchToken?.(),
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
    return { self: { id: this.selfId, name: this.config.name, dsh_port: this.config.dsh_port }, home_url: this.homeUrl() ?? null, peers };
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

  async dial(id: string): Promise<{ port: number; token?: string }> {
    const peer = this.peers.get(id);
    if (peer === undefined) throw new Error("unknown peer");
    if (peer.conn === undefined) throw new Error("peer offline");
    if (peer.gatewayPort !== undefined && peer.gatewayServer !== undefined) return { port: peer.gatewayPort, token: peer.token };
    const port = await this.findFreePort();
    const conn = peer.conn;
    const server = net.createServer((socket) => { void this.gatewayConn(socket, conn, peer, port); });
    await new Promise<void>((resolve, reject) => {
      // persistent handler: an unhandled 'error' event on a listening server
      // is an uncaught exception and takes the whole dsh web process down.
      server.on("error", (err) => { this.log("gateway error:", String(err)); });
      server.listen(port, "127.0.0.1", () => { resolve(); });
    });
    peer.gatewayPort = port;
    peer.gatewayServer = server;
    this.log("gateway " + peer.name + " on 127.0.0.1:" + String(port));
    return { port, token: peer.token };
  }

  /**
   * One browser connection to a gateway port. Requests under /api/dsh-fleet/
   * are served by THIS node — the browser runs on this machine, so a dial
   * must allocate a gateway here, never on the peer at the tunnel's far end
   * whose loopback the browser cannot reach. Everything else is proxied to
   * the peer's web UI the way a reverse proxy would: Host/Origin/Referer are
   * rewritten to the peer's listening address (the harness only accepts
   * requests whose Origin matches where it listens), a 401 on GET / mints a
   * token handoff, Location headers point back at the gateway, and websocket
   * upgrades are relayed raw.
   */
  private async gatewayConn(socket: net.Socket, conn: Connection, peer: Peer, port: number): Promise<void> {
    socket.setTimeout(0);
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 25000);
    socket.on("error", () => { socket.destroy(); });
    let queue: Buffer[] = [];
    let ended = false;
    let waiters: Array<(b: Buffer) => void> = [];
    const onData = (chunk: Buffer): void => { const w = waiters.shift(); if (w !== undefined) w(chunk); else queue.push(chunk); };
    const onEnd = (): void => { ended = true; for (const w of waiters.splice(0)) w(Buffer.alloc(0)); };
    const detach = (): void => { socket.off("data", onData); socket.off("end", onEnd); };
    socket.on("data", onData);
    socket.on("end", onEnd);
    const next = (): Promise<Buffer> => new Promise((resolve) => {
      if (queue.length > 0) { resolve(queue.shift()!); return; }
      if (ended) { resolve(Buffer.alloc(0)); return; }
      waiters.push(resolve);
    });

    let pending = Buffer.alloc(0);
    try {
      for (;;) {
        let head: Buffer | null = null;
        for (;;) {
          const marker = pending.indexOf("\r\n\r\n");
          if (marker >= 0) { head = pending.subarray(0, marker + 4); pending = pending.subarray(marker + 4); break; }
          if (pending.length > 65536) throw new Error("request head too large");
          const chunk = await next();
          if (chunk.length === 0) { head = null; break; }
          pending = Buffer.concat([pending, chunk]);
        }
        if (head === null) break;
        const parsed = parseHead(head);
        if (parsed === null) break;
        const want = Number.parseInt(parsed.headers["content-length"] ?? "", 10);
        const cl = Number.isFinite(want) && want > 0 ? want : 0;
        // ponytail: whole body buffered before bridging — fine for GUI-sized
        // bodies; stream it if bulk uploads through the tunnel ever matter
        while (pending.length < cl) {
          const chunk = await next();
          if (chunk.length === 0) break;
          pending = Buffer.concat([pending, chunk]);
        }
        const body = pending.subarray(0, Math.min(pending.length, cl));
        pending = pending.subarray(Math.min(pending.length, cl));
        if (parsed.path.startsWith("/api/dsh-fleet/")) {
          detach();
          await this.serveFleetApi(socket, parsed, body);
          return;
        }
        const alive = await this.bridgeRequest(socket, conn, peer, port, parsed, body, detach);
        if (!alive) return;
      }
    } catch {
      // fall through to cleanup
    }
    detach();
    socket.destroy();
  }

  /**
   * Proxy one non-fleet request to the peer's web UI over a fresh tunnel
   * stream. Returns false when the socket must not serve more requests
   * (connection handed to a raw relay, or the tunnel failed).
   */
  private async bridgeRequest(
    socket: net.Socket,
    conn: Connection,
    peer: Peer,
    port: number,
    parsed: ParsedHead,
    body: Buffer,
    detach: () => void,
  ): Promise<boolean> {
    const authority = "127.0.0.1:" + String(peer.dshPort);
    const headers = rewritten(parsed.headers, authority);
    if ((headers["transfer-encoding"] ?? "").toLowerCase().includes("chunked")) {
      // ponytail: chunked upload bodies are not bridged; browsers send
      // content-length for fetch uploads
      detach();
      this.writeHttp(socket, 411, JSON.stringify({ error: "chunked request bodies are not bridged" }));
      return false;
    }
    delete headers["connection"];
    headers["connection"] = "close";

    let bi: { send: SendStream; recv: RecvStream };
    try {
      bi = await conn.openBi();
    } catch {
      socket.destroy();
      detach();
      return false;
    }
    try {
      const lines = [parsed.method + " " + parsed.target + " HTTP/1.1"];
      for (const [key, value] of Object.entries(headers)) {
        if (key === "transfer-encoding" || key === "keep-alive" || key === "proxy-connection") continue;
        lines.push(key + ": " + value);
      }
      await bi.send.writeAll(Array.from(Buffer.from(lines.join("\r\n") + "\r\n\r\n", "latin1")));
      if (body.length > 0) await bi.send.writeAll(Array.from(body));
      await bi.send.finish().catch(() => {});
    } catch {
      socket.destroy();
      detach();
      return false;
    }

    let respHead: Buffer;
    try {
      respHead = await readRecvHead(bi.recv);
    } catch {
      detach();
      this.writeHttp(socket, 502, JSON.stringify({ error: "peer did not answer" }));
      return false;
    }
    const resp = parseRespHead(respHead);
    if (resp === null) {
      socket.destroy();
      detach();
      return false;
    }

    // token handoff: the harness refuses a browser without its launch token;
    // answer the refusal with the peer's own token instead of a dead 401
    const mark = "dsh-fleet-auth";
    if (resp.status === 401 && parsed.method === "GET" && parsed.path === "/" && typeof peer.token === "string" && peer.token !== "" && !parsed.target.includes(mark + "=")) {
      detach();
      this.writeHttp(socket, 303, "", {
        "cache-control": "no-store",
        location: "/?token=" + encodeURIComponent(peer.token) + "&" + mark + "=1",
        "referrer-policy": "no-referrer",
      });
      return false;
    }

    // keep the browser on the gateway: peer-side absolute URLs point at its
    // own loopback, which is not where this browser lives
    for (const key of Object.keys(resp.headers)) {
      if (key.toLowerCase() === "location") resp.headers[key] = rewriteLocation(String(resp.headers[key]), authority, port);
    }
    const out = ["HTTP/1.1 " + String(resp.status) + " " + reasonPhrase(resp.status)];
    for (const [key, value] of Object.entries(resp.headers)) out.push(key + ": " + String(value));
    socket.write(Buffer.from(out.join("\r\n") + "\r\n\r\n", "latin1"));

    if (resp.status === 101) {
      // websocket upgrade: relay raw both ways, stop parsing HTTP on this socket
      detach();
      pump(socket, bi.send, bi.recv);
      return false;
    }
    try {
      for (;;) {
        const chunk = await bi.recv.read(65536);
        if (chunk.length === 0) break;
        if (!socket.write(Buffer.from(chunk))) {
          await new Promise<void>((r) => { socket.once("drain", () => { r(); }); });
        }
      }
    } catch {
      socket.destroy();
      return false;
    }
    return true;
  }

  /** Serve one intercepted fleet request locally; close the socket after. */
  private async serveFleetApi(socket: net.Socket, parsed: ParsedHead, body: Buffer): Promise<void> {
    const route = this.routes.find((r) => r.kind === "exact" && r.path === parsed.path);
    if (route === undefined) {
      this.writeHttp(socket, 404, JSON.stringify({ error: "no such fleet route" }));
      return;
    }
    const state = { status: 0, headers: {} as Record<string, string>, body: "" };
    const req = {
      method: parsed.method,
      url: parsed.path,
      headers: parsed.headers,
      socket: { remoteAddress: "127.0.0.1" },
      [Symbol.asyncIterator]: async function* () { if (body.length > 0) yield body; },
    };
    const res = {
      writeHead(code: number, headers?: Record<string, string>) {
        state.status = code;
        if (headers !== undefined) Object.assign(state.headers, headers);
      },
      end(text?: string) { if (text !== undefined) state.body += String(text); },
    };
    try {
      await (route.handler as unknown as (r: unknown, s: unknown) => void | Promise<void>)(req, res);
    } catch (error) {
      state.status = 500;
      state.body = JSON.stringify({ error: errorMessage(error) });
    }
    this.writeHttp(socket, state.status === 0 ? 500 : state.status, state.body, state.headers);
  }

  private writeHttp(socket: net.Socket, status: number, body: string, headers: Record<string, string> = {}): void {
    const extra = Object.entries(headers).map(([k, v]) => k + ": " + v).join("\r\n");
    const out = Buffer.from(body, "utf8");
    const headText = "HTTP/1.1 " + String(status) + " " + reasonPhrase(status) + "\r\n" + (extra === "" ? "" : extra + "\r\n") + "content-length: " + String(out.length) + "\r\nconnection: close\r\n\r\n";
    socket.end(Buffer.concat([Buffer.from(headText, "latin1"), out]));
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
      const hello = JSON.parse(line) as { t?: string; name?: string; dsh_port?: number; proof?: string; token?: string };
      const remoteId = conn.remoteId().toString();
      if (hello.t !== "hello" || !this.verify(remoteId, String(hello.proof ?? ""))) {
        await conn.close(1n, Array.from(new TextEncoder().encode("bad proof")));
        throw new Error("peer hello rejected");
      }
      this.upsertPeer(remoteId, String(hello.name ?? "peer"), Number(hello.dsh_port ?? 3080), conn, ticket.trim());
      this.peers.get(remoteId)!.token = typeof hello.token === "string" ? hello.token : undefined;
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
    const hello = JSON.parse(line) as { t?: string; name?: string; dsh_port?: number; proof?: string; ticket?: string; token?: string };
    if (hello.t !== "hello" || !this.verify(remoteId, String(hello.proof ?? ""))) {
      await conn.close(1n, Array.from(new TextEncoder().encode("bad proof")));
      return;
    }
    // the dialer's own ticket rides the hello — persist it so pairing is
    // symmetric (one operation) and the acceptor can redial after restart.
    const ticket = typeof hello.ticket === "string" ? hello.ticket : undefined;
    if (ticket !== undefined) this.persistTicket(ticket);
    this.upsertPeer(remoteId, String(hello.name ?? "peer"), Number(hello.dsh_port ?? 3080), conn, ticket);
    this.peers.get(remoteId)!.token = typeof hello.token === "string" ? hello.token : undefined;
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

/** Host/Origin/Referer rewrite: the harness only accepts requests whose
 * Origin matches the address it listens on — any reverse proxy does this. */
function rewritten(headers: Record<string, string>, authority: string): Record<string, string> {
  const out: Record<string, string> = { ...headers, host: authority };
  if (out.origin !== undefined) out.origin = "http://" + authority;
  if (out.referer !== undefined) out.referer = String(out.referer).replace(/^https?:\/\/[^/]+/, "http://" + authority);
  return out;
}

/** Peer-side absolute URLs must point at the gateway the browser is on. */
function rewriteLocation(location: string, upstream: string, port: number): string {
  if (location.startsWith("http://" + upstream) || location.startsWith("https://" + upstream)) {
    return location.replace(/^https?:\/\/[^/]+/, "http://127.0.0.1:" + String(port));
  }
  return location;
}

function reasonPhrase(status: number): string {
  return ({ 101: "Switching Protocols", 200: "OK", 302: "Found", 303: "See Other", 401: "Unauthorized", 404: "Not Found", 411: "Length Required", 500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable" } as Record<number, string>)[status] ?? "Status";
}

/** Response head of one tunneled request, byte-exact so the body is not eaten. */
async function readRecvHead(recv: RecvStream): Promise<Buffer> {
  const out: number[] = [];
  for (;;) {
    const chunk = await recv.read(1);
    if (chunk.length === 0) throw new Error("upstream closed before response");
    out.push(chunk[0]);
    if (out.length > 65536) throw new Error("response head too large");
    const n = out.length;
    if (n >= 4 && out[n - 4] === 13 && out[n - 3] === 10 && out[n - 2] === 13 && out[n - 1] === 10) return Buffer.from(out);
  }
}

function parseRespHead(head: Buffer): { status: number; headers: Record<string, string> } | null {
  const lines = head.toString("latin1").split("\r\n");
  const match = /^HTTP\/\d(?:\.\d)?\s+(\d{3})/.exec(lines[0] ?? "");
  if (match === null) return null;
  const headers: Record<string, string> = {};
  for (const line of lines.slice(1)) {
    const i = line.indexOf(":");
    if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return { status: Number.parseInt(match[1], 10), headers };
}

export interface ParsedHead {
  method: string;
  target: string;
  path: string;
  headers: Record<string, string>;
}

/** Request line + headers of one HTTP request head (bytes up to \r\n\r\n). */
export function parseHead(head: Buffer): ParsedHead | null {
  const lines = head.toString("latin1").split("\r\n");
  const parts = (lines[0] ?? "").split(" ");
  if (parts.length < 2) return null;
  const headers: Record<string, string> = {};
  for (const line of lines.slice(1)) {
    const i = line.indexOf(":");
    if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  let path = parts[1];
  try { path = new URL(parts[1], "http://localhost").pathname; } catch { /* keep raw */ }
  return { method: parts[0], target: parts[1], path, headers };
}
