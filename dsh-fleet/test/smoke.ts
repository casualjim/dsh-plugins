// @ts-nocheck
// dsh-fleet smoke test — no network, no iroh endpoint.
//
// Covers: contract exports; config defaults + persistence round-trip
// (temp DSH_HOME); makeRoutes loopback guard + validation against a stub node.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
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
  dial: async (id) => { if (id === "known") return 7900; throw new Error("peer offline"); },
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

rmSync(process.env.DSH_HOME, { recursive: true, force: true });
console.log("dsh-fleet smoke: all assertions passed");
