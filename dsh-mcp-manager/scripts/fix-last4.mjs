#!/usr/bin/env node
// Final 4 line rewrites after upstream sync.
import fs from "node:fs";
const P = "/Users/ivan/github/casualjim/dsh-plugins/dsh-mcp-manager/src/";
const edits = [
  ["middleware-register.ts", 257, "      if (unit === undefined) throw new Error(`ws_mcp_call: workspace ${JSON.stringify(targetRoot)} has no project-level MCP config`);"],
  ["middleware-register.ts", 362, "          `No project-level servers match server=${JSON.stringify(serverFilter)}.${visibleText}Global-scope servers are not listed here - access them via mcp__<server>__<tool> prefixed tools`;"],
  ["middleware-utils.ts", 243, "    return `ws_mcp_call: tool ${JSON.stringify(`${serverKey}/${tool}`)} denied by the denyTools policy`;"],
  ["middleware-utils.ts", 245, "  return `ws_mcp_call: tool ${JSON.stringify(`${serverKey}/${tool}`)} is not in the allowTools allowlist; denied by policy`;"],
];
for (const [rel, n, content] of edits) {
  const f = P + rel;
  const lines = fs.readFileSync(f, "utf8").split("\n");
  lines[n - 1] = content;
  fs.writeFileSync(f, lines.join("\n"));
  console.log("L" + n + " " + rel);
}
