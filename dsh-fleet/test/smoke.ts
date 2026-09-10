// @ts-nocheck
// dsh-fleet smoke test — no network, no iroh endpoint.
//
// Covers: contract exports; config defaults + persistence round-trip
// (temp DSH_HOME); makeRoutes loopback guard + validation against a stub node.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DSH_HOME = mkdtempSync(join(tmpdir(), "dsh-fleet-smoke-"));

const mod = await import("../lib/index.js");
assert.equal(mod.name, "dsh-fleet");
assert.deepEqual(mod.inject, ["webServer"]);

const { loadConfig, fleetHome } = mod;
const config = loadConfig();
assert.equal(config.dsh_port, 3080);
assert.equal(config.peers.length, 0);
assert.ok(existsSync(join(fleetHome(), "config.json")));

// stub node: status/invite/dial without touching iroh
const stub = {
  status: () => ({ self: { id: "aa", name: "n", dsh_port: 3080 }, peers: [] }),
  invite: () => "ticket32",
  dial: async (id) => { if (id === "known") return { port: 7900 }; throw new Error("peer offline"); },
  addPeer: async () => {},
};
const { makeRoutes } = mod;
const routes = makeRoutes({ node: () => stub, config });
const byPath = Object.fromEntries(routes.map((r) => [r.path, r]));

const fakeReq = (extra = {}) => ({
  socket: { remoteAddress: "127.0.0.1" },
  headers: { host: "127.0.0.1:3080", ...extra },
  method: "GET",
  [Symbol.asyncIterator]: async function* () {},
});
const fakeRes = () => {
  const state = { status: 0, body: "" };
  return { state, writeHead(code) { state.status = code; }, end(text) { state.body = String(text); } };
};

let res = fakeRes();
await byPath["/api/dsh-fleet/status"].handler(fakeReq(), res);
assert.equal(res.state.status, 200);
assert.ok(res.state.body.includes("aa"));

res = fakeRes();
await byPath["/api/dsh-fleet/invite"].handler(fakeReq(), res);
assert.equal(res.state.status, 200);
assert.ok(res.state.body.includes("ticket32"));

res = fakeRes();
await byPath["/api/dsh-fleet/status"].handler(fakeReq({ host: "evil.example" }), res);
assert.equal(res.state.status, 403);

res = fakeRes();
await byPath["/api/dsh-fleet/dial"].handler({ ...fakeReq(), method: "POST" }, res);
assert.equal(res.state.status, 400);

res = fakeRes();
await byPath["/api/dsh-fleet/dial"].handler({ ...fakeReq(), method: "POST", [Symbol.asyncIterator]: async function* () { yield new TextEncoder().encode(JSON.stringify({ id: "known" })); } }, res);
assert.equal(res.state.status, 200);
assert.ok(res.state.body.includes("7900"));
assert.ok(!res.state.body.includes('"port":{"port"')); // regress: nested {port:{port,...}} broke client href

// gateway interception: fleet API served locally, not tunneled to the peer
const parsed = mod.parseHead(Buffer.from("POST /api/dsh-fleet/dial HTTP/1.1\r\nHost: 127.0.0.1:7911\r\nContent-Length: 14\r\n\r\n"));
assert.equal(parsed.path, "/api/dsh-fleet/dial");
assert.equal(parsed.headers["content-length"], "14");

const gwNode = new mod.FleetNode(config, () => {}, () => "tok");
gwNode.peers.set("known", { id: "known", name: "p", dshPort: 3080, conn: {}, gatewayPort: 7911, gatewayServer: {} });
let raw = "";
await gwNode.serveFleetApi({ on() {}, once() {}, off() {}, destroy() {}, end(data) { raw = Buffer.isBuffer(data) ? data.toString("latin1") : String(data); } }, parsed, Buffer.from(JSON.stringify({ id: "known" })));
assert.ok(raw.startsWith("HTTP/1.1 200"));
assert.ok(raw.includes("7911"));

// gatewayConn loop: fleet requests intercepted locally, others forwarded
{
  const forwarded = [];
  const fakeConn = {
    openBi: async () => ({
      send: { writeAll: async (bytes) => { forwarded.push(Buffer.from(bytes)); }, finish: async () => {} },
      recv: { read: () => new Promise(() => {}) },
    }),
  };
  const gwServer = net.createServer((sock) => { void gwNode.gatewayConn(sock, fakeConn); });
  await new Promise((r) => gwServer.listen(0, "127.0.0.1", r));
  const gwPort = gwServer.address().port;
  const waitFor = async (pred, ms = 3000) => {
    const t0 = Date.now();
    while (!pred()) { if (Date.now() - t0 > ms) return false; await new Promise((r) => setTimeout(r, 20)); }
    return true;
  };
  const resp = await new Promise((resolve) => {
    const c = net.connect(gwPort, "127.0.0.1", () => c.write(Buffer.from("POST /api/dsh-fleet/dial HTTP/1.1\r\nHost: 127.0.0.1:7911\r\nContent-Length: 14\r\n\r\n" + JSON.stringify({ id: "known" }))));
    let out = "";
    c.on("data", (d) => { out += d.toString("latin1"); });
    c.on("end", () => resolve(out));
  });
  assert.ok(resp.startsWith("HTTP/1.1 200"));
  assert.ok(resp.includes("7911"));
  assert.equal(forwarded.length, 0, "fleet request must not tunnel");
  const c2 = net.connect(gwPort, "127.0.0.1", () => c2.write(Buffer.from("GET /assets/app.js HTTP/1.1\r\nHost: 127.0.0.1:7911\r\n\r\n")));
  const assetForwarded = await waitFor(() => forwarded.some((b) => b.toString("latin1").includes("/assets/app.js")));
  c2.destroy();
  assert.ok(assetForwarded, "asset request must forward into the tunnel");
  await new Promise((r) => gwServer.close(r));
}

rmSync(process.env.DSH_HOME, { recursive: true, force: true });
console.log("dsh-fleet smoke: all assertions passed");
