
process.env.DSH_HOME = "/tmp/mgr-probe-home";
import { McpStore, McpManager } from "../lib/index.js";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
mkdirSync("/tmp/mgr-probe-home", { recursive: true });
const store = new McpStore("/Users/ivan/github/casualjim/dsh-plugins/.dsh/mcp.json");
const registered = [];
const manager = new McpManager({
  logger: { info: (m) => console.log("[info]", String(m).slice(0, 160)), warn: (m) => console.log("[warn]", String(m).slice(0, 200)), error: (m) => console.log("[error]", String(m).slice(0, 200)) },
}, store);
manager.ctx = manager.ctx ?? {};
manager.ctx.tools = { register: (def) => { registered.push(def.name); return () => {}; } };
console.log("store servers:", store.data.servers.map(s => s.name + ":" + s.transport + ":" + (s.enabled ? "on" : "off")).join(", "));
await manager.setSession("/Users/ivan/github/casualjim/dsh-plugins");
await new Promise(r => setTimeout(r, 8000));
const sum = manager.summary();
console.log("counts:", JSON.stringify(sum.counts));
for (const s of sum.servers) console.log(" ", s.name, s.status, s.error ? "ERR=" + String(s.error).slice(0, 160) : "");
process.exit(0);
