// lib/iroh.js
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import net from "node:net";
import { Endpoint, EndpointTicket, SecretKey } from "@number0/iroh";
var ALPN = Array.from(new TextEncoder().encode("dsh-fleet/1"));
function fleetHome() {
  return process.env.DSH_HOME !== void 0 && process.env.DSH_HOME !== "" ? join(process.env.DSH_HOME, "dsh-fleet") : join(process.env.HOME ?? ".", ".dsh", "dsh-fleet");
}
function defaultConfig() {
  return {
    fleet: "default",
    secret: randomBytes(32).toString("hex"),
    dsh_port: 3080,
    gateway_base: 7900,
    name: hostname(),
    peers: []
  };
}
function loadConfig() {
  const path = join(fleetHome(), "config.json");
  if (existsSync(path)) {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return { ...defaultConfig(), ...parsed };
  }
  const config = defaultConfig();
  saveConfig(config);
  return config;
}
function saveConfig(config) {
  mkdirSync(fleetHome(), { recursive: true });
  writeFileSync(join(fleetHome(), "config.json"), JSON.stringify(config, null, 2) + "\n");
}
var FleetNode = class {
  config;
  log;
  endpoint;
  peers = /* @__PURE__ */ new Map();
  selfId = "";
  stopped = false;
  constructor(config, log) {
    this.config = config;
    this.log = log;
  }
  proof(id) {
    return createHmac("sha256", Buffer.from(this.config.secret, "hex")).update(id).digest("hex");
  }
  verify(id, proof) {
    const expected = this.proof(id);
    const a = Buffer.from(expected);
    const b = Buffer.from(String(proof));
    return a.length === b.length && timingSafeEqual(a, b);
  }
  selfHello() {
    return JSON.stringify({
      t: "hello",
      id: this.selfId,
      name: this.config.name,
      dsh_port: this.config.dsh_port,
      proof: this.proof(this.selfId)
    });
  }
  async start() {
    const dir = fleetHome();
    mkdirSync(dir, { recursive: true });
    const idPath = join(dir, "identity.json");
    let secretHex;
    if (existsSync(idPath)) {
      secretHex = JSON.parse(readFileSync(idPath, "utf8")).secret;
    } else {
      secretHex = Buffer.from(SecretKey.generate().toBytes()).toString("hex");
      writeFileSync(idPath, JSON.stringify({ secret: secretHex }, null, 2) + "\n", { mode: 384 });
    }
    const key = Buffer.from(secretHex, "hex");
    if (key.length !== 32)
      throw new Error("bad identity secret");
    this.endpoint = await Endpoint.bind({ secretKey: Array.from(key), alpns: [ALPN] });
    await this.endpoint.online();
    this.selfId = this.endpoint.id().toString();
    this.log("up; fleet '" + this.config.fleet + "' id " + this.endpoint.id().fmtShort());
    void this.acceptLoop();
    for (const ticket of this.config.peers)
      void this.connectPeer(ticket).catch(() => {
      });
    void this.reconnectLoop();
  }
  async stop() {
    this.stopped = true;
    for (const peer of this.peers.values())
      peer.gatewayServer?.close();
    await this.endpoint?.close();
  }
  invite() {
    if (this.endpoint === void 0)
      throw new Error("not started");
    return EndpointTicket.fromAddr(this.endpoint.addr()).toString();
  }
  status() {
    const peers = [...this.peers.values()].map((p) => ({
      id: p.id,
      name: p.name,
      dsh_port: p.dshPort,
      online: p.conn !== void 0,
      gateway_port: p.gatewayPort ?? null
    }));
    return { self: { id: this.selfId, name: this.config.name, dsh_port: this.config.dsh_port }, peers };
  }
  async addPeer(ticket) {
    const trimmed = ticket.trim();
    const addr = EndpointTicket.fromString(trimmed).endpointAddr();
    const id = addr.id().toString();
    if (id === this.selfId)
      return;
    if (!this.config.peers.includes(trimmed)) {
      this.config.peers = [...this.config.peers, trimmed];
      saveConfig(this.config);
    }
    const existing = this.peers.get(id);
    this.peers.set(id, {
      id,
      name: existing?.name ?? "peer",
      dshPort: existing?.dshPort ?? 3080,
      ticket: trimmed,
      ...existing?.conn !== void 0 ? { conn: existing.conn } : {}
    });
    await this.connectPeer(trimmed);
  }
  /** Pairing code: base64url JSON {v, f, n, t, s} — ticket + fleet secret. */
  pairingCode() {
    if (this.endpoint === void 0)
      throw new Error("not started");
    const payload = {
      v: 1,
      f: this.config.fleet,
      n: this.config.name,
      t: EndpointTicket.fromAddr(this.endpoint.addr()).toString(),
      s: this.config.secret
    };
    return Buffer.from(JSON.stringify(payload)).toString("base64url");
  }
  /**
   * Pair from another machine's code. Adopts the incoming fleet (name +
   * secret) only while unpaired; refuses to silently re-key an existing
   * fleet. Then joins by ticket.
   */
  async pair(code) {
    const parsed = JSON.parse(Buffer.from(code.trim(), "base64url").toString("utf8"));
    if (parsed.v !== 1 || typeof parsed.t !== "string" || typeof parsed.s !== "string") {
      throw new Error("not a fleet pairing code");
    }
    const theirAddr = EndpointTicket.fromString(parsed.t.trim()).endpointAddr();
    if (theirAddr.id().toString() === this.selfId)
      throw new Error("that is your own pairing code");
    const paired = this.config.peers.length > 0;
    if (paired && parsed.s !== this.config.secret) {
      throw new Error("already paired with a different fleet (rotate secrets manually to switch)");
    }
    if (!paired && parsed.s !== this.config.secret) {
      this.config.secret = parsed.s;
      if (typeof parsed.f === "string" && parsed.f !== "")
        this.config.fleet = parsed.f;
    }
    await this.addPeer(parsed.t);
  }
  /** Drop a device: peer entry, gateway, persisted ticket. */
  removePeer(id) {
    const peer = this.peers.get(id);
    if (peer === void 0)
      return;
    peer.gatewayServer?.close();
    this.peers.delete(id);
    this.config.peers = this.config.peers.filter((ticket) => {
      try {
        return EndpointTicket.fromString(ticket).endpointAddr().id().toString() !== id;
      } catch {
        return false;
      }
    });
    saveConfig(this.config);
    this.log("removed " + peer.name);
  }
  async dial(id) {
    const peer = this.peers.get(id);
    if (peer === void 0)
      throw new Error("unknown peer");
    if (peer.conn === void 0)
      throw new Error("peer offline");
    if (peer.gatewayPort !== void 0 && peer.gatewayServer !== void 0)
      return peer.gatewayPort;
    const port = await this.findFreePort();
    const conn = peer.conn;
    const server = net.createServer((socket) => {
      void (async () => {
        try {
          const bi = await conn.openBi();
          pump(socket, bi.send, bi.recv);
        } catch {
          socket.destroy();
        }
      })();
    });
    await new Promise((resolve, reject) => {
      server.on("error", (err) => {
        this.log("gateway error:", String(err));
      });
      server.listen(port, "127.0.0.1", () => {
        resolve();
      });
    });
    peer.gatewayPort = port;
    peer.gatewayServer = server;
    this.log("gateway " + peer.name + " on 127.0.0.1:" + String(port));
    return port;
  }
  async findFreePort() {
    for (let port = this.config.gateway_base; port < this.config.gateway_base + 100; port++) {
      const free = await new Promise((resolve) => {
        const probe = net.connect(port, "127.0.0.1");
        probe.once("error", () => {
          resolve(true);
        });
        probe.once("connect", () => {
          probe.destroy();
          resolve(false);
        });
      });
      if (free)
        return port;
    }
    throw new Error("no free gateway port");
  }
  // ---------- outbound ----------
  async connectPeer(ticket) {
    if (this.stopped || this.endpoint === void 0)
      return;
    const addr = EndpointTicket.fromString(ticket.trim()).endpointAddr();
    const id = addr.id().toString();
    if (id === this.selfId)
      return;
    if (this.peers.get(id)?.conn !== void 0)
      return;
    const conn = await this.endpoint.connect(addr, ALPN);
    const bi = await conn.openBi();
    await writeLine(bi.send, this.selfHello());
    const line = await readLine(bi.recv);
    const hello = JSON.parse(line);
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
  rosterFrame() {
    const peers = [...this.peers.values()].filter((p) => p.conn !== void 0).map((p) => ({ id: p.id, name: p.name, dsh_port: p.dshPort, ticket: p.ticket ?? null }));
    return JSON.stringify({ t: "roster", peers });
  }
  async mergeRoster(frame) {
    for (const entry of frame.peers ?? []) {
      const id = entry.id;
      if (id === void 0 || id === this.selfId || this.peers.has(id))
        continue;
      this.peers.set(id, {
        id,
        name: String(entry.name ?? "peer"),
        dshPort: Number(entry.dsh_port ?? 3080),
        ...typeof entry.ticket === "string" ? { ticket: entry.ticket } : {}
      });
      if (typeof entry.ticket === "string")
        void this.connectPeer(entry.ticket).catch(() => {
        });
    }
  }
  // ---------- inbound ----------
  async acceptLoop() {
    while (!this.stopped && this.endpoint !== void 0) {
      const incoming = await this.endpoint.acceptNext();
      if (incoming === null)
        break;
      void (async () => {
        const accepting = await incoming.accept();
        const conn = await accepting.connect();
        await this.handleConn(conn);
      })().catch(() => {
      });
    }
  }
  async handleConn(conn) {
    const remoteId = conn.remoteId().toString();
    const ctrl = await conn.acceptBi();
    const line = await readLine(ctrl.recv);
    const hello = JSON.parse(line);
    if (hello.t !== "hello" || !this.verify(remoteId, String(hello.proof ?? ""))) {
      await conn.close(1n, Array.from(new TextEncoder().encode("bad proof")));
      return;
    }
    this.upsertPeer(remoteId, String(hello.name ?? "peer"), Number(hello.dsh_port ?? 3080), conn, void 0);
    await writeLine(ctrl.send, this.selfHello());
    await writeLine(ctrl.send, this.rosterFrame());
    void this.ctrlLoop(remoteId, ctrl.recv);
    void this.tunnelAcceptLoop(remoteId, conn);
    this.log("peer " + String(hello.name ?? remoteId) + " connected");
  }
  upsertPeer(id, name2, dshPort, conn, ticket) {
    const peer = this.peers.get(id) ?? { id, name: name2, dshPort };
    peer.name = name2;
    peer.dshPort = dshPort;
    peer.conn = conn;
    if (ticket !== void 0)
      peer.ticket = ticket;
    this.peers.set(id, peer);
  }
  // ---------- shared loops ----------
  async ctrlLoop(id, recv) {
    try {
      for (; ; ) {
        const line = await readLine(recv);
        const frame = JSON.parse(line);
        if (frame.t === "roster") {
          await this.mergeRoster(frame);
        }
      }
    } catch {
      const peer = this.peers.get(id);
      if (peer !== void 0)
        peer.conn = void 0;
    }
  }
  async pingLoop(id, send) {
    for (; ; ) {
      await new Promise((r) => setTimeout(r, 5e3));
      try {
        await writeLine(send, JSON.stringify({ t: "ping" }));
      } catch {
        const peer = this.peers.get(id);
        if (peer !== void 0)
          peer.conn = void 0;
        return;
      }
    }
  }
  async tunnelAcceptLoop(id, conn) {
    try {
      for (; ; ) {
        const bi = await conn.acceptBi();
        const socket = await net.connect({ host: "127.0.0.1", port: this.config.dsh_port });
        pump(socket, bi.send, bi.recv);
      }
    } catch {
      const peer = this.peers.get(id);
      if (peer !== void 0)
        peer.conn = void 0;
    }
  }
  async reconnectLoop() {
    for (; ; ) {
      await new Promise((r) => setTimeout(r, 5e3));
      if (this.stopped)
        return;
      for (const peer of this.peers.values()) {
        if (peer.conn === void 0 && peer.ticket !== void 0) {
          void this.connectPeer(peer.ticket).catch(() => {
          });
        }
      }
      for (const ticket of this.config.peers) {
        void this.connectPeer(ticket).catch(() => {
        });
      }
    }
  }
};
async function writeLine(send, line) {
  const bytes = new TextEncoder().encode(line + "\n");
  await send.writeAll(Array.from(bytes));
}
async function readLine(recv) {
  const out = [];
  for (; ; ) {
    const chunk = await recv.read(1);
    if (chunk.length === 0)
      throw new Error("ctrl closed");
    const byte = chunk[0];
    if (byte === 10)
      break;
    out.push(byte);
    if (out.length > 8192)
      throw new Error("ctrl line too long");
  }
  return new TextDecoder().decode(Uint8Array.from(out));
}
function pump(socket, send, recv) {
  socket.on("data", (chunk) => {
    void send.writeAll(Array.from(chunk)).catch(() => {
      socket.destroy();
    });
  });
  socket.on("end", () => {
    void send.finish().catch(() => {
    });
  });
  socket.on("error", () => {
    socket.destroy();
  });
  void (async () => {
    try {
      for (; ; ) {
        const chunk = await recv.read(65536);
        if (chunk.length === 0)
          break;
        if (!socket.write(Buffer.from(chunk))) {
          await new Promise((r) => {
            socket.once("drain", () => {
              r();
            });
          });
        }
      }
      socket.end();
    } catch {
      socket.destroy();
    }
  })();
}

// shared/loopback.js
function isLoopbackRequest(request) {
  const address = request.socket?.remoteAddress;
  if (address !== "127.0.0.1" && address !== "::1" && address !== "::ffff:127.0.0.1") return false;
  const host = request.headers.host;
  if (typeof host !== "string") return false;
  let hostUrl;
  try {
    hostUrl = new URL(`http://${host}`);
  } catch {
    return false;
  }
  if (hostUrl.hostname !== "127.0.0.1" && hostUrl.hostname !== "localhost" && hostUrl.hostname !== "[::1]") return false;
  if (request.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = request.headers.origin;
  if (origin === void 0) return true;
  try {
    return new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

// shared/host-utils.js
import { Buffer as Buffer2 } from "node:buffer";
function writeJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "referrer-policy": "no-referrer"
  });
  res.end(JSON.stringify(payload));
}
async function readJsonBody(req, limit = 2 * 1024 * 1024) {
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) return void 0;
      chunks.push(chunk);
    }
    const parsed = JSON.parse(Buffer2.concat(chunks).toString("utf8"));
    return typeof parsed === "object" && parsed !== null ? parsed : void 0;
  } catch {
    return void 0;
  }
}
function errorMessage(error) {
  try {
    if (error instanceof Error) return error.message;
    return String(error);
  } catch {
    return "[unrenderable thrown value]";
  }
}

// lib/routes.js
var ROUTES = {
  status: "/api/dsh-fleet/status",
  invite: "/api/dsh-fleet/invite",
  pairing: "/api/dsh-fleet/pairing",
  pair: "/api/dsh-fleet/pair",
  remove: "/api/dsh-fleet/remove",
  dial: "/api/dsh-fleet/dial",
  peers: "/api/dsh-fleet/peers"
};
function makeRoutes(deps) {
  const guard = (req, res) => {
    if (isLoopbackRequest(req))
      return true;
    writeJson(res, 403, { error: "forbidden: loopback-only" });
    return false;
  };
  return [
    {
      kind: "exact",
      path: ROUTES.status,
      handler: async (req, res) => {
        if (req.method !== "GET" || !guard(req, res))
          return;
        try {
          writeJson(res, 200, deps.node().status());
        } catch (error) {
          writeJson(res, 503, { error: errorMessage(error) });
        }
      }
    },
    {
      kind: "exact",
      path: ROUTES.invite,
      handler: async (req, res) => {
        if (req.method !== "GET" || !guard(req, res))
          return;
        try {
          writeJson(res, 200, {
            ticket: deps.node().invite(),
            fleet: deps.config.fleet,
            name: deps.config.name
          });
        } catch (error) {
          writeJson(res, 503, { error: errorMessage(error) });
        }
      }
    },
    {
      kind: "exact",
      path: ROUTES.pairing,
      handler: async (req, res) => {
        if (req.method !== "GET" || !guard(req, res))
          return;
        try {
          writeJson(res, 200, { code: deps.node().pairingCode(), fleet: deps.config.fleet, name: deps.config.name });
        } catch (error) {
          writeJson(res, 503, { error: errorMessage(error) });
        }
      }
    },
    {
      kind: "exact",
      path: ROUTES.pair,
      handler: async (req, res) => {
        if (req.method !== "POST" || !guard(req, res))
          return;
        const body = await readJsonBody(req);
        const code = typeof body?.code === "string" ? body.code : void 0;
        if (code === void 0 || code.trim() === "") {
          writeJson(res, 400, { error: "missing code" });
          return;
        }
        try {
          await deps.node().pair(code);
          writeJson(res, 200, { ok: true });
        } catch (error) {
          writeJson(res, 400, { error: errorMessage(error) });
        }
      }
    },
    {
      kind: "exact",
      path: ROUTES.remove,
      handler: async (req, res) => {
        if (req.method !== "POST" || !guard(req, res))
          return;
        const body = await readJsonBody(req);
        const id = typeof body?.id === "string" ? body.id : void 0;
        if (id === void 0 || id === "") {
          writeJson(res, 400, { error: "missing id" });
          return;
        }
        try {
          deps.node().removePeer(id);
          writeJson(res, 200, { ok: true });
        } catch (error) {
          writeJson(res, 400, { error: errorMessage(error) });
        }
      }
    },
    {
      kind: "exact",
      path: ROUTES.dial,
      handler: async (req, res) => {
        if (req.method !== "POST" || !guard(req, res))
          return;
        const body = await readJsonBody(req);
        const id = typeof body?.id === "string" ? body.id : void 0;
        if (id === void 0) {
          writeJson(res, 400, { error: "missing id" });
          return;
        }
        try {
          writeJson(res, 200, { port: await deps.node().dial(id) });
        } catch (error) {
          writeJson(res, 503, { error: errorMessage(error) });
        }
      }
    },
    {
      kind: "exact",
      path: ROUTES.peers,
      handler: async (req, res) => {
        if (req.method !== "POST" || !guard(req, res))
          return;
        const body = await readJsonBody(req);
        const ticket = typeof body?.ticket === "string" ? body.ticket : void 0;
        if (ticket === void 0 || ticket.trim() === "") {
          writeJson(res, 400, { error: "missing ticket" });
          return;
        }
        try {
          await deps.node().addPeer(ticket);
          writeJson(res, 200, { ok: true });
        } catch (error) {
          writeJson(res, 400, { error: errorMessage(error) });
        }
      }
    }
  ];
}

// lib/index.js
var name = "dsh-fleet";
var inject = ["webServer"];
function apply(ctx) {
  const log = (...args) => {
    if (ctx.logger?.info !== void 0)
      ctx.logger.info("[dsh-fleet]", ...args);
    else
      console.log("[dsh-fleet]", ...args);
  };
  const warn = (...args) => {
    if (ctx.logger?.warn !== void 0)
      ctx.logger.warn("[dsh-fleet]", ...args);
    else
      console.warn("[dsh-fleet]", ...args);
  };
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    warn("config load failed:", error instanceof Error ? error.message : String(error));
    return;
  }
  let node;
  let disposers = [];
  ctx.effect(() => {
    let cancelled = false;
    const fleet = new FleetNode(config, log);
    fleet.start().then(() => {
      if (cancelled) {
        void fleet.stop();
        return;
      }
      node = fleet;
      const routes = makeRoutes({
        node: () => fleet,
        config
      });
      disposers = routes.map((route) => ctx.webServer.register(route));
      log("fleet node running; join via GET /api/dsh-fleet/invite");
    }).catch((error) => {
      warn("fleet node failed:", error instanceof Error ? error.message : String(error));
    });
    return () => {
      cancelled = true;
      for (const dispose of disposers)
        dispose();
      void node?.stop();
    };
  });
}
export {
  FleetNode,
  ROUTES,
  apply,
  defaultConfig,
  fleetHome,
  inject,
  loadConfig,
  makeRoutes,
  name,
  saveConfig
};
