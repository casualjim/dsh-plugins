// @ts-nocheck
// dsh-fleet gateway e2e — two real iroh nodes in one process, one fake
// upstream HTTP server standing in for the peer's dsh web UI.
import http from "node:http";
import net from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const homeA = mkdtempSync(join(tmpdir(), "fleet-gw-a-"));
const homeB = mkdtempSync(join(tmpdir(), "fleet-gw-b-"));

const { FleetNode, loadConfig, saveConfig } = await import("../lib/index.js");

// fake upstream = the peer's dsh web UI; FLEET_UP_PORT redirects B to a
// real dsh web instead (for live diagnosis)
let upstream = null;
let UP_PORT = Number(process.env.FLEET_UP_PORT ?? "0");
if (UP_PORT === 0) {
  upstream = http.createServer((req, res) => {
    if (req.headers.host !== "127.0.0.1:" + UP_PORT) { res.writeHead(500); res.end("bad host " + req.headers.host); return; }
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<html>peer page</html>");
  });
  await new Promise((r) => upstream.listen(0, "127.0.0.1", r));
  UP_PORT = upstream.address().port;
}

process.env.DSH_HOME = homeB;
const configB = loadConfig();
configB.dsh_port = UP_PORT;
configB.gateway_base = 7960;
configB.name = "B";
saveConfig(configB);
const logB = [];
const nodeB = new FleetNode(configB, (...a) => logB.push(a.join(" ")), () => "tokB");
await nodeB.start();

process.env.DSH_HOME = homeA;
const configA = loadConfig();
configA.gateway_base = 7950;
configA.name = "A";
saveConfig(configA);
const logA = [];
const nodeA = new FleetNode(configA, (...a) => logA.push(a.join(" ")), () => "tokA");
await nodeA.start();

await nodeA.pair(nodeB.pairingCode());
// wait for pairing both ways
const bId = nodeB.status().self.id;
for (let i = 0; i < 20 && nodeA.status().peers.some((p) => p.id === bId && !p.online); i++) {
  await new Promise((r) => setTimeout(r, 250));
}
assert.ok(nodeA.status().peers.some((p) => p.id === bId && p.online), "A must see B online");

const dial = await nodeA.dial(bId);
console.log("dial:", JSON.stringify({ port: dial.port, token: dial.token }));

const resp = await new Promise((resolve, reject) => {
  const req = http.get({ host: "127.0.0.1", port: dial.port, path: "/?token=tokB" }, (res) => {
    let body = "";
    res.on("data", (d) => { body += d; });
    res.on("end", () => resolve({ status: res.statusCode, body }));
  });
  req.on("error", reject);
  setTimeout(() => reject(new Error("timeout waiting gateway response")), 8000);
});
console.log("resp:", JSON.stringify(resp));
console.log("--- logA ---");
for (const l of logA) console.log("A:", l);
console.log("--- logB ---");
for (const l of logB) console.log("B:", l);

await nodeA.stop();
await nodeB.stop();
if (upstream !== null) await new Promise((r) => upstream.close(r));
rmSync(homeA, { recursive: true, force: true });
rmSync(homeB, { recursive: true, force: true });
