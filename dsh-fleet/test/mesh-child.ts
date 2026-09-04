// dsh-fleet mesh test child: one FleetNode per process (own DSH_HOME).
// stdin: JSON lines {cmd, code?} -> stdout JSON lines {ev, ...}
import { createInterface } from "node:readline";
import { FleetNode, loadConfig } from "../lib/index.js";

const config = loadConfig();
if (process.env.FLEET_NAME !== undefined && process.env.FLEET_NAME !== "") config.name = process.env.FLEET_NAME;
if (process.env.FLEET_GATEWAY_BASE !== undefined) config.gateway_base = Number(process.env.FLEET_GATEWAY_BASE);

const log = (...a: unknown[]) => { console.log(JSON.stringify({ ev: "log", msg: a.map(String).join(" ") })); };
const node = new FleetNode(config, log);
let up = false;

const rl = createInterface({ input: process.stdin });
const send = (o: Record<string, unknown>) => { console.log(JSON.stringify(o)); };
rl.on("line", (raw) => {
  void (async () => {
    let msg: { cmd?: string; code?: string };
    try { msg = JSON.parse(raw); } catch { return; }
    try {
      if (msg.cmd === "start") { await node.start(); up = true; send({ ev: "up", id: (node.status().self as { id: string }).id }); }
      else if (msg.cmd === "pairing") { if (!up) throw new Error("not started"); send({ ev: "pairing", code: node.pairingCode() }); }
      else if (msg.cmd === "pair") { await node.pair(String(msg.code)); send({ ev: "paired" }); }
      else if (msg.cmd === "status") { send({ ev: "status", status: node.status() }); }
      else if (msg.cmd === "peers") { send({ ev: "peers", count: loadConfig().peers.length }); }
      else if (msg.cmd === "stop") { await node.stop(); send({ ev: "stopped" }); }
      else if (msg.cmd === "exit") { process.exit(0); }
    } catch (error) { send({ ev: "error", error: error instanceof Error ? error.message : String(error), cmd: msg.cmd }); }
  })();
});
