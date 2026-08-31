#!/usr/bin/env node
// Post-sync localization: rewrite upstream-hybrid strings to English (full-line where safe).
import fs from "node:fs";
import path from "node:path";
const PKG = path.resolve(new URL("..", import.meta.url).pathname);
const lineRewrites = [
  ["src/apply.ts", 25, '  "The dsh-mcp-manager plugin (DSH MCP manager) is installed on this machine: manage MCP servers from the floating panel in the top-right of the session UI (global config at ~/.dsh/dsh-mcp.json; project-level config at <project-root>/.dsh/mcp.json, following the active session and connecting that project\'s servers; supports stdio / streamable-http, plus paste-mcpServers-JSON import; no servers are preconfigured). The capability list of configured servers appears in-session under <available_mcp_servers> (describes capabilities only, not live connection state). Project-level MCP tools are discovered via ws_mcp_list/ws_mcp_search (run ws_mcp_list first for a full inventory of servers and tools, then ws_mcp_detail for a full inputSchema as needed) and invoked via ws_mcp_call (search with ws_mcp_search first, then call; call directly without searching when server/tool are already known); once a global server is connected, its tools register as mcp__<server>__<tool>. Tools can be disabled by the user in the MCP panel (the reason is explained; tool-level disables only affect mcp__-prefixed tools). Limits: MCP tools execute on real servers - confirm before acting; stdio server subprocesses inherit host permissions; tool results may contain sensitive information. When the user mentions MCP / mcp service / context server they mean this plugin; collaborate accordingly.";'],
  ["src/catalog.ts", 153, '    "Project-level servers are always accessed through middleware tools: first search the workspace MCP tools with `ws_mcp_search`, then invoke with `ws_mcp_call` (server/tool come from the search results; for a full inventory of all servers and tools use `ws_mcp_list`, for a single tool\'s full inputSchema use `ws_mcp_detail`). **Project-level servers are never called via their mcp__-prefixed tools directly**.";'],
  ["src/catalog.ts", 156, '      ? "Global servers also go through middleware in all mode (global servers register no mcp__ tools in all mode): first search with `ws_mcp_search`, then invoke via `ws_mcp_call` - the same `ws_mcp_*` tools as project-level."'],
  ["src/catalog.ts", 157, '      : "Global servers are still called directly via `mcp__<server>__<tool>` prefixed tools (in project mode, global servers are not searchable through middleware).";'],
  ["src/catalog.ts", 162, '      : `When a task matches a server\'s capabilities, call its \`mcp__<server>__<tool>\` tools directly (exact tool names and parameters are in the tool list).${globalGuidance}`;'],
  ["src/middleware-register.ts", 39, '  "(no matching MCP tools in the current workspace; run ws_mcp_list for a full inventory of servers and tools, confirm the server/tool names, then search again)";'],
  ["src/middleware-register.ts", 108, '          `${caller}: server ${JSON.stringify(server)} is a global-scope server; middleware only covers project-level servers - call its mcp__${bare}__<tool> prefixed tools directly (in project mode, global tools are still registered for direct calls)`,'],
  ["src/middleware-register.ts", 309, '          const head = tools.length > 0 ? `${server} (${tools.length} tools):\n${tools.map((t) => `  - ${String(t.tool ?? "")}: ${String(t.description ?? "")}`).join("\n")}` : `${server} (0 tools)`;'],
  ["src/middleware-register.ts", 358, '        const visibleText = visible.length > 0 ? `Visible project-level servers: ${visible.join(" / ")}; ` : "No discovered project-level servers in the current workspace; ";'],
  ["src/middleware-register.ts", 360, '          `No project-level servers match server=${JSON.stringify(serverFilter)}.${visibleText}Global-scope servers are not listed here - access them via mcp__<server>__<tool> prefixed tools`;'],
  ["src/middleware-utils.ts", 250, '  return `ws_mcp_call: tool ${JSON.stringify(`${serverKey}/${tool}`)} was disabled by the user in the MCP panel; tool-level disables only affect mcp__-prefixed tools - bare-name discipline calls are unaffected (re-enable in the panel to restore)`;'],
  ["src/middleware.ts", 413, '      throw new Error(`ws_mcp_call: server ${JSON.stringify(fullName)} is disconnected or connect failed; run ws_mcp_search or ws_mcp_list first to confirm the server is connected`);'],
  ["src/middleware.ts", 416, '      throw new Error(`ws_mcp_call: server ${JSON.stringify(fullName)} is still connecting; retry shortly and call again once the connect completes`);'],
  ["src/middleware.ts", 425, '        throw new Error(`${reason ?? `ws_mcp_call: tool ${JSON.stringify(`${policyKey}/${tool}`)} denied by policy`}; to allow it, adjust the middlewarePolicy config`);'],
  ["src/routes.ts", 381, '          writeJson(res, 400, { error: `server ${JSON.stringify(server)} is not in the current workspace; routing-consistency check failed (prevents cross-workspace bleed)` });'],
];
const chunkPairs = [
  ["src/client/index.ts", "locale 注册失败：", "locale registration failed: "],
  ["src/client/index.ts", "首刷失败：", "initial render failed: "],
  ["src/client/index.ts", "关闭旧 SSE 连接失败：", "failed to close old SSE connection: "],
  ["src/config-schema.ts", "浮窗Z-index base（1-9000），胶囊与点击后弹出的主面板同取该配置值", "Floating panel z-index base (1-9000); the pill and the expanded main panel use the same value"],
  ["src/middleware-register.ts", "server 参数格式非法，应为 @<root>/<server>", "server argument is malformed; expected @<root>/<server>"],
  ["src/middleware-register.ts", "（结果已达 limit，可能未列全——可调大 limit 或用 ws_mcp_list 完整盘点）", "(results hit the limit and may be incomplete - raise limit or use ws_mcp_list for a full inventory)"],
  ["src/middleware-register.ts", "不可用Servers：", "Unavailable servers:"],
  ["src/middleware-register.ts", "无Project-level MCP 配置", "has no project-level MCP config"],
  ["src/middleware-utils.ts", "tool 参数疑似Others MCP server 的注册全名（", "tool argument looks like the registered full name of a different MCP server ("],
  ["src/middleware-utils.ts", "；请传该 server 上的裸名", "; pass the bare tool name on that server"],
  ["src/middleware-utils.ts", "被 denyTools 策略拒绝", "denied by the denyTools policy"],
  ["src/middleware.ts", "未就绪（client 缺失）；请稍后重试或重新Connect", "is not ready (client missing); retry shortly or reconnect"],
  ["src/routes.ts", "server 与 tool 均为必填", "both server and tool are required"],
  ["src/routes.ts", "server 格式非法，应为 @<root>/<server>", "server argument is malformed; expected @<root>/<server>"],
  ["src/supervisor.ts", "（已截断：原文 ", "(truncated: original "],
  ["src/supervisor.ts", " 字节，仅显示前 ", " bytes, showing first "],
  ["src/supervisor.ts", " 字节）", " bytes)"],
];
for (const [rel, lineNo, content] of lineRewrites) {
  const f = path.join(PKG, rel);
  const lines = fs.readFileSync(f, "utf8").split("\n");
  const old = lines[lineNo - 1];
  lines[lineNo - 1] = content;
  fs.writeFileSync(f, lines.join("\n"));
  console.log("L" + lineNo + " " + rel);
}
for (const [rel, from, to] of chunkPairs) {
  const f = path.join(PKG, rel);
  let src = fs.readFileSync(f, "utf8");
  if (!src.includes(from)) { console.log("MISS " + rel + " :: " + from.slice(0, 50)); continue; }
  fs.writeFileSync(f, src.split(from).join(to));
}
console.log("SYNC_FIX_DONE");
