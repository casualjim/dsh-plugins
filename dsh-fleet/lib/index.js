// lib/iroh.js
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import net from "node:net";
import { Endpoint, EndpointTicket, SecretKey } from "@number0/iroh";

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
          writeJson(res, 200, await deps.node().dial(id));
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

// lib/iroh.js
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
  launchToken;
  endpoint;
  peers = /* @__PURE__ */ new Map();
  dialing = /* @__PURE__ */ new Map();
  selfId = "";
  stopped = false;
  /** Local dispatcher for intercepted gateway requests — the browser runs
   * on this machine, so its fleet API must be served here, not tunneled. */
  routes;
  constructor(config, log, launchToken) {
    this.config = config;
    this.log = log;
    this.launchToken = launchToken;
    this.routes = makeRoutes({ node: () => this, config: this.config });
  }
  /** Set once the connection service loads; undefined before that. */
  homeUrl() {
    const token = this.launchToken?.();
    return token === void 0 ? void 0 : "http://127.0.0.1:" + String(this.config.dsh_port) + "/?token=" + token;
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
      proof: this.proof(this.selfId),
      ticket: this.invite(),
      token: this.launchToken?.()
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
  }
  async stop() {
    this.stopped = true;
    for (const peer of this.peers.values()) {
      if (peer.retryTimer !== void 0)
        clearTimeout(peer.retryTimer);
      peer.gatewayServer?.close();
    }
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
    return { self: { id: this.selfId, name: this.config.name, dsh_port: this.config.dsh_port }, home_url: this.homeUrl() ?? null, peers };
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
      return { port: peer.gatewayPort, token: peer.token };
    const port = await this.findFreePort();
    const conn = peer.conn;
    const server = net.createServer((socket) => {
      void this.gatewayConn(socket, conn, peer, port);
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
  async gatewayConn(socket, conn, peer, port) {
    socket.setTimeout(0);
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 25e3);
    socket.on("error", () => {
      socket.destroy();
    });
    let queue = [];
    let ended = false;
    let waiters = [];
    const onData = (chunk) => {
      const w = waiters.shift();
      if (w !== void 0)
        w(chunk);
      else
        queue.push(chunk);
    };
    const onEnd = () => {
      ended = true;
      for (const w of waiters.splice(0))
        w(Buffer.alloc(0));
    };
    const detach = () => {
      socket.off("data", onData);
      socket.off("end", onEnd);
    };
    socket.on("data", onData);
    socket.on("end", onEnd);
    const next = () => new Promise((resolve) => {
      if (queue.length > 0) {
        resolve(queue.shift());
        return;
      }
      if (ended) {
        resolve(Buffer.alloc(0));
        return;
      }
      waiters.push(resolve);
    });
    let pending = Buffer.alloc(0);
    try {
      for (; ; ) {
        let head = null;
        for (; ; ) {
          const marker = pending.indexOf("\r\n\r\n");
          if (marker >= 0) {
            head = pending.subarray(0, marker + 4);
            pending = pending.subarray(marker + 4);
            break;
          }
          if (pending.length > 65536)
            throw new Error("request head too large");
          const chunk = await next();
          if (chunk.length === 0) {
            head = null;
            break;
          }
          pending = Buffer.concat([pending, chunk]);
        }
        if (head === null)
          break;
        const parsed = parseHead(head);
        if (parsed === null) {
          this.log("gateway " + peer.name + " unparseable head: " + head.toString("latin1").slice(0, 120));
          detach();
          this.writeHttp(socket, 400, JSON.stringify({ error: "unparseable request head" }));
          return;
        }
        const want = Number.parseInt(parsed.headers["content-length"] ?? "", 10);
        const cl = Number.isFinite(want) && want > 0 ? want : 0;
        while (pending.length < cl) {
          const chunk = await next();
          if (chunk.length === 0)
            break;
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
        if (!alive)
          return;
      }
    } catch (error) {
      this.log("gateway " + peer.name + " conn error: " + errorMessage(error));
      if (!socket.destroyed)
        this.writeHttp(socket, 502, JSON.stringify({ error: "conn error: " + errorMessage(error) }));
    }
    detach();
    socket.destroy();
  }
  /**
   * Proxy one non-fleet request to the peer's web UI over a fresh tunnel
   * stream. Returns false when the socket must not serve more requests
   * (connection handed to a raw relay, or the tunnel failed).
   */
  async bridgeRequest(socket, conn, peer, port, parsed, body, detach) {
    const authority = "127.0.0.1:" + String(peer.dshPort);
    const headers = rewritten(parsed.headers, authority);
    if ((headers["transfer-encoding"] ?? "").toLowerCase().includes("chunked")) {
      detach();
      this.writeHttp(socket, 411, JSON.stringify({ error: "chunked request bodies are not bridged" }));
      return false;
    }
    delete headers["connection"];
    headers["connection"] = "close";
    let bi;
    try {
      bi = await conn.openBi();
    } catch (error) {
      this.log("gateway " + peer.name + " openBi: " + errorMessage(error));
      detach();
      this.writeHttp(socket, 502, JSON.stringify({ error: "openBi: " + errorMessage(error) }));
      return false;
    }
    this.log("gateway " + peer.name + " bridge " + parsed.method + " " + parsed.target);
    try {
      const lines = [parsed.method + " " + parsed.target + " HTTP/1.1"];
      for (const [key, value] of Object.entries(headers)) {
        if (key === "transfer-encoding" || key === "keep-alive" || key === "proxy-connection")
          continue;
        lines.push(key + ": " + value);
      }
      await bi.send.writeAll(Array.from(Buffer.from(lines.join("\r\n") + "\r\n\r\n", "latin1")));
      if (body.length > 0)
        await bi.send.writeAll(Array.from(body));
      await bi.send.finish().catch(() => {
      });
    } catch (error) {
      this.log("gateway " + peer.name + " send: " + errorMessage(error));
      detach();
      this.writeHttp(socket, 502, JSON.stringify({ error: "send: " + errorMessage(error) }));
      return false;
    }
    let respHead;
    try {
      respHead = await readRecvHead(bi.recv);
    } catch (error) {
      this.log("gateway " + peer.name + " resp head: " + errorMessage(error));
      detach();
      this.writeHttp(socket, 502, JSON.stringify({ error: "peer did not answer" }));
      return false;
    }
    const resp = parseRespHead(respHead);
    if (resp === null) {
      this.log("gateway " + peer.name + " unparseable response head: " + respHead.toString("latin1").slice(0, 120));
      detach();
      this.writeHttp(socket, 502, JSON.stringify({ error: "unparseable response head" }));
      return false;
    }
    const mark = "dsh-fleet-auth";
    if (resp.status === 401 && parsed.method === "GET" && parsed.path === "/" && typeof peer.token === "string" && peer.token !== "" && !parsed.target.includes(mark + "=")) {
      detach();
      this.writeHttp(socket, 303, "", {
        "cache-control": "no-store",
        location: "/?token=" + encodeURIComponent(peer.token) + "&" + mark + "=1",
        "referrer-policy": "no-referrer"
      });
      return false;
    }
    for (const key of Object.keys(resp.headers)) {
      if (key.toLowerCase() === "location")
        resp.headers[key] = rewriteLocation(String(resp.headers[key]), authority, port);
    }
    const out = ["HTTP/1.1 " + String(resp.status) + " " + reasonPhrase(resp.status)];
    for (const [key, value] of Object.entries(resp.headers))
      out.push(key + ": " + String(value));
    socket.write(Buffer.from(out.join("\r\n") + "\r\n\r\n", "latin1"));
    if (resp.status === 101) {
      detach();
      pump(socket, bi.send, bi.recv);
      return false;
    }
    try {
      for (; ; ) {
        const chunk = await bi.recv.read(65536);
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
    } catch {
      socket.destroy();
      return false;
    }
    return true;
  }
  /** Serve one intercepted fleet request locally; close the socket after. */
  async serveFleetApi(socket, parsed, body) {
    const route = this.routes.find((r) => r.kind === "exact" && r.path === parsed.path);
    if (route === void 0) {
      this.writeHttp(socket, 404, JSON.stringify({ error: "no such fleet route" }));
      return;
    }
    const state = { status: 0, headers: {}, body: "" };
    const req = {
      method: parsed.method,
      url: parsed.path,
      headers: parsed.headers,
      socket: { remoteAddress: "127.0.0.1" },
      [Symbol.asyncIterator]: async function* () {
        if (body.length > 0)
          yield body;
      }
    };
    const res = {
      writeHead(code, headers) {
        state.status = code;
        if (headers !== void 0)
          Object.assign(state.headers, headers);
      },
      end(text) {
        if (text !== void 0)
          state.body += String(text);
      }
    };
    try {
      await route.handler(req, res);
    } catch (error) {
      state.status = 500;
      state.body = JSON.stringify({ error: errorMessage(error) });
    }
    this.writeHttp(socket, state.status === 0 ? 500 : state.status, state.body, state.headers);
  }
  writeHttp(socket, status, body, headers = {}) {
    const extra = Object.entries(headers).map(([k, v]) => k + ": " + v).join("\r\n");
    const out = Buffer.from(body, "utf8");
    const headText = "HTTP/1.1 " + String(status) + " " + reasonPhrase(status) + "\r\n" + (extra === "" ? "" : extra + "\r\n") + "content-length: " + String(out.length) + "\r\nconnection: close\r\n\r\n";
    socket.end(Buffer.concat([Buffer.from(headText, "latin1"), out]));
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
  /**
   * Event-driven liveness: resolves when the connection closes; clears state
   * only if this conn is still the current one, then arms a retry.
   */
  watchConn(id, conn) {
    void conn.closed().then(() => {
      const peer = this.peers.get(id);
      if (peer === void 0 || peer.conn !== conn)
        return;
      peer.conn = void 0;
      if (peer.ticket !== void 0)
        this.scheduleRetry(peer.ticket, id);
    }).catch(() => {
    });
  }
  /** Exponential retry (1s doubling to 30s) while a peer is unreachable. */
  scheduleRetry(ticket, id) {
    if (this.stopped)
      return;
    const peer = this.peers.get(id);
    if (peer === void 0 || peer.retryTimer !== void 0)
      return;
    const delay = peer.backoffMs === void 0 ? 1e3 : Math.min(peer.backoffMs * 2, 3e4);
    peer.backoffMs = delay;
    peer.retryTimer = setTimeout(() => {
      peer.retryTimer = void 0;
      if (this.stopped || peer.conn !== void 0)
        return;
      void this.connectPeer(ticket).catch(() => {
      });
    }, delay);
    this.log("retry " + peer.name + " in " + String(delay) + "ms");
  }
  /** One dial in flight per peer — pair() and retry chains share it. */
  connectPeer(ticket) {
    let id = "";
    try {
      id = EndpointTicket.fromString(ticket.trim()).endpointAddr().id().toString();
    } catch {
      return Promise.resolve();
    }
    const inFlight = this.dialing.get(id);
    if (inFlight !== void 0)
      return inFlight;
    const dial = this.dialPeer(ticket, id).finally(() => {
      this.dialing.delete(id);
    });
    this.dialing.set(id, dial);
    return dial;
  }
  async dialPeer(ticket, id) {
    if (this.stopped || this.endpoint === void 0)
      return;
    if (id === this.selfId)
      return;
    if (this.peers.get(id)?.conn !== void 0)
      return;
    const addr = EndpointTicket.fromString(ticket.trim()).endpointAddr();
    let conn;
    try {
      conn = await this.endpoint.connect(addr, ALPN);
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
      this.peers.get(remoteId).token = typeof hello.token === "string" ? hello.token : void 0;
      await writeLine(bi.send, this.rosterFrame());
      void this.ctrlLoop(remoteId, bi.recv, conn);
      void this.tunnelAcceptLoop(remoteId, conn);
      const peer = this.peers.get(remoteId);
      if (peer !== void 0)
        peer.backoffMs = void 0;
      this.watchConn(remoteId, conn);
      this.log("connected " + String(hello.name ?? remoteId));
    } catch (error) {
      this.scheduleRetry(ticket.trim(), id);
      throw error;
    }
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
      if (typeof entry.ticket === "string") {
        this.persistTicket(entry.ticket);
        void this.connectPeer(entry.ticket).catch(() => {
        });
      }
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
    const ticket = typeof hello.ticket === "string" ? hello.ticket : void 0;
    if (ticket !== void 0)
      this.persistTicket(ticket);
    this.upsertPeer(remoteId, String(hello.name ?? "peer"), Number(hello.dsh_port ?? 3080), conn, ticket);
    this.peers.get(remoteId).token = typeof hello.token === "string" ? hello.token : void 0;
    await writeLine(ctrl.send, this.selfHello());
    await writeLine(ctrl.send, this.rosterFrame());
    void this.ctrlLoop(remoteId, ctrl.recv, conn);
    void this.tunnelAcceptLoop(remoteId, conn);
    const peer = this.peers.get(remoteId);
    if (peer !== void 0)
      peer.backoffMs = void 0;
    this.watchConn(remoteId, conn);
    this.log("peer " + String(hello.name ?? remoteId) + " connected");
  }
  /** Persist a peer ticket once (idempotent; survives restarts). */
  persistTicket(ticket) {
    if (this.config.peers.includes(ticket))
      return;
    this.config.peers = [...this.config.peers, ticket];
    saveConfig(this.config);
  }
  upsertPeer(id, name2, dshPort, conn, ticket) {
    const peer = this.peers.get(id) ?? { id, name: name2, dshPort };
    peer.name = name2;
    peer.dshPort = dshPort;
    const replaced = peer.conn;
    peer.conn = conn;
    if (ticket !== void 0)
      peer.ticket = ticket;
    this.peers.set(id, peer);
    if (replaced !== void 0 && replaced !== conn) {
      try {
        void replaced.close(0n, []);
      } catch {
      }
    }
  }
  // ---------- per-connection streams ----------
  // These loops are await-driven frame pumps, not timers. Online state is
  // owned solely by watchConn() (conn.closed()); stream errors just end the
  // pump — a closed connection fires the closed() watcher.
  async ctrlLoop(_id, recv, _conn) {
    try {
      for (; ; ) {
        const line = await readLine(recv);
        const frame = JSON.parse(line);
        if (frame.t === "roster") {
          await this.mergeRoster(frame);
        }
      }
    } catch {
    }
  }
  async tunnelAcceptLoop(_id, conn) {
    try {
      for (; ; ) {
        const bi = await conn.acceptBi();
        const socket = await net.connect({ host: "127.0.0.1", port: this.config.dsh_port });
        pump(socket, bi.send, bi.recv);
      }
    } catch {
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
function rewritten(headers, authority) {
  const out = { ...headers, host: authority };
  if (out.origin !== void 0)
    out.origin = "http://" + authority;
  if (out.referer !== void 0)
    out.referer = String(out.referer).replace(/^https?:\/\/[^/]+/, "http://" + authority);
  return out;
}
function rewriteLocation(location, upstream, port) {
  if (location.startsWith("http://" + upstream) || location.startsWith("https://" + upstream)) {
    return location.replace(/^https?:\/\/[^/]+/, "http://127.0.0.1:" + String(port));
  }
  return location;
}
function reasonPhrase(status) {
  return { 101: "Switching Protocols", 200: "OK", 302: "Found", 303: "See Other", 401: "Unauthorized", 404: "Not Found", 411: "Length Required", 500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable" }[status] ?? "Status";
}
async function readRecvHead(recv) {
  const out = [];
  for (; ; ) {
    const chunk = await recv.read(1);
    if (chunk.length === 0)
      throw new Error("upstream closed before response");
    out.push(chunk[0]);
    if (out.length > 65536)
      throw new Error("response head too large");
    const n = out.length;
    if (n >= 4 && out[n - 4] === 13 && out[n - 3] === 10 && out[n - 2] === 13 && out[n - 1] === 10)
      return Buffer.from(out);
  }
}
function parseRespHead(head) {
  const lines = head.toString("latin1").split("\r\n");
  const match = /^HTTP\/\d(?:\.\d)?\s+(\d{3})/.exec(lines[0] ?? "");
  if (match === null)
    return null;
  const headers = {};
  for (const line of lines.slice(1)) {
    const i = line.indexOf(":");
    if (i > 0)
      headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return { status: Number.parseInt(match[1], 10), headers };
}
function parseHead(head) {
  const lines = head.toString("latin1").split("\r\n");
  const parts = (lines[0] ?? "").split(" ");
  if (parts.length < 2)
    return null;
  const headers = {};
  for (const line of lines.slice(1)) {
    const i = line.indexOf(":");
    if (i > 0)
      headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  let path = parts[1];
  try {
    path = new URL(parts[1], "http://localhost").pathname;
  } catch {
  }
  return { method: parts[0], target: parts[1], path, headers };
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
  let launchToken;
  if (typeof ctx.inject === "function") {
    ctx.inject(["connection"], (c) => {
      const auth = c.connection?.authenticatedUrl;
      if (typeof auth !== "function")
        return;
      try {
        const url = new URL(auth.call(c.connection, "http://dsh.invalid"));
        const token = url.searchParams.get("token");
        if (token !== null && token !== "")
          launchToken = token;
      } catch {
      }
    });
  }
  ctx.effect(() => {
    let cancelled = false;
    const fleet = new FleetNode(config, log, () => launchToken);
    fleet.start().then(() => {
      if (cancelled) {
        void fleet.stop();
        return;
      }
      node = fleet;
      const routes = fleet.routes;
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
  parseHead,
  saveConfig
};
