// dsh-fleet mesh integration test — real iroh, two processes.
// Proves: one-op symmetric pairing (hello ticket), restart recovery,
// online-state stability (no false-offline flap).
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const home = mkdtempSync(join(tmpdir(), "dsh-fleet-mesh-"));
const homes = { a: join(home, "a"), b: join(home, "b") };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeChild(name, nodeHome, gatewayBase) {
  const child = spawn(process.execPath, [new URL("./mesh-child.ts", import.meta.url).pathname], {
    env: {
      ...process.env, DSH_HOME: nodeHome, FLEET_NAME: name, FLEET_GATEWAY_BASE: String(gatewayBase),
      NODE_OPTIONS: (process.env.NODE_OPTIONS ?? "") + " --experimental-strip-types",
    },
    stdio: ["pipe", "pipe", "inherit"],
  });
  const waiters = [];
  const events = [];
  let buf = "";
  child.stdout.on("data", (chunk) => {
    buf += String(chunk);
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx); buf = buf.slice(idx + 1);
      if (line.trim() === "") continue;
      let ev; try { ev = JSON.parse(line); } catch { continue; }
      events.push(ev);
      waiters.forEach((w) => w(ev));
    }
  });
  const send = (msg) => { child.stdin.write(JSON.stringify(msg) + "\n"); };
  const waitFor = (pred, timeoutMs, what) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waiters.splice(i, 1); reject(new Error("timeout waiting for " + what + " from " + name)); }, timeoutMs);
    const i = waiters.push((ev) => { if (pred(ev)) { clearTimeout(timer); waiters.splice(waiters.indexOf(fn), 1); resolve(ev); } }) - 1;
    const fn = waiters[i];
    for (const past of events) { if (pred(past)) { clearTimeout(timer); waiters.splice(waiters.indexOf(fn), 1); resolve(past); return; } }
  });
  return { child, send, waitFor, name };
}

const startChild = async (name, nodeHome, gatewayBase) => {
  const c = makeChild(name, nodeHome, gatewayBase);
  c.send({ cmd: "start" });
  await c.waitFor((ev) => ev.ev === "up", 30000, "up");
  return c;
};

const statusOf = async (c) => (await (async () => { c.send({ cmd: "status" }); const ev = await c.waitFor((e) => e.ev === "status", 5000, "status"); return ev.status; })());

const bothOnline = async (a, b) => {
  const sa = await statusOf(a); const sb = await statusOf(b);
  const aSeesB = sa.peers.some((p) => p.name === "node-b" && p.online);
  const bSeesA = sb.peers.some((p) => p.name === "node-a" && p.online);
  return { aSeesB, bSeesA, sa, sb };
};

let a, b;
try {
  a = await startChild("node-a", homes.a, 7910);
  b = await startChild("node-b", homes.b, 7920);

  // 1. ONE operation: B pairs with A's code -> both sides must end up paired.
  a.send({ cmd: "pairing" });
  const code = (await a.waitFor((ev) => ev.ev === "pairing", 5000, "pairing")).code;
  b.send({ cmd: "pair", code });
  await b.waitFor((ev) => ev.ev === "paired" || ev.ev === "error", 10000, "paired");
  let st = { aSeesB: false, bSeesA: false };
  for (let i = 0; i < 25 && !(st.aSeesB && st.bSeesA); i++) { await sleep(1000); st = await bothOnline(a, b); }
  assert.ok(st.aSeesB && st.bSeesA, "pairing not symmetric after one op: " + JSON.stringify({ aSeesB: st.aSeesB, bSeesA: st.bSeesA }));
  console.log("PASS one-op pairing: A sees B online, B sees A online");

  // 2. A persisted B's ticket (survives restart).
  a.send({ cmd: "peers" });
  const peersEv = await a.waitFor((ev) => ev.ev === "peers", 5000, "peers");
  assert.ok(peersEv.count >= 1, "A did not persist peer ticket, count=" + peersEv.count);
  console.log("PASS ticket persisted on acceptor (count=" + peersEv.count + ")");

  // 3. Restart A from its DSH_HOME -> connection must recover by itself.
  a.send({ cmd: "stop" }); await a.waitFor((ev) => ev.ev === "stopped", 5000, "stopped");
  a.child.kill(); await new Promise((r) => a.child.on("exit", r));
  await sleep(1000);
  a = await startChild("node-a", homes.a, 7910);
  st = { aSeesB: false, bSeesA: false };
  for (let i = 0; i < 30 && !(st.aSeesB && st.bSeesA); i++) { await sleep(1000); st = await bothOnline(a, b); }
  assert.ok(st.aSeesB && st.bSeesA, "no reconnect after A restart: " + JSON.stringify({ aSeesB: st.aSeesB, bSeesA: st.bSeesA }));
  console.log("PASS reconnect after restart");

  // 4. Stability: online state must hold (no false-offline flap) for 35s.
  for (let i = 0; i < 7; i++) {
    await sleep(5000);
    st = await bothOnline(a, b);
    assert.ok(st.aSeesB && st.bSeesA, "flap at sample " + i + ": " + JSON.stringify({ aSeesB: st.aSeesB, bSeesA: st.bSeesA }));
  }
  console.log("PASS stable online for 35s (7 samples)");

  console.log("dsh-fleet mesh: all assertions passed");
} finally {
  try { a?.send({ cmd: "exit" }); } catch {}
  try { b?.send({ cmd: "exit" }); } catch {}
  await sleep(500);
  a?.child.kill(); b?.child.kill();
  rmSync(home, { recursive: true, force: true });
}
