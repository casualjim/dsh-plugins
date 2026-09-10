// @ts-nocheck
// dsh-fleet regression: websocket upgrade tunnels end to end. The gateway
// must forward Connection: Upgrade (node's 'upgrade' event needs it on the
// wire), keep its send side open for frames, and the peer relay must carry
// frames both ways.
import net from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const homeA = mkdtempSync(join(tmpdir(), "fleet-ws-a-"));
const homeB = mkdtempSync(join(tmpdir(), "fleet-ws-b-"));
const { FleetNode, loadConfig, saveConfig } = await import("../lib/index.js");

// fake upstream: answer the upgrade, then echo every frame after the head.
const upstream = net.createServer((sock) => {
  let mode = "head";
  let buf = Buffer.alloc(0);
  sock.on("data", (d) => {
    if (mode === "echo") { sock.write(d); return; }
    buf = Buffer.concat([buf, d]);
    const i = buf.indexOf("\r\n\r\n");
    if (i < 0) return;
    const head = buf.toString("latin1", 0, i);
    assert.match(head, /connection:\s*upgrade/i, "upgrade request must keep Connection: Upgrade");
    assert.match(head, /upgrade:\s*websocket/i, "upgrade request must keep Upgrade: websocket");
    sock.write("HTTP/1.1 101 Switching Protocols\r\nupgrade: websocket\r\nconnection: Upgrade\r\nsec-websocket-accept: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n");
    const rest = buf.subarray(i + 4);
    mode = "echo";
    if (rest.length > 0) sock.write(rest);
  });
});
await new Promise((r) => upstream.listen(0, "127.0.0.1", r));
const UP_PORT = upstream.address().port;

process.env.DSH_HOME = homeB;
const configB = loadConfig();
configB.dsh_port = UP_PORT;
configB.gateway_base = 8060;
configB.name = "B";
saveConfig(configB);
const nodeB = new FleetNode(configB, () => {}, () => "tokB");
await nodeB.start();

process.env.DSH_HOME = homeA;
const configA = loadConfig();
configA.gateway_base = 8050;
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
const outcome = await new Promise((resolve, reject) => {
  const sock = net.connect(dial.port, "127.0.0.1");
  let buf = "";
  let got101 = false;
  let echoed = false;
  sock.on("connect", () => {
    sock.write("GET /api/remote.mux HTTP/1.1\r\n"
      + "host: 127.0.0.1:" + String(dial.port) + "\r\n"
      + "upgrade: websocket\r\nconnection: Upgrade\r\n"
      + "sec-websocket-key: dGhlIHNhbXBsZSBub25jZQ==\r\nsec-websocket-version: 13\r\n"
      + "origin: http://127.0.0.1:" + String(dial.port) + "\r\n\r\n");
  });
  sock.on("data", (d) => {
    buf += d.toString("latin1");
    if (!got101) {
      const i = buf.indexOf("\r\n\r\n");
      if (i < 0) return;
      got101 = true;
      assert.match(buf.slice(0, i), /^HTTP\/1\.1 101/, "gateway must relay the 101");
      sock.write("ping-frame");
    } else if (buf.includes("ping-frame")) {
      echoed = true;
      sock.destroy();
      resolve({ got101, echoed });
    }
  });
  sock.setTimeout(8000, () => { sock.destroy(); reject(new Error("timeout; got101=" + String(got101) + " echoed=" + String(echoed))); });
  sock.on("error", reject);
});
assert.ok(outcome.got101 && outcome.echoed, "ws upgrade + echo failed: " + JSON.stringify(outcome));
console.log("PASS websocket upgrade tunneled both ways");

await nodeA.stop();
await nodeB.stop();
await new Promise((r) => upstream.close(r));
rmSync(homeA, { recursive: true, force: true });
rmSync(homeB, { recursive: true, force: true });
