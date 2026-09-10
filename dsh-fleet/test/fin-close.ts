// @ts-nocheck
// dsh-fleet regression: upstream that aborts on early FIN (the dsh web GUI
// silently closes an authenticated request when the client half-closes its
// write side right after the request head). The relay must NOT forward the
// gateway's stream FIN to the upstream socket.
import http from "node:http";
import net from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const homeA = mkdtempSync(join(tmpdir(), "fleet-fin-a-"));
const homeB = mkdtempSync(join(tmpdir(), "fleet-fin-b-"));
const { FleetNode, loadConfig, saveConfig } = await import("../lib/index.js");

// fin-sensitive upstream: respond only if the client did not FIN before the
// response goes out (100ms window), else close silently like the harness.
const upstream = net.createServer((sock) => {
  let finned = false;
  sock.on("end", () => { finned = true; });
  sock.on("data", () => {
    if (sock._served) return;
    sock._served = true;
    setTimeout(() => {
      if (finned) { sock.destroy(); return; }
      sock.write("HTTP/1.1 200 OK\r\ncontent-type: text/plain\r\ncontent-length: 2\r\nconnection: close\r\n\r\nok");
      sock.end();
    }, 100);
  });
});
await new Promise((r) => upstream.listen(0, "127.0.0.1", r));
const UP_PORT = upstream.address().port;

process.env.DSH_HOME = homeB;
const configB = loadConfig();
configB.dsh_port = UP_PORT;
configB.gateway_base = 8030;
configB.name = "B";
saveConfig(configB);
const nodeB = new FleetNode(configB, () => {}, () => "tokB");
await nodeB.start();

process.env.DSH_HOME = homeA;
const configA = loadConfig();
configA.gateway_base = 8020;
configA.name = "A";
saveConfig(configA);
const nodeA = new FleetNode(configA, () => {}, () => "tokA");
await nodeA.start();

await nodeA.pair(nodeB.pairingCode());
const bId = nodeB.status().self.id;
for (let i = 0; i < 40 && !nodeA.status().peers.some((p) => p.id === bId && p.online); i++) {
  await new Promise((r) => setTimeout(r, 250));
}
assert.ok(nodeA.status().peers.some((p) => p.id === bId && p.online), "B must be online");

const dial = await nodeA.dial(bId);
const resp = await new Promise((resolve, reject) => {
  const req = http.get({ host: "127.0.0.1", port: dial.port, path: "/" }, (res) => {
    let body = "";
    res.on("data", (d) => { body += d; });
    res.on("end", () => resolve({ status: res.statusCode, body }));
  });
  req.on("error", reject);
  setTimeout(() => reject(new Error("timeout waiting gateway response")), 8000);
});
assert.equal(resp.status, 200, "fin-sensitive upstream must still answer: " + JSON.stringify(resp));
assert.equal(resp.body, "ok");
console.log("PASS fin-sensitive upstream answered through tunnel");

await nodeA.stop();
await nodeB.stop();
await new Promise((r) => upstream.close(r));
rmSync(homeA, { recursive: true, force: true });
rmSync(homeB, { recursive: true, force: true });
